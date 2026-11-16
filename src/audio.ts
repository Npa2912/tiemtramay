let ctx: AudioContext | undefined;
let music: ReturnType<typeof setInterval> | undefined;
let pouring: ReturnType<typeof setInterval> | undefined;
let note = 0;
let enabled = true;
function context() {
  if (!ctx) {
    const Constructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Constructor) return null;
    ctx = new Constructor();
  }
  void ctx.resume().catch(() => {});
  return ctx;
}
function noise(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(
    1,
    Math.ceil(c.sampleRate * seconds),
    c.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  return source;
}
function bubble(c: AudioContext, time: number) {
  const o = c.createOscillator(),
    g = c.createGain();
  o.type = "sine";
  const pitch = 100 + Math.random() * 160;
  o.frequency.setValueAtTime(pitch, time);
  o.frequency.exponentialRampToValueAtTime(pitch * 2.7, time + 0.045);
  o.frequency.exponentialRampToValueAtTime(60, time + 0.15);
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(0.065, time + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
  o.connect(g);
  g.connect(c.destination);
  o.start(time);
  o.stop(time + 0.18);
  const water = noise(c, 0.2),
    filter = c.createBiquadFilter(),
    volume = c.createGain();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650 + Math.random() * 400, time);
  filter.Q.value = 1.8;
  volume.gain.setValueAtTime(0.022, time);
  volume.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  water.connect(filter);
  filter.connect(volume);
  volume.connect(c.destination);
  water.start(time);
  water.stop(time + 0.2);
}
export function setPouring(on: boolean) {
  if (!on || !enabled) {
    if (pouring) clearInterval(pouring);
    pouring = undefined;
    return;
  }
  if (pouring) return;
  const c = context();
  if (!c) return;
  bubble(c, c.currentTime);
  pouring = setInterval(() => {
    if (c.state === "running") bubble(c, c.currentTime);
  }, 115);
}
function seal(c: AudioContext) {
  for (let i = 0; i < 4; i++) {
    const time = c.currentTime + i * 0.16,
      source = noise(c, 0.14),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    filter.type = "bandpass";
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(i % 2 ? 1600 : 900, time);
    filter.frequency.exponentialRampToValueAtTime(
      i % 2 ? 600 : 2300,
      time + 0.12,
    );
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(time);
    source.stop(time + 0.14);
  }
}
export function effect(kind = "click") {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  if (kind === "pour") {
    bubble(c, c.currentTime);
    return;
  }
  if (kind === "seal") {
    seal(c);
    return;
  }
  const osc = c.createOscillator(),
    gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  const frequencies: Record<string, number> = {
    click: 620,
    top: 880,
    ice: 1400,
    serve: 1046,
    open: 784,
    close: 523,
  };
  const f = frequencies[kind] ?? 520;
  osc.type = "sine";
  osc.frequency.setValueAtTime(f, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(f * 0.7, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.035, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.start();
  osc.stop(c.currentTime + 0.21);
}
export function setMusic(on: boolean) {
  enabled = on;
  if (music) clearInterval(music);
  music = undefined;
  if (!on) {
    setPouring(false);
    return;
  }
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
