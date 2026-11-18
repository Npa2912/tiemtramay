import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initial, reduce, type Action } from "../src/engine";
import { db, load } from "../src/persistence";

const transport = vi.hoisted(() => ({ action: vi.fn(), session: { user: { id: "user-a" } } }));
vi.mock("../src/account/client", () => ({ cloudAction: transport.action, getSession: () => transport.session }));
import { flushSave, useGame } from "../src/store";
let server = initial();
let revision = 1;
beforeEach(async () => {
  if (useGame.getState().online.active) await useGame.getState().leaveOnline();
  server = initial(); server.money = 1000000; revision = 1;
  transport.action.mockReset().mockImplementation(async (action: Action | null) => {
    if (action) { server = reduce(server, action); revision++; }
    return { state: structuredClone(server), revision };
  });
  const guest = initial(); guest.money = 123456;
  useGame.setState({ game: guest, ready: true, error: "" });
});
afterEach(async () => {
  if (useGame.getState().online.active) await useGame.getState().leaveOnline();
  await new Promise((resolve) => setTimeout(resolve, 550));
  await db.delete({ disableAutoOpen: false });
});
describe("opt-in online store", () => {
  it("preserves guest balance and never autosaves cloud progress over it", async () => {
    await useGame.getState().enterOnline();
    expect(useGame.getState().game.money).toBe(1000000);
    useGame.getState().act({ type: "buy", id: "milk" });
    expect(useGame.getState().game.money).toBe(1000000); // No optimistic money mutation.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(useGame.getState().game.money).toBeLessThan(1000000);
    expect((await load()).money).toBe(123456);
    await useGame.getState().leaveOnline();
    expect(useGame.getState().game.money).toBe(123456);
  });
  it("halts commands after a sync conflict instead of mutating local money", async () => {
    await useGame.getState().enterOnline();
    transport.action.mockRejectedValueOnce(new Error("revision conflict"));
    useGame.getState().act({ type: "buy", id: "milk" });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(useGame.getState().online.status).toBe("error");
    await expect(flushSave()).rejects.toThrow("revision conflict");
    const callCount = transport.action.mock.calls.length;
    useGame.getState().act({ type: "buy", id: "milk" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(transport.action).toHaveBeenCalledTimes(callCount);
    expect(useGame.getState().game.money).toBe(1000000);
    expect((await load()).money).toBe(123456);
  });
  it("previews brewing during a slow save and rolls back a rejected command", async () => {
    for (const id of ["milk", "black", "milkPowder", "sugar", "ice", "pearl", "cupM", "lid"])
      server = reduce(server, { type: "buy", id });
    server = reduce(server, { type: "open" });
    server.incidents = { ...server.incidents!, theftPlanned: false, powerPlanned: false, machinePlanned: false };
    await useGame.getState().enterOnline();
    let reject!: (reason: Error) => void;
    transport.action.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const { act } = useGame.getState();
    act({ type: "cup", size: "M" });
    act({ type: "pour", tea: "milk", dt: 0.4 });
    act({ type: "pour", tea: "milk", dt: 0.3 });
    act({ type: "top", id: "pearl" });
    expect(useGame.getState().game.cup?.fill).toBeCloseTo(0.224);
    expect(useGame.getState().game.cup?.topping).toBe("pearl");
    expect(server.cup).toBeNull();
    await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
    reject(new Error("revision conflict"));
    await expect(flushSave()).rejects.toThrow("revision conflict");
    expect(useGame.getState().game.cup).toBeNull();
  });
  it("refuses importing a browser snapshot into an authoritative online save", async () => {
    await useGame.getState().enterOnline();
    const forged = initial(); forged.money = 999999999;
    useGame.getState().replace(forged);
    expect(useGame.getState().game.money).toBe(1000000);
    expect(useGame.getState().error).toContain("Không thể nhập");
  });
  it("waits for server acknowledgement before confirming a manual save", async () => {
    await useGame.getState().enterOnline();
    let acknowledge!: (value: { state: ReturnType<typeof initial>; revision: number }) => void;
    transport.action.mockImplementationOnce(() => new Promise((resolve) => { acknowledge = resolve; }));
    useGame.getState().act({ type: "buy", id: "milk" });
    let confirmed = false;
    const saving = flushSave().then(() => { confirmed = true; });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(confirmed).toBe(false);
    acknowledge({ state: reduce(server, { type: "buy", id: "milk" }), revision: 2 });
    await saving;
    expect(confirmed).toBe(true);
    expect(useGame.getState().online.status).toBe("saved");
  });
  it("locks guest actions and concurrent entry while a source switch is pending", async () => {
    let finish!: (value: { state: ReturnType<typeof initial>; revision: number }) => void;
    transport.action.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const entering = useGame.getState().enterOnline();
    useGame.getState().act({ type: "buy", id: "milk" });
    expect(useGame.getState().game.money).toBe(123456);
    await expect(useGame.getState().enterOnline()).rejects.toThrow("Đang chuyển");
    await expect(flushSave()).rejects.toThrow("Đang chuyển");
    await new Promise((resolve) => setTimeout(resolve, 30));
    finish({ state: structuredClone(server), revision: 1 });
    await entering;
    await useGame.getState().leaveOnline();
    expect(useGame.getState().game.money).toBe(123456);
  });
});
