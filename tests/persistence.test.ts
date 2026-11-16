import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { db, load, save, parseSave } from "../src/persistence";
import { initial, validate } from "../src/engine";
import { Bot } from "../src/qa/bot";
afterEach(async () => {
  await db.delete({ disableAutoOpen: false });
});
describe("IndexedDB persistence", () => {
  it("saves and reloads cash, stock, upgrades and in-progress cup", async () => {
    const b = new Bot()
      .stock()
      .act({ type: "upgrade", id: "sealer" })
      .act({ type: "open" })
      .act({ type: "cup", size: "M" })
      .act({ type: "pour", tea: "milk", dt: 1 });
    await save(b.state);
    const actual = await load();
    expect(actual).toEqual(b.state);
  });
  it("serializes successive autosaves, retaining the newest snapshot", async () => {
    const a = initial(),
      b = initial();
    b.money = 390000;
    await Promise.all([save(a), save(b)]);
    expect((await load()).money).toBe(390000);
  });
  it("migrates a real v1 IndexedDB record to schema 2", async () => {
    const old = new Dexie("TiemTraMay");
    old.version(1).stores({ saves: "id" });
    const data: Record<string, unknown> = { ...initial(), version: 1 };
    delete data.debt;
    delete data.creditDay;
    delete data.feedback;
    await old.table("saves").put({ id: "main", data });
    old.close();
    const migrated = await load();
    expect(migrated.version).toBe(2);
    expect(migrated.debt).toBe(0);
    expect(migrated.feedback).toBeNull();
    expect(validate(migrated)).toBe(true);
  });
  it("backs up a genuine legacy record before adding progression without granting money", async () => {
    const legacy = initial();
    delete legacy.progression;
    legacy.money = 87654;
    await db.saves.put({ id: "main", data: legacy });
    const migrated = await load();
    expect(migrated.money).toBe(87654);
    expect(migrated.progression?.schema).toBe(1);
    expect((await db.backups.get("before-v2"))?.data).toEqual(legacy);
    await save({ ...migrated, money: 87000 });
    expect((await load()).money).toBe(87000);
    expect((await db.backups.get("before-v2"))?.data.money).toBe(87654);
  });
  it("rejects malformed imports and never writes invalid records", async () => {
    const s = initial();
    s.stock.milk = [{ qty: -1, expires: 4 }];
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    await expect(save(s)).rejects.toThrow();
    for (const patch of [
      { cup: {} },
      { orders: [{}] },
      { decor: {} },
      { stats: { revenue: NaN } },
      { upgrades: { staff: 99 } },
      { sound: "yes" },
    ])
      expect(validate({ ...initial(), ...patch })).toBe(false);
  });
});
