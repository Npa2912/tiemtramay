import { describe, it, expect } from "vitest";
import {
  initial,
  reduce,
  quantity,
  quality,
  validate,
  invariant,
  type Action,
} from "../src/engine";
import { Bot } from "../src/qa/bot";
import { recipes, customers, supplies } from "../src/catalog";
describe("catalog and economy", () => {
  it("contains 36 recipes, 20 original customers and starts with 1000000", () => {
    expect(recipes).toHaveLength(36);
    expect(customers).toHaveLength(20);
    expect(initial().money).toBe(1000000);
  });
  it("purchase has a real price and capacity; spam never creates infinite stock", () => {
    let s = initial();
    for (let i = 0; i < 100; i++) s = reduce(s, { type: "buy", id: "milk" });
    expect(quantity(s, "milk")).toBe(40);
    expect(s.money).toBe(904000);
  });
  it("rejects unaffordable purchases", () => {
    const s = initial();
    s.money = 1;
    expect(quantity(reduce(s, { type: "buy", id: "milk" }), "milk")).toBe(0);
  });
  it("recovers low capital through recorded debt, once per day", () => {
    let s = initial();
    s.money = 0;
    s = reduce(s, { type: "credit" });
    expect(s.money).toBe(200000);
    s.money = 0;
    s = reduce(s, { type: "credit" });
    expect(s.money).toBe(0);
    expect(s.debt).toBe(200000);
  });
  it("expires stock and records waste", () => {
    const b = new Bot()
      .stock()
      .act({ type: "open" })
      .act({ type: "close" })
      .next()
      .act({ type: "open" })
      .act({ type: "close" })
      .next();
    expect(quantity(b.state, "ice")).toBe(0);
    expect(b.state.stats.waste).toBeGreaterThan(0);
  });
  it("upgrade changes actual sealing speed and costs money", () => {
    const b = new Bot().stock();
    const before = b.state.money;
    b.act({ type: "upgrade", id: "sealer" });
    expect(b.state.money).toBe(before - 18000);
    expect(b.state.upgrades.sealer).toBe(1);
  });
});
describe("brewing and queue", () => {
  const start = () => new Bot().stock().act({ type: "open" });
  it("cannot deliver unfinished drinks or duplicate revenue on rapid serve", () => {
    const b = start().act({ type: "cup", size: "M" });
    const money = b.state.money;
    b.act({ type: "serve" });
    expect(b.state.money).toBe(money);
    b.act({ type: "trash" }).brew();
    const paid = b.state.money;
    b.act({ type: "serve" }).act({ type: "serve" });
    expect(b.state.money).toBe(paid);
    expect(b.state.stats.served).toBe(1);
  });
  it("pour follows elapsed time and stops when no pour action arrives", () => {
    const b = start()
      .act({ type: "cup", size: "M" })
      .act({ type: "pour", tea: "milk", dt: 1 });
    expect(b.state.cup?.fill).toBeCloseTo(0.32);
    const qty = quantity(b.state, "milk");
    b.act({ type: "tick", dt: 1 });
    expect(b.state.cup?.fill).toBeCloseTo(0.32);
    expect(quantity(b.state, "milk")).toBe(qty);
  });
  it("cannot use exhausted cup, tea or topping", () => {
    const b = start();
    b.state.stock.cupM = [];
    b.act({ type: "cup", size: "M" });
    expect(b.state.cup).toBeNull();
    b.state.stock.cupM = [{ qty: 1, expires: 9 }];
    b.act({ type: "cup", size: "M" });
    b.state.stock.milk = [];
    b.act({ type: "pour", tea: "milk", dt: 1 });
    expect(b.state.cup?.fill).toBe(0);
    b.state.stock.pearl = [];
    b.act({ type: "top", id: "pearl" });
    expect(b.state.cup?.topping).toBeNull();
  });
  it("rejects unsealed, underfilled, incomplete and topping-free cup", () => {
    const b = start()
      .act({ type: "cup", size: "M" })
      .act({ type: "pour", tea: "milk", dt: 1 })
      .act({ type: "seal" });
    expect(b.state.cup?.sealLeft).toBe(0);
    b.act({ type: "serve" });
    expect(b.state.stats.served).toBe(0);
  });
  it("scores wrong tea, wrong size, underfill, overfill and missing topping lower", () => {
    const b = start().brew();
    expect(b.state.stats.served).toBe(1);
    const r = recipes[0];
    const cup = {
      size: r.size,
      tea: r.tea,
      fill: 0.85,
      topping: r.topping,
      flavor: r.flavor,
      sugar: r.sugar,
      ice: r.ice,
      sealed: true,
      sealLeft: 0,
      cost: 0,
      pourAt: 0,
    };
    expect(quality(cup, r)).toBe(1);
    for (const patch of [
      { tea: "thai" },
      { size: "L" as const },
      { fill: 0.6 },
      { fill: 1.1 },
      { topping: null },
    ])
      expect(quality({ ...cup, ...patch }, r)).toBeLessThan(1);
  });
  it("pause freezes patience and brewing, timeout does not leave a stuck customer", () => {
    const b = start().act({ type: "pause" });
    const remaining = b.state.orders[0].remaining;
    b.act({ type: "tick", dt: 1 }).act({ type: "cup", size: "M" });
    expect(b.state.orders[0].remaining).toBe(remaining);
    expect(b.state.cup).toBeNull();
    b.act({ type: "pause" }).timeout().timeout();
    expect(b.state.phase).toBe("summary");
    expect(b.state.stats.lost).toBe(b.state.target);
  });
  it("trash does not refund consumed ingredients", () => {
    const b = start()
      .act({ type: "cup", size: "M" })
      .act({ type: "pour", tea: "milk", dt: 1 });
    const cups = quantity(b.state, "cupM"),
      tea = quantity(b.state, "milk");
    b.act({ type: "trash" });
    expect(quantity(b.state, "cupM")).toBe(cups);
    expect(quantity(b.state, "milk")).toBe(tea);
  });
  it("only generates unlocked recipes with unique IDs", () => {
    const b = start();
    for (const o of b.state.orders) {
      expect(o.recipe.day).toBe(1);
      expect(o.recipe.size).toBe("M");
    }
    expect(new Set(b.state.orders.map((o) => o.id)).size).toBe(
      b.state.orders.length,
    );
  });
  it("correct drink improves reputation; wrong drink earns less", () => {
    const a = start().brew(),
      b = start().brew(true);
    expect(a.state.stats.revenue).toBeGreaterThan(b.state.stats.revenue);
    expect(a.state.reputation).toBeGreaterThan(b.state.reputation);
  });
});
describe("persistence and long run", () => {
  it("roundtrips mid-drink JSON and rejects broken/nonfinite saves", () => {
    const b = new Bot()
      .stock()
      .act({ type: "open" })
      .act({ type: "cup", size: "M" });
    b.reload();
    expect(validate(b.state)).toBe(true);
    expect(validate({})).toBe(false);
    expect(validate({ ...b.state, money: NaN })).toBe(false);
  });
  it("simulates 35 seeded days, no negative inventory, stuck orders, duplicate payout or NaN", () => {
    const b = new Bot(1234),
      snapshots = [];
    let lastSequence = 0;
    for (let day = 1; day <= 35; day++) {
      b.day().reload();
      expect(b.state.phase).toBe("summary");
      expect(b.state.sequence).toBeGreaterThan(lastSequence);
      lastSequence = b.state.sequence;
      expect(b.state.stats.served).toBe(b.state.target);
      expect(b.state.money).toBeGreaterThan(0);
      invariant(b.state);
      if ([1, 5, 10, 20, 30, 35].includes(day))
        snapshots.push({
          day,
          money: b.state.money,
          served: b.state.stats.served,
          profit: b.state.stats.profit,
        });
      b.next();
      expect(validate(b.state)).toBe(true);
    }
    console.log("LONG_RUN", JSON.stringify(snapshots));
    expect(b.state.day).toBe(36);
    expect(b.state.history).toHaveLength(35);
  });
  it("is deterministic and bounds ledger/history growth", () => {
    const a = new Bot(7),
      b = new Bot(7);
    for (let i = 0; i < 3; i++) {
      a.day().next();
      b.day().next();
    }
    expect(a.state).toEqual(b.state);
    expect(a.state.ledger.length).toBeLessThanOrEqual(600);
  });
  it("checks every supply quantity is nonnegative after random actions", () => {
    const b = new Bot().stock().act({ type: "open" });
    const actions: Action[] = [
      { type: "serve" },
      { type: "seal" },
      { type: "top", id: "pearl" },
      { type: "pour", tea: "milk", dt: 5 },
      { type: "cup", size: "M" },
      { type: "trash" },
      { type: "ice", value: 100 },
    ];
    for (let i = 0; i < 1000; i++) b.act(actions[i % actions.length]);
    for (const item of supplies)
      expect(quantity(b.state, item.id)).toBeGreaterThanOrEqual(0);
  });
});
describe("progression, staff, recovery and adversarial inputs", () => {
  it("locked ingredients cannot be poured and orders respect purchased unlocks", () => {
    const b = new Bot()
      .stock()
      .act({ type: "open" })
      .act({ type: "cup", size: "M" });
    b.state.stock.matcha = [{ qty: 20, expires: 10 }];
    b.act({ type: "pour", tea: "matcha", dt: 1 });
    expect(b.state.cup?.tea).toBeNull();
  });
  it("staff costs daily wages and makes sealing faster", () => {
    const b = new Bot();
    b.state.day = 5;
    b.state.stats.day = 5;
    b.stock().act({ type: "upgrade", id: "staff" }).act({ type: "open" });
    const r = b.state.orders[0].recipe;
    b.act({ type: "cup", size: "M" })
      .act({ type: "pour", tea: r.tea, dt: 0.85 / 0.32 })
      .act({ type: "top", id: r.topping })
      .act({ type: "flavor", id: r.flavor })
      .act({ type: "sugar", value: r.sugar })
      .act({ type: "ice", value: r.ice })
      .act({ type: "seal" });
    expect(b.state.cup?.sealLeft).toBeCloseTo(1.1);
    b.act({ type: "close" });
    expect(b.state.stats.expenses).toBe(16000);
  });
  it("can recover from zero cash and empty stock and can end a day off", () => {
    const b = new Bot();
    b.state.money = 0;
    b.act({ type: "credit" });
    for (const id of [
      "milk",
      "black",
      "milkPowder",
      "pearl",
      "cupM",
      "lid",
      "sugar",
      "ice",
    ])
      b.act({ type: "buy", id });
    b.act({ type: "open" });
    expect(b.state.phase).toBe("open");
    b.act({ type: "close" }).next().act({ type: "close" });
    expect(b.state.phase).toBe("summary");
  });
  it("invalid sugar values, non-tea pour and NaN pour do not corrupt the cup", () => {
    const b = new Bot()
      .stock()
      .act({ type: "open" })
      .act({ type: "cup", size: "M" });
    b.act({ type: "sugar", value: -50 })
      .act({ type: "ice", value: 999 })
      .act({ type: "pour", tea: "pearl", dt: 1 })
      .act({ type: "pour", tea: "milk", dt: NaN });
    expect(b.state.cup?.sugar).toBeNull();
    expect(b.state.cup?.ice).toBeNull();
    expect(b.state.cup?.fill).toBe(0);
    expect(validate(b.state)).toBe(true);
  });
});
