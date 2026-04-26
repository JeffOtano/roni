function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface GroupedGarminPayload {
  readonly garminUserId: string;
  readonly payload: Record<string, unknown[]>;
}

export function groupSummaryEntriesByUser(
  summaryKey: string,
  rawPayload: unknown,
): GroupedGarminPayload[] {
  if (!isRecord(rawPayload)) return [];
  const list = rawPayload[summaryKey];
  if (!Array.isArray(list)) return [];

  const entriesByUser = new Map<string, unknown[]>();
  for (const entry of list) {
    if (!isRecord(entry) || typeof entry.userId !== "string") continue;
    const entries = entriesByUser.get(entry.userId) ?? [];
    entries.push(entry);
    entriesByUser.set(entry.userId, entries);
  }

  return [...entriesByUser.entries()].map(([garminUserId, entries]) => ({
    garminUserId,
    payload: { [summaryKey]: entries },
  }));
}

export function extractGarminUserIdsFromDeregistration(rawPayload: unknown): string[] {
  if (!isRecord(rawPayload)) return [];
  const list = rawPayload.deregistrations;
  if (!Array.isArray(list)) return [];
  const ids = new Set<string>();
  for (const entry of list) {
    if (isRecord(entry) && typeof entry.userId === "string") {
      ids.add(entry.userId);
    }
  }
  return [...ids];
}

export interface ParsedPermissionChange {
  readonly garminUserId: string;
  readonly permissions: string[];
}

export function parsePermissionChangePayload(rawPayload: unknown): ParsedPermissionChange[] {
  if (!isRecord(rawPayload)) return [];
  const list = rawPayload.userPermissionsChange;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (typeof entry.userId !== "string") return [];
    if (!Array.isArray(entry.permissions)) return [];
    const permissions = entry.permissions.filter((p): p is string => typeof p === "string");
    return [{ garminUserId: entry.userId, permissions }];
  });
}
