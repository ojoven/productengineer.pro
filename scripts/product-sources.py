#!/usr/bin/env python3
"""Read-only, aggregate evidence checks. See docs/product/sources.md."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RYBBIT_HOST = "https://analytics.mtorr.es"
RYBBIT_SITE = "0b9e1ee60f53"
UTC = dt.timezone.utc

DATABASE_CHECK = r'''
import datetime as dt, json, sqlite3
end = dt.datetime.fromisoformat(END)
stop = int(end.timestamp() * 1000)
start = stop - 28 * 86400000
previous = start - 28 * 86400000
db = sqlite3.connect("file:/var/www/html/productengineer.pro/data/productengineer.sqlite?mode=ro", uri=True, timeout=5)
db.execute("PRAGMA query_only=ON")
db.execute("BEGIN")
queries = {
    "accounts_created": "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?",
    "accounts_with_latest_nonempty_progress_in_window": "SELECT COUNT(DISTINCT user_id) FROM progress WHERE status != 'none' AND updated_at >= ? AND updated_at < ?",
    "remaining_sign_in_sessions_created": "SELECT COUNT(*) FROM sessions WHERE created_at >= ? AND created_at < ?",
}
counts = {name: {"current_28d": db.execute(sql, (start, stop)).fetchone()[0], "previous_28d": db.execute(sql, (previous, start)).fetchone()[0]} for name, sql in queries.items()}
windows = {name: {"start_utc": dt.datetime.fromtimestamp(lo / 1000, dt.timezone.utc).isoformat(), "end_utc_exclusive": dt.datetime.fromtimestamp(hi / 1000, dt.timezone.utc).isoformat()} for name, (lo, hi) in {"current_28d": (start, stop), "previous_28d": (previous, start)}.items()}
print(json.dumps({"source": "production SQLite over SSH secondary", "status": "connected", "query_only": bool(db.execute("PRAGMA query_only").fetchone()[0]), "schema_version": db.execute("PRAGMA user_version").fetchone()[0], "all_time_accounts": db.execute("SELECT COUNT(*) FROM users").fetchone()[0], "all_time_progress_rows": db.execute("SELECT COUNT(*) FROM progress").fetchone()[0], "windows": windows, "counts": counts}))
db.close()
'''

LOG_CHECK = r'''
import collections, datetime as dt, gzip, json, pathlib, re, urllib.parse
end = dt.datetime.fromisoformat(END)
windows = {"current_28d": (end - dt.timedelta(days=28), end), "previous_28d": (end - dt.timedelta(days=56), end - dt.timedelta(days=28))}
result = {name: {"requests": 0, "status_classes": collections.Counter(), "referrer_groups": collections.Counter(), "excluded_source_check_requests": 0} for name in windows}
pattern = re.compile(r'^\S+ \S+ \S+ \[([^\]]+)\] "([^\"]*)" (\d{3}) \S+ "([^\"]*)" "([^\"]*)"')
first = last = None
unparsed = 0
files = []
for path in sorted(pathlib.Path("/var/log/apache2").glob("productengineer-access.log*")):
    files.append(path.name)
    with (gzip.open if path.suffix == ".gz" else open)(path, "rt", errors="replace") as handle:
        for line in handle:
            match = pattern.match(line)
            if not match:
                unparsed += 1
                continue
            try:
                at = dt.datetime.strptime(match[1], "%d/%b/%Y:%H:%M:%S %z")
            except ValueError:
                unparsed += 1
                continue
            first = at if first is None or at < first else first
            last = at if last is None or at > last else last
            try:
                host = urllib.parse.urlsplit(match[4]).hostname
            except ValueError:
                host = None
            if not host:
                group = "none_or_invalid"
            elif host in {"productengineer.pro", "www.productengineer.pro"}:
                group = "self"
            elif host == "linkedin.com" or host.endswith(".linkedin.com"):
                group = "linkedin"
            elif host in {"www.google.com", "www.bing.com", "duckduckgo.com"}:
                group = "search"
            else:
                group = "other_external"
            for name, (lo, hi) in windows.items():
                if lo <= at < hi:
                    row = result[name]
                    if "ProductEngineer-source-check" in match[5]:
                        row["excluded_source_check_requests"] += 1
                        continue
                    row["requests"] += 1
                    row["status_classes"][match[3][0] + "xx"] += 1
                    row["referrer_groups"][group] += 1
for name, row in result.items():
    row["status_classes"] = dict(row["status_classes"])
    row["referrer_groups"] = dict(row["referrer_groups"])
    lo, hi = windows[name]
    row["start_utc"] = lo.isoformat()
    row["end_utc_exclusive"] = hi.isoformat()
    row["full_window_covered"] = first is not None and first <= lo
    if first is None or first >= hi:
        row["requests"] = None
        row["coverage_note"] = "No available log coverage for this window; not measured zero traffic."
error_lines = 0
for path in pathlib.Path("/var/log/apache2").glob("productengineer-error.log*"):
    with (gzip.open if path.suffix == ".gz" else open)(path, "rt", errors="replace") as handle:
        error_lines += sum(1 for _ in handle)
print(json.dumps({"source": "Apache logs, aggregated on the server", "status": "connected", "files": files, "available_first_utc": first.astimezone(dt.timezone.utc).isoformat() if first else None, "available_last_utc": last.astimezone(dt.timezone.utc).isoformat() if last else None, "unparsed_access_lines": unparsed, "windows": result, "error_lines_all_available_files": error_lines, "error_log_window": "all available files; no dated comparison"}))
'''


def remote_check(source, end, sudo=False):
    command = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "secondary"]
    command += ["sudo", "-n"] if sudo else []
    command += ["python3", "-"]
    code = "END = " + repr(end.isoformat()) + "\n" + source
    result = subprocess.run(command, input=code, text=True, capture_output=True, timeout=40)
    if result.returncode:
        raise RuntimeError("Read-only SSH check failed; verify SSH access and log-read privileges.")
    return json.loads(result.stdout)


def github_check():
    output = []
    for repo in ["ojoven/productengineer.pro", "ojoven/product-engineering-skills"]:
        result = subprocess.run(["gh", "api", "--method", "GET", "--paginate", "--slurp", "repos/" + repo + "/issues?state=all&per_page=100"], text=True, capture_output=True, timeout=30)
        if result.returncode:
            raise RuntimeError("GitHub read failed; verify gh read access to the two project repositories.")
        issues = [issue for page in json.loads(result.stdout) for issue in page if "pull_request" not in issue]
        output.append({"repository": repo, "all_time_issues": len(issues), "open": sum(issue["state"] == "open" for issue in issues), "closed": sum(issue["state"] == "closed" for issue in issues), "comments": sum(issue.get("comments", 0) for issue in issues)})
    return {"source": "GitHub Issues", "status": "connected", "window": "all time; prior snapshot unavailable", "repositories": output}


def rybbit_check(end):
    variable = "PRODUCTENGINEER_RYBBIT_API_KEY"
    env_file = ROOT / ".env.sources"
    if not os.environ.get(variable) and env_file.is_file():
        for line in env_file.read_text().splitlines():
            name, separator, value = line.strip().removeprefix("export ").partition("=")
            if separator and name.strip() == variable:
                os.environ[variable] = value.strip().strip("\"'")
    key = os.environ.get(variable)
    if not key:
        return {"source": "Rybbit", "status": "blocked", "reason": "Missing " + variable, "host": RYBBIT_HOST, "site": RYBBIT_SITE}

    def get(path, params):
        url = RYBBIT_HOST + "/api/sites/" + RYBBIT_SITE + path + "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"Authorization": "Bearer " + key, "User-Agent": "ProductEngineer-source-check/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    # Use completed local days to avoid comparing today's partial traffic to a full day.
    from zoneinfo import ZoneInfo
    last_day = end.astimezone(ZoneInfo("Europe/Madrid")).date() - dt.timedelta(days=1)
    output = {"source": "Rybbit", "status": "connected", "site": RYBBIT_SITE, "windows": {}}
    for name, hi in [("current_28d", last_day), ("previous_28d", last_day - dt.timedelta(days=28))]:
        params = {"start_date": (hi - dt.timedelta(days=27)).isoformat(), "end_date": hi.isoformat(), "time_zone": "Europe/Madrid"}
        data = get("/overview", params)
        metrics = data.get("data", data)
        output["windows"][name] = {"parameters": params, "metrics": {field: metrics.get(field) for field in ["users", "sessions", "pageviews"]}}
        events = get("/events/names", params).get("data", [])
        output["windows"][name]["custom_event_name_count"] = len(events)
        output["windows"][name]["custom_event_occurrences"] = sum(row.get("count", 0) for row in events)
        expected = {"tour_started", "tour_step_viewed", "tour_end_reached", "tour_exited", "progress_changed", "map_used", "search_results_viewed", "learning_link_opened", "setup_command_copied"}
        counts = {row.get("eventName", row.get("event_name")): row.get("count", 0) for row in events}
        output["windows"][name]["planned_event_counts"] = {event: counts.get(event, 0) for event in sorted(expected)}
        output["windows"][name]["missing_planned_events"] = sorted(expected - counts.keys())
        output["windows"][name]["unrecognized_event_name_count"] = len(counts.keys() - expected)
        attribution = get("/metric", params | {"parameter": "referrer", "limit": 100, "page": 1})
        page = attribution.get("data", {})
        rows = page.get("data", []) if isinstance(page, dict) else page
        groups = {}
        for row in rows:
            value = row.get("value", "")
            if not value or value in {"direct", "(direct)"}:
                group = "direct_or_empty"
            else:
                host = urllib.parse.urlsplit(value if "://" in value else "https://" + value).hostname or ""
                if host in {"productengineer.pro", "www.productengineer.pro"}:
                    group = "self"
                elif host == "linkedin.com" or host.endswith(".linkedin.com"):
                    group = "linkedin"
                elif host in {"www.google.com", "google.com", "www.bing.com", "bing.com", "duckduckgo.com"}:
                    group = "search"
                else:
                    group = "other_external"
            groups[group] = groups.get(group, 0) + row.get("count", 0)
        output["windows"][name]["referrer_counts_by_group"] = groups
        output["windows"][name]["referrer_total_rows"] = page.get("totalCount") if isinstance(page, dict) else len(rows)
        output["windows"][name]["referrer_rows_returned"] = len(rows)
    params = output["windows"]["current_28d"]["parameters"] | {"limit": 1, "offset": 0}
    replays = get("/session-replay/list", params)
    rows = replays.get("data", [])
    output["replay_probe"] = {"limit": 1, "returned_rows": len(rows) if isinstance(rows, list) else None, "note": "Probe only, not a total replay count; no replay content or identities returned."}
    through_today = output["windows"]["current_28d"]["parameters"] | {"end_date": (last_day + dt.timedelta(days=1)).isoformat()}
    event_names = get("/events/names", through_today).get("data", [])
    output["custom_events_through_today"] = {"parameters": through_today, "distinct_names": len(event_names), "occurrences": sum(row.get("count", 0) for row in event_names), "note": "Includes the partial current day; diagnostic only, not the 28-day comparison."}
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=["database", "logs", "github", "rybbit"])
    parser.add_argument("--end", help="Timezone-aware ISO timestamp; default is now (UTC).")
    args = parser.parse_args()
    end = dt.datetime.fromisoformat(args.end) if args.end else dt.datetime.now(UTC)
    if end.tzinfo is None:
        parser.error("--end must include a timezone")
    try:
        if args.source == "database":
            result = remote_check(DATABASE_CHECK, end)
        elif args.source == "logs":
            result = remote_check(LOG_CHECK, end, sudo=True)
        elif args.source == "github":
            result = github_check()
        else:
            result = rybbit_check(end)
        result["checked_at_utc"] = dt.datetime.now(UTC).isoformat()
        print(json.dumps(result, indent=2))
        return 2 if result["status"] == "blocked" else 0
    except urllib.error.HTTPError as error:
        print(json.dumps({"source": args.source, "status": "blocked", "http_status": error.code, "reason": "Verify read scopes and site access; no credential or response body emitted."}))
        return 2
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"source": args.source, "status": "blocked", "reason": str(error) if isinstance(error, RuntimeError) else type(error).__name__}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
