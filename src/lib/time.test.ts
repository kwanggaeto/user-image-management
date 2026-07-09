import { describe, expect, test } from "vitest";
import {
  addDaysKst,
  createImageTimestamps,
  isExpiredBeforeTodayKst,
  toKstIsoString,
} from "./time";

describe("KST time helpers", () => {
  test("formats UTC dates with Korean Standard Time offset", () => {
    const date = new Date("2026-07-09T00:30:00.000Z");
    expect(toKstIsoString(date)).toBe("2026-07-09T09:30:00.000+09:00");
  });

  test("adds expiration days in KST display time", () => {
    const createAt = new Date("2026-07-09T00:30:00.000Z");
    expect(addDaysKst(createAt, 7)).toBe("2026-07-16T09:30:00.000+09:00");
  });

  test("creates createAt and expireAt together", () => {
    const now = new Date("2026-07-09T00:30:00.000Z");
    expect(createImageTimestamps(now, 3)).toEqual({
      createAt: "2026-07-09T09:30:00.000+09:00",
      expireAt: "2026-07-12T09:30:00.000+09:00",
    });
  });

  test("treats yesterday in KST as expired", () => {
    const now = new Date("2026-07-09T01:00:00.000Z");
    expect(
      isExpiredBeforeTodayKst("2026-07-08T23:59:59.000+09:00", now),
    ).toBe(true);
  });

  test("does not treat today in KST as expired", () => {
    const now = new Date("2026-07-09T01:00:00.000Z");
    expect(
      isExpiredBeforeTodayKst("2026-07-09T00:00:00.000+09:00", now),
    ).toBe(false);
  });
});
