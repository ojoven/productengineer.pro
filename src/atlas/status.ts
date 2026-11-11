/** The same status values are used by the browser, exports and account sync. */
export const STATUS_OPTIONS = [
  { value: 'none', label: 'Not started', cls: '' },
  { value: 'learning', label: 'Learning', cls: 'l' },
  { value: 'comfortable', label: 'Comfortable', cls: 'c' },
  { value: 'not-interested', label: 'Not interested', cls: 'ni' },
] as const;

export type ProgressStatus = (typeof STATUS_OPTIONS)[number]['value'];
export type Status = Exclude<ProgressStatus, 'none'>;
export const STATUSES = STATUS_OPTIONS.map((option) => option.value);

export function isStatus(value: unknown): value is Status {
  return value === 'learning' || value === 'comfortable' || value === 'not-interested';
}
