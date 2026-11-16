import { describe, it, expect } from "vitest";
import { initial, reduce, validate, type State } from "../src/engine";
import { createIncidents, dailyRoll, securityActive } from "../src/incidents";
import { Bot } from "../src/qa/bot";
function brewing(flags: Partial<NonNullable<State["incidents"]>> = {}) {
  const bot = new Bot()
    .stock()
    .act({ type: "open" })
    .act({ type: "cup", size: "M" });
  bot.state.incidents = {
    ...createIncidents(42, bot.state.day),
    theftPlanned: false,
    powerPlanned: false,
    machinePlanned: false,
    ...flags,
  };
  return bot.state;
}
const pour = (s: State) => reduce(s, { type: "pour", tea: "milk", dt: 0.2 });
describe("daily risks and expiring protection", () => {
  it("rolls once per day, about35% theft and20% power independently", () => {
    let theft = 0,
      power = 0;
    for (let seed = 1; seed <= 10000; seed++) {
      const i = createIncidents(seed, 1);
      theft += Number(i.theftPlanned);
      power += Number(i.powerPlanned);
      expect(dailyRoll(seed, 1, 101)).toBe(dailyRoll(seed, 1, 101));
    }
    expect(theft / 10000).toBeGreaterThan(0.33);
    expect(theft / 10000).toBeLessThan(0.37);
    expect(power / 10000).toBeGreaterThan(0.18);
    expect(power / 10000).toBeLessThan(0.22);
  });
  it("steals10% of current capital once, persists through reload and can happen the following day", () => {
    let s = brewing({ theftPlanned: true });
    const capital = s.money;
    s = pour(s);
    expect(s.money).toBe(capital - Math.floor(capital * 0.1));
    const lost = s.money;
    s = pour(JSON.parse(JSON.stringify(s)));
    expect(s.money).toBe(lost);
    expect(validate(s)).toBe(true);
    s = reduce(reduce(s, { type: "close" }), { type: "next" });
    expect(s.incidents?.theftChecked).toBe(false);
    expect(s.incidents?.day).toBe(2);
  });
  it("20k lock prevents all loss today, expires tomorrow and can be repurchased", () => {
    let s = initial();
    s = reduce(s, { type: "security", id: "lock" });
    expect(s.money).toBe(980000);
    expect(securityActive(s, "lock")).toBe(true);
    s = {
      ...brewing({ theftPlanned: true, expires: { lock: 1 } }),
      progression: s.progression,
    };
    const balance = s.money;
    s = pour(s);
    expect(s.money).toBe(balance);
    s = reduce(reduce(s, { type: "close" }), { type: "next" });
    expect(securityActive(s, "lock")).toBe(false);
    const before = s.money;
    s = reduce(s, { type: "security", id: "lock" });
    expect(s.money).toBe(before - 20000);
    expect(s.incidents?.expires.lock).toBe(2);
  });
  it("camera lasts exactly10 days including purchase day and must be bought again", () => {
    let s = reduce(initial(), { type: "security", id: "camera" });
    expect(s.incidents?.expires.camera).toBe(10);
    for (let day = 1; day < 10; day++)
      s = reduce(reduce(s, { type: "close" }), { type: "next" });
    expect(s.day).toBe(10);
    expect(securityActive(s, "camera")).toBe(true);
    s = reduce(reduce(s, { type: "close" }), { type: "next" });
    expect(securityActive(s, "camera")).toBe(false);
    const before = s.money;
    s = reduce(s, { type: "security", id: "camera" });
    expect(s.money).toBe(before - 50000);
    expect(s.incidents?.expires.camera).toBe(20);
  });
  it("permanent safe limits loss to5% and remains purchased on later days", () => {
    let s = brewing({ theftPlanned: true });
    s = reduce(s, { type: "security", id: "safe" });
    const capital = s.money;
    s = pour(s);
    expect(s.money).toBe(capital - Math.floor(capital * 0.05));
    s = reduce(reduce(s, { type: "close" }), { type: "next" });
    expect(securityActive(s, "safe")).toBe(true);
  });
  it("camera can recover a recorded same-day loss once, without creating extra money", () => {
    let s = brewing({ theftPlanned: true });
    s = reduce(s, { type: "security", id: "camera" });
    const before = s.money;
    s = pour(s);
    expect(s.money).toBeLessThan(before);
    s = reduce(s, { type: "recoverTheft" });
    expect(s.money).toBe(before);
    s = reduce(s, { type: "recoverTheft" });
    expect(s.money).toBe(before);
    let unrecorded = pour(brewing({ theftPlanned: true }));
    unrecorded = reduce(unrecorded, { type: "security", id: "camera" });
    const balance = unrecorded.money;
    expect(reduce(unrecorded, { type: "recoverTheft" }).money).toBe(balance);
  });
});
describe("real production incidents", () => {
  it("power outage interrupts pouring, freezes customers and cup, waits60 seconds and survives reload", () => {
    let s = brewing({ powerPlanned: true });
    const before = structuredClone(s);
    s = pour(s);
    expect(s.incidents?.powerLeft).toBe(60);
    expect(s.cup?.fill).toBe(0);
    s = reduce(s, { type: "tick", dt: 1 });
    expect(s.incidents?.powerLeft).toBe(59);
    expect(s.orders).toEqual(before.orders);
    expect(pour(s).cup?.fill).toBe(0);
    s = JSON.parse(JSON.stringify(s));
    for (let t = 0; t < 59; t++) s = reduce(s, { type: "tick", dt: 1 });
    expect(s.incidents?.powerLeft).toBe(0);
    s = pour(s);
    expect(s.cup!.fill).toBeGreaterThan(0);
  });
  it("generator immediately keeps production running and power cannot fire twice today", () => {
    let s = brewing({ powerPlanned: true });
    s = reduce(s, { type: "security", id: "generator" });
    s = pour(s);
    expect(s.incidents?.powerLeft).toBe(0);
    expect(s.cup!.fill).toBeGreaterThan(0);
    expect(s.incidents?.powerChecked).toBe(true);
    s = pour(s);
    expect(s.incidents?.powerLeft).toBe(0);
  });
  it("machine breaks mid-work, repair50k applies once and preserves current cup", () => {
    let s = pour(brewing({ machinePlanned: true }));
    expect(s.incidents?.machineBroken).toBe(true);
    expect(s.cup?.fill).toBe(0);
    const balance = s.money;
    s = reduce(s, { type: "repairMachine" });
    expect(s.money).toBe(balance - 50000);
    expect(s.incidents?.machineBroken).toBe(false);
    expect(reduce(s, { type: "repairMachine" }).money).toBe(s.money);
    expect(pour(s).cup!.fill).toBeGreaterThan(0);
  });
  it("25k backup resumes production permanently; insufficient funds never partially charged", () => {
    let s = pour(brewing({ machinePlanned: true }));
    const before = s.money;
    s = reduce(s, { type: "security", id: "backup" });
    expect(s.money).toBe(before - 25000);
    expect(s.incidents?.machineBroken).toBe(false);
    expect(securityActive(s, "backup")).toBe(true);
    const poor = pour(brewing({ machinePlanned: true }));
    poor.money = 100;
    expect(reduce(poor, { type: "repairMachine" }).money).toBe(100);
    expect(
      reduce(poor, { type: "security", id: "backup" }).incidents?.machineBroken,
    ).toBe(true);
  });
  it("new security losses and repair expenses reconcile at settlement", () => {
    let s = pour(brewing({ theftPlanned: true }));
    const amount = s.incidents!.theft!.amount;
    s = reduce(s, { type: "close" });
    expect(s.stats.expenses).toBe(8000 + amount);
    expect(s.stats.profit).toBe(
      s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste,
    );
  });
  it("zero balance never becomes negative or pretends a lock was purchased", () => {
    let s = brewing({ theftPlanned: true });
    s.money = 0;
    s = pour(s);
    expect(s.money).toBe(0);
    expect(s.incidents?.theft?.amount).toBe(0);
    expect(s.message).toContain("không có số dư");
  });
  it("rejects corrupted incident states", () => {
    expect(
      validate({
        ...initial(),
        incidents: { ...createIncidents(1, 1), powerLeft: -1 },
      }),
    ).toBe(false);
    expect(
      validate({
        ...initial(),
        incidents: { ...createIncidents(1, 1), expires: { camera: NaN } },
      }),
    ).toBe(false);
  });
});
