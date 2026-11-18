import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const events: { kind: string; time?: number }[] = [];
const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});
class FakeAudio {
  currentTime = 0;
  sampleRate = 48000;
  state = "running";
  destination = {};
  resume() {
    return Promise.resolve();
  }
  createBuffer(_channels: number, n: number) {
    return { getChannelData: () => new Float32Array(n) };
  }
  createBufferSource() {
    events.push({ kind: "noise" });
    return {
      buffer: null,
      connect: vi.fn(),
      start: (time: number) => events.push({ kind: "startNoise", time }),
      stop: vi.fn(),
    };
  }
  createOscillator() {
    events.push({ kind: "tone" });
    return {
      type: "sine",
      frequency: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return { gain: param(), connect: vi.fn() };
  }
  createBiquadFilter() {
    events.push({ kind: "filter" });
    return { type: "", frequency: param(), Q: { value: 0 }, connect: vi.fn() };
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  events.length = 0;
  vi.stubGlobal("window", { AudioContext: FakeAudio });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("liquid and sealer sound effects", () => {
  it("pouring repeats liquid bubbles while held and stops scheduling on release", async () => {
    const audio = await import("../src/audio");
    audio.setPouring(true);
    expect(events.filter((e) => e.kind === "noise")).toHaveLength(1);
    vi.advanceTimersByTime(240);
    expect(events.filter((e) => e.kind === "noise")).toHaveLength(3);
    audio.setPouring(false);
    const count = events.length;
    vi.advanceTimersByTime(500);
    expect(events).toHaveLength(count);
  });
  it("sealer uses four filtered friction bursts instead of a plain beep", async () => {
    const audio = await import("../src/audio");
    audio.effect("seal");
    expect(events.filter((e) => e.kind === "filter")).toHaveLength(4);
    expect(events.filter((e) => e.kind === "noise")).toHaveLength(4);
    expect(events.filter((e) => e.kind === "tone")).toHaveLength(0);
    expect(
      events.filter((e) => e.kind === "startNoise").map((e) => e.time),
    ).toEqual([0, 0.04, 0.08, 0.12]);
  });
  it("muting cancels pouring and suppresses later sound effects", async () => {
    const audio = await import("../src/audio");
    audio.setPouring(true);
    audio.setMusic(false);
    const count = events.length;
    vi.advanceTimersByTime(1000);
    audio.effect("seal");
    audio.setPouring(true);
    expect(events).toHaveLength(count);
  });
});
