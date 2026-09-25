/** Joins class names, skipping empty ones. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ")
}

/** Data attribute helper: present when true, absent otherwise. */
export const flag = (on: unknown) => (on ? "" : undefined)
