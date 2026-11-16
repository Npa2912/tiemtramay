import { describe, it, expect } from "vitest";
import { initial, reduce } from "../src/engine";
import { customers, recipes } from "../src/catalog";
import {
  createProgression,
  events,
  migrateProgression,
  quests,
  reduceProgression,
  validProgression,
} from "../src/progression";
function prepared() {
  const s = migrateProgression(initial(1234));
  s.day = 15;
  s.money = 1000000;
  return s;
}
describe("progression and event engine", () => {
  it("has complete uniquely identified configured content", () => {
    expect(quests.filter((q) => q.kind === "main")).toHaveLength(30);
    expect(quests.filter((q) => q.kind === "side")).toHaveLength(50);
    expect(quests.filter((q) => q.kind === "achievement")).toHaveLength(20);
    expect(new Set(quests.map((q) => q.id)).size).toBe(100);
    expect(events).toHaveLength(12);
    expect(new Set(events.map((e) => e.id)).size).toBe(12);
    expect(new Set(quests.map((q) => q.metric)).size).toBe(20);
  });
  it("preserves old save money and progress when adding optional state", () => {
    const old = initial();
    delete old.progression;
    old.money = 12345;
    old.day = 22;
    const s = migrateProgression(old);
    expect(s.money).toBe(12345);
    expect(s.day).toBe(22);
    expect(s.progression.ownerName).toBe("Chủ Tiệm An");
    expect(validProgression(s.progression)).toBe(true);
    expect("progression" in old).toBe(false);
  });
  it("rejects corrupt progression instead of silently resetting it", () => {
    const s = prepared();
    s.progression.metrics.served = NaN;
    expect(() => migrateProgression(s)).toThrow();
  });
  it("pays a completed quest once only", () => {
    let s = prepared();
    s.progression.metrics.served = 1;
    s = reduceProgression(s, { type: "claimQuest", id: "main-1" });
    const money = s.money;
    expect(money).toBe(1003000);
    s = reduceProgression(s, { type: "claimQuest", id: "main-1" });
    expect(s.money).toBe(money);
    expect(s.progression.claimed).toEqual(["main-1"]);
  });
  it("does not pay incomplete or unknown quests", () => {
    const s = prepared();
    expect(
      reduceProgression(s, { type: "claimQuest", id: "main-1" }).money,
    ).toBe(s.money);
    expect(
      reduceProgression(s, { type: "claimQuest", id: "forged" }).money,
    ).toBe(s.money);
  });
  it("caps theft loss, requires camera and cannot charge twice", () => {
    let s = prepared();
    s.money = 10000;
    s.progression.event = { id: "theft", day: 15 };
    expect(
      reduceProgression(s, { type: "eventChoice", choice: "camera" })
        .progression.event,
    ).not.toBeNull();
    s = reduceProgression(s, { type: "eventChoice", choice: "continue" });
    expect(s.money).toBe(9500);
    expect(s.progression.eventHistory).toHaveLength(1);
    expect(
      reduceProgression(s, { type: "eventChoice", choice: "continue" }).money,
    ).toBe(9500);
  });
  it("camera resolves discrepancy without blaming staff or losing money", () => {
    let s = prepared();
    s.progression.security.camera = 1;
    s.progression.event = { id: "theft", day: 15 };
    s = reduceProgression(s, { type: "eventChoice", choice: "camera" });
    expect(s.money).toBe(1000000);
    expect(s.message).toContain("Chưa có bằng chứng");
  });
  it("affordable choice is atomic and insufficient cost leaves event pending", () => {
    let s = prepared();
    s.money = 100;
    s.progression.event = { id: "machine", day: 15 };
    s = reduceProgression(s, { type: "eventChoice", choice: "repair" });
    expect(s.money).toBe(100);
    expect(s.progression.event?.id).toBe("machine");
    expect(s.progression.eventHistory).toHaveLength(0);
  });
  it("bulk order requires all materials and consumes once", () => {
    let s = prepared();
    s.progression.event = { id: "bulk", day: 15 };
    const noStock = reduceProgression(s, {
      type: "eventChoice",
      choice: "accept",
    });
    expect(noStock.money).toBe(s.money);
    expect(noStock.progression.event).not.toBeNull();
    for (const [id, qty] of Object.entries({
      milk: 5,
      cupM: 5,
      lid: 5,
      pearl: 5,
      milkPowder: 2,
    }))
      s.stock[id] = [{ qty, expires: 20 }];
    s = reduceProgression(s, { type: "eventChoice", choice: "accept" });
    expect(s.money).toBe(1100000);
    expect(s.stock.milk).toEqual([]);
    expect(
      reduceProgression(s, { type: "eventChoice", choice: "accept" }).money,
    ).toBe(1100000);
  });
  it("hires and trains with day, cash, role and level constraints", () => {
    let s = prepared();
    s = reduceProgression(s, { type: "hire", id: "barista" });
    expect(s.money).toBe(955000);
    expect(s.progression.staff.barista).toEqual({ level: 1, active: true });
    const again = reduceProgression(s, { type: "hire", id: "barista" });
    expect(again.money).toBe(s.money);
    s = reduceProgression(s, { type: "train", id: "barista" });
    expect(s.money).toBe(945000);
    expect(s.progression.staff.barista.level).toBe(2);
    expect(s.progression.metrics.training).toBe(1);
  });
  it("does not let open-shop hiring change finances", () => {
    const s = prepared();
    s.phase = "open";
    expect(reduceProgression(s, { type: "hire", id: "manager" }).money).toBe(
      s.money,
    );
  });
  it("applies staff sealing speed and charges wages on summary transition only", () => {
    const s = prepared();
    s.phase = "open";
    s.progression.staff.barista = { level: 2, active: true };
    s.cup = {
      size: "M",
      tea: "milk",
      fill: 0.85,
      topping: "pearl",
      flavor: "plain",
      sugar: 70,
      ice: 50,
      sealed: false,
      sealLeft: 0,
      cost: 5000,
      pourAt: 0,
    };
    s.stock.lid = [{ qty: 10, expires: 999 }];
    const sealed = reduce(s, { type: "seal" });
    expect(sealed.cup?.sealLeft).toBeCloseTo(1.3);
    const summary = reduce(sealed, { type: "close" });
    expect(summary.money).toBe(988000);
    expect(summary.stats.expenses).toBe(12000);
    expect(reduce(summary, { type: "close" }).money).toBe(summary.money);
  });
  it("power outage slowdown persists through validation", () => {
    let s = prepared();
    s.progression.event = { id: "power", day: 15 };
    s = reduceProgression(s, { type: "eventChoice", choice: "wait" });
    expect(s.progression.boosts.seal).toBe(-0.5);
    expect(validProgression(s.progression)).toBe(true);
    expect(() => migrateProgression(s)).not.toThrow();
  });
  it("does not replace unresolved events when days advance", () => {
    const s = prepared();
    s.phase = "summary";
    s.progression.event = { id: "lost", day: 14 };
    const n = reduce(s, { type: "next" });
    expect(n.progression?.event).toEqual(s.progression.event);
  });
  it("validates owner names and effect preference without changing money", () => {
    const s = prepared();
    const named = reduceProgression(s, {
      type: "ownerName",
      name: "  Chủ  Tiệm Hà  ",
    });
    expect(named.progression.ownerName).toBe("Chủ Tiệm Hà");
    expect(named.money).toBe(s.money);
    expect(
      reduceProgression(named, { type: "ownerName", name: "<script>" })
        .progression.ownerName,
    ).toBe("Chủ Tiệm Hà");
    expect(
      reduceProgression(named, { type: "reducedMotion" }).progression
        .reducedMotion,
    ).toBe(true);
  });
  it("every configured event choice preserves active cups and validates its saved result", () => {
    for (const event of events)
      for (const choice of event.choices) {
        const s = prepared();
        s.progression.event = { id: event.id, day: s.day };
        for (const id of ["lock", "camera", "safe", "generator", "backup"])
          s.progression.security[id] = 1;
        for (const id of ["milk", "cupM", "lid", "pearl", "milkPowder"])
          s.stock[id] = [{ qty: 20, expires: 99 }];
        s.cup = {
          size: "M",
          tea: "milk",
          fill: 0.85,
          topping: "pearl",
          flavor: "plain",
          sugar: 70,
          ice: 50,
          sealed: false,
          sealLeft: 0,
          cost: 5000,
          pourAt: 0,
        };
        const next = reduce(s, { type: "eventChoice", choice: choice.id });
        expect(next.cup, `${event.id}/${choice.id}`).toEqual(s.cup);
        expect(next.money).toBeGreaterThanOrEqual(0);
        expect(
          validProgression(next.progression),
          `${event.id}/${choice.id}`,
        ).toBe(true);
        expect(next.progression?.event).toBeNull();
        expect(next.progression?.eventHistory).toHaveLength(1);
        for (const lots of Object.values(next.stock))
          for (const lot of lots) expect(lot.qty).toBeGreaterThanOrEqual(0);
      }
  });
  it("new order patience and manager discount use actual staff assignments", () => {
    let s = prepared();
    s.progression.staff.manager = { level: 2, active: true };
    const before = s.money;
    const bought = reduce(s, { type: "buy", id: "milk" });
    expect(before - bought.money).toBe(47040);
    s = prepared();
    s.progression.staff.server = { level: 2, active: true };
    for (const id of [
      "cupM",
      "lid",
      "milk",
      "black",
      "milkPowder",
      "pearl",
      "sugar",
      "ice",
    ])
      s.stock[id] = [{ qty: 20, expires: 99 }];
    const opened = reduce(s, { type: "open" });
    const noStaff = structuredClone(s);
    noStaff.progression.staff = {};
    const base = reduce(noStaff, { type: "open" });
    expect(opened.orders[0].remaining - base.orders[0].remaining).toBe(6);
  });
  it("keeps twenty stable portraits with at least fifteen distinct customer types", () => {
    expect(customers).toHaveLength(20);
    expect(
      new Set(customers.map((c) => c.personality)).size,
    ).toBeGreaterThanOrEqual(15);
    expect(
      customers.filter((c) => c.personality === "VIP").map((c) => c.id),
    ).toEqual([3, 7, 11, 15, 19]);
    expect(
      customers.every(
        (c) =>
          c.budget >= Math.max(...recipes.map((r) => r.price)) &&
          c.frequency > 0 &&
          c.dialogue.length > 0,
      ),
    ).toBe(true);
    expect(
      customers.every(
        (c) =>
          c.relationshipMilestones.map((m) => m.visits).join(",") === "3,10,25",
      ),
    ).toBe(true);
  });
  it("defers bulk catering while current shop orders have reserved ingredients", () => {
    const s = prepared();
    s.phase = "open";
    s.progression.event = { id: "bulk", day: s.day };
    for (const id of ["milk", "cupM", "lid", "pearl", "milkPowder"])
      s.stock[id] = [{ qty: 20, expires: 99 }];
    const result = reduce(s, { type: "eventChoice", choice: "accept" });
    expect(result.stock).toEqual(s.stock);
    expect(result.money).toBe(s.money);
    expect(result.progression?.event?.id).toBe("bulk");
  });
  it("carries prep event expenses into the final receipt once and resets next day", () => {
    const s = prepared();
    s.progression.event = { id: "machine", day: s.day };
    const repaired = reduce(s, { type: "eventChoice", choice: "repair" });
    expect(repaired.money).toBe(988000);
    expect(repaired.progression?.eventExpenses).toBe(12000);
    const summary = reduce(repaired, { type: "close" });
    expect(summary.stats.expenses).toBe(20000);
    expect(summary.stats.profit).toBe(-20000);
    expect(summary.history.at(-1)?.expenses).toBe(20000);
    expect(summary.progression?.eventExpenses).toBe(0);
    expect(reduce(summary, { type: "close" }).stats.expenses).toBe(20000);
    const next = reduce(summary, { type: "next" });
    expect(next.stats.expenses).toBe(0);
    expect(next.progression?.eventExpenses).toBe(0);
  });
  it("updates already closed receipt for a late event choice", () => {
    const s = prepared();
    let summary = reduce(s, { type: "close" });
    summary.progression!.event = { id: "machine", day: s.day };
    summary = reduce(summary, { type: "eventChoice", choice: "repair" });
    expect(summary.stats.expenses).toBe(20000);
    expect(summary.history.at(-1)?.expenses).toBe(20000);
    expect(summary.progression?.eventExpenses).toBe(0);
    expect(validProgression(summary.progression)).toBe(true);
  });
  it("accepts progression saves before the optional expense accumulator existed", () => {
    const p = createProgression();
    delete p.eventExpenses;
    expect(validProgression(p)).toBe(true);
    p.eventExpenses = -10;
    expect(validProgression(p)).toBe(false);
  });
  it("new progression objects do not share nested state", () => {
    const a = createProgression(),
      b = createProgression();
    a.metrics.served = 1;
    expect(b.metrics.served).toBe(0);
  });
});
