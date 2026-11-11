# productengineer-api

The small backend behind productengineer.pro. It does three things:

1. **Accounts.** Sign in with GitHub or Google. An account stores each provider's stable id, email
   address and verification flag, plus a display name and avatar URL. Someone who signed in with GitHub on one device and Google on
   another can link the two from their map; the accounts merge.
2. **Synced progress.** One status per skill (`learning`, `comfortable`, `not-interested`, or cleared), merged per skill
   with the newest change winning. The site keeps working from the browser's copy and syncs in the
   background (`src/scripts/sync.ts` in the website).
3. **MCP.** A read-only MCP server for agents, plus the OAuth authorization server they need to
   read a person's statuses.

Node 22.18 or newer runs the TypeScript directly (type stripping). SQLite through `node:sqlite`, so
nothing native to compile. [Hono](https://hono.dev) for HTTP, the
[MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/) for MCP.

## Files

| File | What |
| --- | --- |
| `src/main.ts` | Starts the server, sweeps expired rows every hour. |
| `src/app.ts` | Routes: `/api/*`, OAuth, `/mcp` (signed in) and `/mcp/public`. |
| `src/account.ts` | Sign-in round trip, profile, progress, connected agents. Cookies, same origin only. |
| `src/providers.ts` | GitHub and Google (and a dev provider for local work). |
| `src/users.ts` | People, identities, sessions, progress merge, account linking. |
| `src/oauth.ts` | OAuth 2.1 for agents: metadata, client registration, authorize, token, revoke. |
| `src/cimd.ts` | Fetches Client ID Metadata Documents safely (public addresses only). |
| `src/mcp.ts` | The MCP tools. |
| `src/db.ts` | Schema and migrations. |
| `atlas.json` | The atlas content, exported by `npm run export:atlas` in the website. Not committed. |

## How an agent connects

Following the MCP authorization spec (revision 2026-07-28):

1. The agent calls `/mcp`, gets `401` with `WWW-Authenticate: Bearer resource_metadata=...`.
2. It reads `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server`.
3. It identifies itself with a Client ID Metadata Document (an https `client_id`) or registers at
   `/oauth/register` (Dynamic Client Registration, deprecated by the spec but still what most
   clients send).
4. It opens `/oauth/authorize` in the browser with PKCE (S256) and `resource=https://productengineer.pro/mcp`.
   The server stores the request and sends the person to `/connect/` on the site, where they sign in
   if needed and approve or deny.
5. The agent exchanges the code at `/oauth/token`: a 1-hour access token and a 60-day refresh token,
   rotated on use. Tokens are random strings stored only as hashes.
6. People see and revoke connected agents on their map.

## Run and test

```sh
npm install
cp .env.example .env   # local: PUBLIC_URL=http://localhost:4321, DEV_LOGIN=1
npm run dev            # needs ../server/atlas.json: run `npm run export:atlas` in the website first
npm test               # node:test, including the full OAuth flow with the official MCP client
npm run check          # tsc
```

## Production

PM2 runs it as `productengineer-api` on 127.0.0.1:8790 (`ecosystem.config.cjs`); Apache proxies
`/api/`, `/oauth/`, `/mcp`, `/mcp/public` and the two OAuth discovery documents to it. The database
is `/var/www/html/productengineer.pro/data/productengineer.sqlite`, backed up nightly to
`~/backups/productengineer` (14 days). See `deploy/setup-api.sh` in the website.

### Email collection

Google sign-in requests `openid profile email` and reads `email` and `email_verified` from the
validated ID token. GitHub requests `user:email` and reads `/user/emails`, so a hidden public email
does not prevent collection. It prefers the verified primary email, then another verified email,
then the primary or first available email; the verification flag reflects the chosen address.
If no address is shared, sign-in still works and the email is null.

Email and verification are stored on each `identities` row, refreshed on every sign-in and link,
and retained for both providers after a merge. Equal email addresses never automatically merge
accounts; linking still requires signing in. The signed-in person's `/api/me` response includes
`identities[].email` and `identities[].emailVerified`. MCP tools do not expose emails.

The schema migration runs automatically at API startup. Existing identities start with a null
email until the person signs in with that provider again and grants the new permission. Provider
access tokens are discarded after sign-in, so emails cannot be backfilled without a new sign-in.

### Production setup checklist

Run local commands below from `website/`. The scripts deploy to the SSH alias `secondary` by
default; override `REMOTE_HOST` if needed.

1. **Create a GitHub OAuth App** at <https://github.com/settings/applications/new>:
   - Application name: `ProductEngineer.pro`.
   - Homepage: `https://productengineer.pro`.
   - Authorization callback: `https://productengineer.pro/api/auth/github/callback`.
   - Copy the Client ID and generate a Client Secret. The code requests `user:email`; no separate
     scope selection is needed in GitHub's dashboard. If the app already exists with these URLs,
     keep it and its credentials.
2. **Configure a production Google Cloud project** at <https://console.cloud.google.com/auth/overview>:
   - In Google Auth Platform, set Branding (name, support email and developer contact), add
     `productengineer.pro` as an authorized domain, and choose an External audience for public use.
   - Under Data Access, declare `openid`, `https://www.googleapis.com/auth/userinfo.profile` and
     `https://www.googleapis.com/auth/userinfo.email` (the console's names for the requested scopes).
   - Create a client of type **Web application**, with JavaScript origin
     `https://productengineer.pro` and redirect URI
     `https://productengineer.pro/api/auth/google/callback`. Copy its Client ID and Client Secret.
     Existing clients can be reused when their URLs match; add the email scope to Data Access.
   - Publish the audience for production. These basic sign-in scopes are non-sensitive. Google
     treats brand verification separately; follow the Branding/Verification Center prompts if you
     want your name/logo shown. Supply the homepage and a public privacy URL (the current account
     data explanation is at `https://productengineer.pro/about/#privacy`), and verify domain
     ownership through Search Console if prompted.
3. **Create the private credentials file locally**, without overwriting one that already exists:

   ```sh
   cp -n server/.env.example server/.env.production
   chmod 600 server/.env.production
   ```

   Set `PUBLIC_URL=https://productengineer.pro` and fill in `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Keep `DEV_LOGIN` disabled.
   The file is git-ignored. Keep secrets out of chat, source control and frontend environment variables.
4. **Check deployment prerequisites.** Use Node 24 locally (`nvm use` reads `.nvmrc`) and Node
   22.18+ on the VPS. Confirm `ssh secondary` works without an interactive password, and that the
   deployment user can run the script's `sudo` Apache commands. Apache, TLS for the apex and `www`,
   PM2, and its startup service must already be configured. If the static site is not set up yet,
   run `./deploy/setup.sh` first. `pm2 save` persists the API after deployment; the PM2 startup
   service is what brings it back after a reboot.
5. **Deploy the API and site together**:

   ```sh
   nvm use
   ./deploy/setup-api.sh
   ```

   This tests and builds locally, uploads the API and credentials, starts PM2, applies schema
   migrations, installs the HTTPS proxy config with a backup, schedules nightly SQLite backups,
   uploads the static site, and checks public endpoints. Backups stay on the VPS; copy them off
   the host separately if needed. The script does not configure either OAuth provider for you.
6. **Test real sign-ins.** Use separate browser sessions to try GitHub (including a private email)
   and Google; inspect your own `/api/me` JSON for each email and verification flag. Test linking,
   progress on a second device, and approving/revoking an MCP connection. Provider configuration
   and real consent require this check even when the automated tests pass.

For later code deployments, use `npm run deploy`. It leaves the remote credentials unchanged.
After editing local OAuth credentials, rerun `./deploy/setup-api.sh` to upload them, or securely
update the remote `server/.env` and restart `productengineer-api` through PM2.

Provider references: [GitHub OAuth App creation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app),
[GitHub email scope/API](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user),
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Google publishing status](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview),
[Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
