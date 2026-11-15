let ctx: AudioContext | undefined;
let music: ReturnType<typeof setInterval> | undefined;
let note = 0;
export function effect(kind = "click") {
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const freq: Record<string, number> = {
    click: 620,
    pour: 190,
    top: 880,
    ice: 1400,
    seal: 250,
    serve: 1046,
    open: 784,
    close: 523,
  };
  osc.type = kind === "pour" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(freq[kind] ?? 520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    (freq[kind] ?? 520) * 0.7,
    ctx.currentTime + 0.15,
  );
  gain.gain.setValueAtTime(0.035, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.21);
}
export function setMusic(on: boolean) {
  if (music) clearInterval(music);
  music = undefined;
  if (!on) return;
  music = setInterval(() => {
    if (!ctx || ctx.state !== "running") return;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = [
      261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23,
    ][note++ % 8];
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.012, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    o.start();
    o.stop(ctx.currentTime + 0.75);
  }, 800);
}
