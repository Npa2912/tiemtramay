import { describe, expect, it } from "vitest";
import { initial, reduce, validate, invariant, quantity, type Action } from "../src/engine";
import { parseSave } from "../src/persistence";
import { quests, events } from "../src/progression";
import { Bot } from "../src/qa/bot";
import { recipes, supplies } from "../src/catalog";

const select = (id: number) => ({ type: "selectOrder", id }) as Action;

describe("2.0 startup capital and compatibility", () => {
  it("grants exactly one million only on creation and preserves old balances on import", () => {
    const fresh = initial();
    expect(fresh.money).toBe(1_000_000);
    const existing = { ...fresh, money: 456_000, day: 15, stats: { ...fresh.stats, day: 15 } };
    const imported = parseSave(JSON.stringify(existing));
    expect(imported.money).toBe(456_000);
    expect(imported.day).toBe(15);
    const again = parseSave(JSON.stringify(imported));
    expect(again.money).toBe(456_000);
    expect(validate(again)).toBe(true);
  });

  it("does not grant capital again on a day transition or harmless action", () => {
    let state = initial();
    state.money = 0;
    state = reduce(state, { type: "tutorial" });
    expect(state.money).toBe(0);
    state = reduce(state, { type: "close" });
    const balance = state.money;
    state = reduce(state, { type: "next" });
    expect(state.money).toBe(balance);
  });
});

describe("2.0 actionable orders", () => {
  it("selects an existing waiting order and rejects a missing ID", () => {
    const bot = new Bot().stock().act({ type: "open" });
    expect(bot.state.orders.length).toBeGreaterThan(1);
    const id = bot.state.orders[1].id;
    bot.act(select(id));
    expect(bot.state.orders[0].id).toBe(id);
    const ids = bot.state.orders.map((order) => order.id);
    bot.act(select(999999));
    expect(bot.state.orders.map((order) => order.id)).toEqual(ids);
  });

  it("keeps an in-progress cup paired with its selected customer", () => {
    const bot = new Bot().stock().act({ type: "open" });
    const id = bot.state.orders[0].id;
    bot.act({ type: "cup", size: "M" });
    bot.act(select(bot.state.orders[1].id));
    expect(bot.state.orders[0].id).toBe(id);
    expect(bot.state.cup).not.toBeNull();
  });

  it("never requests unlocked drinks whose required tea is missing", () => {
    for (let seed = 1; seed <= 40; seed++) {
    const bot = new Bot(seed * 7919);
    bot.state.day = 12;
    bot.state.stats.day = 12;
    for (const id of ["tea-matcha", "tea-green", "tea-oolong", "tea-thai"])
      bot.act({ type: "upgrade", id });
    for (const id of ["milk", "black", "milkPowder", "pearl", "cupM", "lid", "sugar", "ice"])
      bot.act({ type: "buy", id });
    bot.act({ type: "open" });
    expect(bot.state.phase).toBe("open");
    for (const order of bot.state.orders) {
      expect(quantity(bot.state, order.recipe.tea)).toBeGreaterThan(0);
      expect(["milk", "black"]).toContain(order.recipe.tea);
      expect(recipes.some((r) => r.id === order.recipe.id)).toBe(true);
    }
    }
  });
});

describe("2.0 settlement consistency", () => {
  it("includes event tips on the final order in the persisted daily receipt", () => {
    const bot = new Bot();
    bot.state.progression!.boosts.tip = 0.08;
    bot.stock().act({ type: "open" });
    while (bot.state.phase === "open") bot.brew();
    const summary = bot.state.stats;
    expect(summary.profit).toBeCloseTo(summary.revenue - summary.cogs - summary.expenses - summary.waste);
    expect(bot.state.history.at(-1)).toEqual(summary);
  });
});

describe("2.0 thirty-day strategy evidence", () => {
  for (const strategy of ["new-player", "saving", "upgrades", "mistakes", "quests"] as const) {
    it(`simulates 30 days: ${strategy}`, () => {
      const bot = new Bot(1234);
      const evidence: { day: number; cash: number; served: number; lost: number; profit: number; reputation: number }[] = [];
      for (let day = 1; day <= 30; day++) {
        const activeEvent = events.find((event) => event.id === bot.state.progression?.event?.id);
        if (activeEvent) {
          const choice = activeEvent.choices.find((entry) => !entry.requires && !entry.cost && entry.id !== "accept");
          if (choice) bot.act({ type: "eventChoice", choice: choice.id });
        }
        if (strategy === "quests") {
          for (const quest of quests) {
            const progress = bot.state.progression;
            if (progress && progress.metrics[quest.metric] >= quest.target && !progress.claimed.includes(quest.id))
              bot.act({ type: "claimQuest", id: quest.id });
          }
        }
        if (strategy === "upgrades") {
          for (const id of ["sealer", "counter", "storage", "fridge", "decor"])
            bot.act({ type: "upgrade", id });
        }
        if (strategy === "quests" || strategy === "upgrades") {
          bot.day();
        } else {
          bot.stock().act({ type: "open" });
          expect(bot.state.phase).toBe("open");
          let guard = 0;
          while (bot.state.phase === "open" && guard++ < 60) {
            if (strategy === "new-player" && guard % 3 === 0) {
              for (let delay = 0; delay < 120; delay++) bot.act({ type: "tick", dt: 1 });
              if (bot.state.phase !== "open" || !bot.state.orders.length) break;
            }
            bot.brew(strategy === "mistakes" && guard % 2 === 0);
          }
          expect(bot.state.phase).toBe("summary");
        }
        invariant(bot.state);
        expect(validate(bot.state)).toBe(true);
        for (const supply of supplies) expect(quantity(bot.state, supply.id)).toBeGreaterThanOrEqual(0);
        evidence.push({ day, cash: bot.state.money, served: bot.state.stats.served, lost: bot.state.stats.lost, profit: Math.round(bot.state.stats.profit), reputation: bot.state.reputation });
        bot.reload().next();
      }
      expect(evidence).toHaveLength(30);
      console.log(`V2_STRATEGY_${strategy}`, JSON.stringify({
        final: evidence.at(-1),
        minCash: Math.min(...evidence.map((row) => row.cash)),
        totalServed: evidence.reduce((sum, row) => sum + row.served, 0),
        totalLost: evidence.reduce((sum, row) => sum + row.lost, 0),
        eventsResolved: bot.state.progression?.eventHistory.length ?? 0,
        rewardsClaimed: bot.state.progression?.claimed.length ?? 0,
        accurateServed: bot.state.progression?.metrics.accurate ?? 0,
        averageDailyProfit: Math.round(evidence.reduce((sum, row) => sum + row.profit, 0) / evidence.length),
        milestones: evidence.filter((row) => [1, 7, 15, 30].includes(row.day)),
      }));
    });
  }
});
