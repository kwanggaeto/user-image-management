const KST_OFFSET_MINUTES = 9 * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function toKstIsoString(date: Date): string {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = pad(kstDate.getUTCMonth() + 1);
  const day = pad(kstDate.getUTCDate());
  const hours = pad(kstDate.getUTCHours());
  const minutes = pad(kstDate.getUTCMinutes());
  const seconds = pad(kstDate.getUTCSeconds());
  const milliseconds = pad(kstDate.getUTCMilliseconds(), 3);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+09:00`;
}

export function addDaysKst(date: Date, days: number): string {
  return toKstIsoString(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
}

export function createImageTimestamps(
  now: Date,
  expireDays: number,
): {
  createAt: string;
  expireAt: string;
} {
  return {
    createAt: toKstIsoString(now),
    expireAt: addDaysKst(now, expireDays),
  };
}

function kstDatePart(value: Date | string): string {
  if (value instanceof Date) {
    return toKstIsoString(value).slice(0, 10);
  }
  return value.slice(0, 10);
}

export function isExpiredBeforeTodayKst(expireAt: string, now: Date): boolean {
  return kstDatePart(expireAt) < kstDatePart(now);
}
