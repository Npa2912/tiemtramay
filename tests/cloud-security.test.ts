import { beforeEach, describe, expect, it, vi } from "vitest";
import { initial } from "../src/engine";
import { Bot } from "../src/qa/bot";

let handler: (request: Request) => Promise<Response>;
let calls: { url: string; body: Record<string, unknown> | null }[];
let identityStatus: number;
let current: { state: ReturnType<typeof initial>; revision: number; updated_at: string } | null;
let replay: boolean;
beforeEach(async () => {
  vi.resetModules(); calls = []; identityStatus = 200; current = null; replay = false;
  vi.stubGlobal("Deno", { env: { get: (name: string) => ({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-secret", APP_ORIGIN: "https://game.example" })[name as "SUPABASE_URL"] }, serve: (callback: typeof handler) => { handler = callback; } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-a" }, { status: identityStatus });
    if (url.includes("game_saves?")) return Response.json(current ? [current] : []);
    if (url.includes("profiles?")) return Response.json([{ owner_name: "Chủ Tiệm An" }]);
    if (url.includes("game_requests?")) return Response.json(replay ? [{ revision: 1 }] : []);
    if (url.endsWith("rpc/commit_may_action")) return Response.json({ state: body.p_state, revision: (current?.revision || 0) + 1 });
    return Response.json({}, { status: 500 });
  }));
  await import("../supabase/functions/game/index");
});
const invoke = (body: unknown) => handler(new Request("https://test.supabase.co/functions/v1/game", { method: "POST", headers: { origin: "https://game.example", authorization: "Bearer test-user-token" }, body: JSON.stringify(body) }));
const requestId = "8bf971af-18d2-4f6e-9d4c-677d3ca6811a";
describe("cloud authority boundary (mock service)", () => {
  it("rejects invalid auth before reading any game data", async () => {
    identityStatus = 401;
    expect((await invoke({ action: null, revision: null, requestId })).status).toBe(401);
    expect(calls).toHaveLength(1);
  });
  it("creates server capital once and ignores a browser-supplied snapshot/user ID", async () => {
    const response = await invoke({ action: null, revision: null, requestId, user_id: "user-b", state: { money: 999999999 } });
    expect(response.status).toBe(200);
    expect((await response.json()).state.money).toBe(1000000);
    const commit = calls.find((call) => call.url.endsWith("rpc/commit_may_action"));
    expect(commit?.body?.p_user).toBe("user-a");
    expect(calls.find((call) => call.url.includes("game_saves?"))?.url).toContain("user_id=eq.user-a");
  });
  it("rejects stale revisions without attempting a write", async () => {
    current = { state: initial(), revision: 5, updated_at: new Date().toISOString() };
    const response = await invoke({ action: { type: "buy", id: "milk" }, revision: 4, requestId });
    expect(response.status).toBe(409);
    expect(calls.some((call) => call.url.endsWith("rpc/commit_may_action"))).toBe(false);
  });
  it("returns current state for a replay without applying the action twice", async () => {
    current = { state: initial(), revision: 5, updated_at: new Date().toISOString() }; replay = true;
    const response = await invoke({ action: { type: "buy", id: "milk" }, revision: 4, requestId });
    expect(response.status).toBe(200);
    expect((await response.json()).revision).toBe(5);
    expect(calls.some((call) => call.url.endsWith("rpc/commit_may_action"))).toBe(false);
  });
  it("does not accept a client-supplied financial action", async () => {
    const response = await invoke({ action: { type: "add_money", value: 100000000 }, revision: null, requestId });
    expect(response.status).toBe(400);
    expect(calls.some((call) => call.url.endsWith("rpc/commit_may_action"))).toBe(false);
  });
  it("advances the server-calculated shortfall and resumes the same shift", async () => {
    const bot = new Bot().stock().act({ type: "open" }).act({ type: "cup", size: "M" });
    bot.state.money = 30000;
    bot.state.incidents!.machineBroken = true;
    current = { state: bot.state, revision: 1, updated_at: new Date().toISOString() };
    const response = await invoke({ action: { type: "advanceRepair" }, revision: 1, requestId });
    expect(response.status).toBe(200);
    const { state } = await response.json();
    expect(state.money).toBe(0);
    expect(state.debt).toBe(20000);
    expect(state.incidents.machineBroken).toBe(false);
    expect(state.phase).toBe("open");
    expect(state.cup).toEqual(bot.state.cup);
  });
  it("uses elapsed server time for pouring instead of the client dt", async () => {
    const bot = new Bot().stock().act({ type: "open" }).act({ type: "cup", size: "M" });
    current = { state: bot.state, revision: 1, updated_at: new Date(Date.now() - 200).toISOString() };
    const response = await invoke({ action: { type: "pour", tea: "milk", dt: 1e9 }, revision: 1, requestId });
    expect(response.status).toBe(200);
    const { state } = await response.json();
    expect(state.cup.fill).toBeGreaterThan(0);
    expect(state.cup.fill).toBeLessThanOrEqual(0.32);
    expect(state.clock).toBeGreaterThan(0);
    expect(state.clock).toBeLessThanOrEqual(1);
  });
});
