// Loaded only by Vite development builds with ?qa=1. Tree-shaken out of production.
import { Bot } from "./bot";
import { useGame, flushSave } from "../store";
import {
  invariant,
  initial,
  validate,
  type Action,
  type State,
} from "../engine";
import { load } from "../persistence";
export interface QA {
  reset: (seed: number) => void;
  act: (a: Action) => void;
  inspect: () => State;
  setIncidents: (patch: Partial<NonNullable<State["incidents"]>>) => void;
  brew: (wrong?: boolean) => void;
  simulateDays: (
    count: number,
  ) => Promise<{ day: number; cash: number; served: number; profit: number }[]>;
  reload: () => Promise<void>;
}
declare global {
  interface Window {
    mayQA?: QA;
  }
}
window.mayQA = {
  reset: (seed) => useGame.getState().replace(initial(seed)),
  act: (a) => {
    useGame.getState().act(a);
    invariant(useGame.getState().game);
  },
  inspect: () => structuredClone(useGame.getState().game),
  setIncidents: (patch) => {
    const s = structuredClone(useGame.getState().game);
    s.incidents = { ...s.incidents!, ...patch };
    if (!validate(s)) throw Error("Invalid incident fixture");
    useGame.getState().replace(s);
  },
  brew: (wrong) => {
    const bot = new Bot();
    bot.state = structuredClone(useGame.getState().game);
    bot.brew(wrong);
    useGame.getState().replace(bot.state);
  },
  simulateDays: async (count) => {
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw Error("QA count must be 1–100");
    const bot = new Bot();
    bot.state = structuredClone(useGame.getState().game);
    const samples = [];
    for (let i = 0; i < count; i++) {
      bot.day();
      invariant(bot.state);
      samples.push({
        day: bot.state.day,
        cash: bot.state.money,
        served: bot.state.stats.served,
        profit: bot.state.stats.profit,
      });
      useGame.getState().replace(bot.state);
      await flushSave();
      bot.state = await load();
      bot.next();
      useGame.getState().replace(bot.state);
      await flushSave();
    }
    return samples;
  },
  reload: async () => {
    await flushSave();
    useGame.getState().replace(await load());
  },
};
