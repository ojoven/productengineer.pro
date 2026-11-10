// A few map events for the privacy-friendly analytics. No-op when analytics is not loaded.
type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props) {
  const w = window as unknown as { plausible?: (e: string, o?: { props?: Props }) => void };
  try {
    w.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* ignore */
  }
}
