export function nowIso(): string {
  return new Date().toISOString();
}

export function prettyTime(input?: string): string {
  if (!input) {
    return "--:--";
  }

  const date = new Date(input);
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}
