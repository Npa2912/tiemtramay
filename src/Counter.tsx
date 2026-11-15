import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { useGame } from "./store";
import { teas } from "./catalog";
class CounterScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private lastTop: string | null = null;
  private dots: { x: number; y: number; v: number }[] = [];
  constructor() {
    super("counter");
  }
  preload() {
    this.load.svg("shop", "/assets/shop.svg");
  }
  create() {
    this.add.image(210, 185, "shop");
    this.ink = this.add.graphics();
  }
  update(_time: number, delta: number) {
    if (!this.ink) return;
    const s = useGame.getState().game,
      c = s.cup,
      g = this.ink;
    g.clear();
    const color = [0xf7e4c9, 0xf0dce0, 0xe3ead5][s.decor.wall];
    g.fillStyle(color, 0.4);
    g.fillRect(0, 0, 420, 175);
    g.lineStyle(2, 0x795447, 0.7);
    if (s.decor.shelf) {
      g.fillStyle(s.decor.shelf === 1 ? 0xb28e70 : 0x9fb58a);
      g.fillRoundedRect(300, 85, 107, 9, 3);
      for (let i = 0; i < 4; i++) {
        g.fillStyle([0xf3a6b2, 0xa8c88a, 0xf6d99c][i % 3]);
        g.fillRoundedRect(310 + i * 24, 60, 17, 25, 4);
      }
    }
    if (s.decor.lamp) {
      g.lineStyle(2, 0x795447);
      g.lineBetween(285, 0, 285, 90);
      g.fillStyle(s.decor.lamp === 1 ? 0xf6d99c : 0xf3a6b2);
      g.fillTriangle(264, 108, 306, 108, 285, 80);
      g.fillStyle(0xf6d99c, 0.18);
      g.fillTriangle(264, 108, 306, 108, 285, 155);
    }
    if (s.decor.plant) {
      g.fillStyle(s.decor.plant === 1 ? 0xa8c88a : 0x739e88);
      g.fillEllipse(80, 159, 28, 13);
      g.fillEllipse(80, 141, 17, 26);
    }
    if (s.decor.counter) {
      g.fillStyle([0xd1aa88, 0xe3b5a9, 0xc3c8a3][s.decor.counter], 0.45);
      g.fillRect(0, 213, 420, 157);
    }
    if (s.upgrades.staff) {
      g.fillStyle(0xa8c88a);
      g.fillRoundedRect(323, 115 + Math.sin(_time / 400) * 3, 65, 46, 12);
      g.fillStyle(0xf6d4ba);
      g.fillCircle(355, 110, 20);
      g.fillStyle(0x795447);
      g.fillCircle(349, 109, 2);
      g.fillCircle(363, 109, 2);
      g.lineStyle(5, 0xf6d4ba);
      g.lineBetween(330, 140, 314 + Math.sin(_time / 200) * 5, 160);
    }
    if (!c) {
      g.lineStyle(2, 0x795447, 0.35);
      g.strokeEllipse(206, 294, 93, 19);
      this.lastTop = null;
      return;
    }
    const w = c.size === "L" ? 77 : 67,
      x = 205 - w / 2,
      top = c.size === "L" ? 156 : 178,
      bottom = 294,
      h = bottom - top;
    g.fillStyle(0xfffbef, 0.95);
    g.fillPoints(
      [
        { x: x - 5, y: top },
        { x: x + w + 5, y: top },
        { x: x + w - 5, y: bottom },
        { x: x + 5, y: bottom },
      ],
      true,
    );
    if (
      c.tea &&
      s.clock - c.pourAt < 0.18 &&
      !s.paused &&
      !c.sealed &&
      c.fill < 1.1
    ) {
      g.lineStyle(5, teas.find((t) => t.id === c.tea)?.color ?? 0xc99670, 0.85);
      g.lineBetween(205, 85, 205, bottom - Math.min(c.fill, 1) * h * 0.9);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(
        205 + Math.sin(_time / 70) * 5,
        bottom - Math.min(c.fill, 1) * h * 0.9,
        4,
      );
    }
    if (c.tea) {
      const th = Math.min(1, c.fill) * h * 0.9;
      g.fillStyle(teas.find((t) => t.id === c.tea)?.color ?? 0xc99670);
      g.fillPoints(
        [
          { x: x + 3, y: bottom - th },
          { x: x + w - 3, y: bottom - th },
          { x: x + w - 7, y: bottom - 3 },
          { x: x + 7, y: bottom - 3 },
        ],
        true,
      );
    }
    g.lineStyle(3, 0x795447);
    g.strokePoints(
      [
        { x: x - 5, y: top },
        { x: x + 5, y: bottom },
        { x: x + w - 5, y: bottom },
        { x: x + w + 5, y: top },
      ],
      false,
    );
    g.strokeEllipse(205, top, w + 10, 12);
    g.fillStyle(0xa8c88a, 0.3);
    g.fillRect(x - 11, bottom - h * 0.93, w + 22, h * 0.16);
    g.lineStyle(2, 0x769356);
    g.lineBetween(x - 15, bottom - h * 0.85, x + 2, bottom - h * 0.85);
    g.lineBetween(x + w - 2, bottom - h * 0.85, x + w + 15, bottom - h * 0.85);
    if (c.topping) {
      if (this.lastTop !== c.topping) {
        this.dots = Array.from({ length: 10 }, (_, i) => ({
          x: x + 13 + ((i * 17) % (w - 25)),
          y: top - 40 - i * 5,
          v: 0,
        }));
        this.lastTop = c.topping;
      }
      g.fillStyle(
        c.topping === "pearl"
          ? 0x604539
          : c.topping === "pudding"
            ? 0xf3ce77
            : c.topping === "aloe"
              ? 0xe5ecd2
              : 0x9a7055,
      );
      for (const d of this.dots) {
        d.v += delta * 0.0008;
        d.y = Math.min(bottom - 8, d.y + d.v * delta);
        g.fillCircle(d.x, d.y, 4);
      }
    }
    if (c.ice) {
      g.fillStyle(0xe8f5f0, 0.8);
      g.lineStyle(1, 0xa3c7c4);
      for (let i = 0; i < (c.ice === 50 ? 3 : 6); i++) {
        g.fillRoundedRect(
          x + 10 + (i % 3) * 16,
          Math.max(top + 15, bottom - c.fill * h * 0.8) +
            Math.floor(i / 3) * 17,
          12,
          12,
          3,
        );
      }
    }
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(x + 12, top + 12, 7, h - 25, 4);
    g.fillStyle(
      s.decor.cup === 1 ? 0xf3a6b2 : s.decor.cup === 2 ? 0xa8c88a : 0xfff0d8,
      0.9,
    );
    g.fillCircle(205, top + h * 0.6, 16);
    g.lineStyle(2, 0x795447);
    g.strokeCircle(205, top + h * 0.6, 16);
    g.fillStyle(0x795447);
    g.fillCircle(200, top + h * 0.6, 1.5);
    g.fillCircle(210, top + h * 0.6, 1.5);
    if (c.sealLeft > 0) {
      g.fillStyle(0xf3a6b2, 0.75);
      g.fillRoundedRect(
        x - 10,
        top - 15 + Math.sin(_time / 60) * 3,
        w + 20,
        10,
        4,
      );
      g.lineStyle(3, 0xa8c88a);
      g.strokeCircle(355, 207, 12);
      g.lineBetween(
        355,
        207,
        355 + Math.cos(_time / 100) * 10,
        207 + Math.sin(_time / 100) * 10,
      );
    }
    if (c.sealed) {
      g.fillStyle(0xf3a6b2);
      g.fillEllipse(205, top - 2, w + 15, 12);
      g.lineStyle(2, 0x795447);
      g.strokeEllipse(205, top - 2, w + 15, 12);
    }
  }
}
export function Counter() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: 420,
      height: 370,
      transparent: true,
      scene: CounterScene,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      banner: false,
    });
    return () => {
      game.destroy(true);
    };
  }, []);
  return (
    <div
      className="phaser"
      ref={host}
      aria-label="Quầy pha chế: ly, topping và máy dán nắp"
    />
  );
}
