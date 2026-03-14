/** Pure helper functions and types for calendar gap-finding. */

export interface AvailableSlot {
  start: string;
  end: string;
}

export interface FreeBusyResponse {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
}

export function findGaps(
  windowStart: Date,
  windowEnd: Date,
  busy: Array<{ start: string; end: string }>,
  minDurationMinutes: number,
): AvailableSlot[] {
  const sorted = [...busy].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const gaps: AvailableSlot[] = [];
  let cursor = windowStart.getTime();
  const minMs = minDurationMinutes * 60_000;

  for (const slot of sorted) {
    const busyStart = new Date(slot.start).getTime();
    const busyEnd = new Date(slot.end).getTime();

    if (busyStart > cursor && busyStart - cursor >= minMs) {
      gaps.push({
        start: new Date(cursor).toISOString(),
        end: new Date(busyStart).toISOString(),
      });
    }

    cursor = Math.max(cursor, busyEnd);
  }

  // Gap after last busy slot
  const windowEndMs = windowEnd.getTime();
  if (windowEndMs > cursor && windowEndMs - cursor >= minMs) {
    gaps.push({
      start: new Date(cursor).toISOString(),
      end: new Date(windowEndMs).toISOString(),
    });
  }

  return gaps;
}
