import { afterEach, describe, expect, it, vi } from "vitest";
import { validName, validPassword, signUp, cloudAction } from "../src/account/client";

afterEach(() => vi.unstubAllGlobals());
describe("account input validation", () => {
  it("accepts Vietnamese owner names and rejects malformed/inappropriate names", () => {
    expect(validName("Chủ Tiệm An")).toBe(true);
    expect(validName("Mây 29")).toBe(true);
    for (const value of ["A", "x".repeat(33), "<script>", "fuck", "\n\t"]) expect(validName(value)).toBe(false);
  });
  it("requires a nontrivial password without storing its contents", () => {
    expect(validPassword("MilkTea2026!")).toBe(true);
    for (const value of ["1234567890", "abcdefghijk", "Tea123"]) expect(validPassword(value)).toBe(false);
  });
  it("rejects invalid signup before sending network traffic", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(signUp("test@example.com", "short", "Chủ Tiệm An")).rejects.toThrow("10 ký tự");
    await expect(signUp("test@example.com", "MilkTea2026!", "<script>")).rejects.toThrow("2–30");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not pretend a cloud save exists when Supabase is unconfigured", async () => {
    await expect(cloudAction(null, null)).rejects.toThrow("Chưa cấu hình");
  });
});
