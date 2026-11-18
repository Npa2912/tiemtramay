import { useEffect, useRef } from "react";
import { useGame } from "./store";
import { teas } from "./catalog";
import type { State } from "./engine";

const width = 420;
const height = 370;

function prepareContext(ctx: CanvasRenderingContext2D) {
  // Match the framing of the original counter.
  ctx.setTransform(
    1.35,
    0,
    0,
    1.35,
    width / 2 - 205 * 1.35,
    height / 2 - 230 * 1.35,
  );
}

function drawing(ctx: CanvasRenderingContext2D) {
  type Point = { x: number; y: number };
  const color = (rgb: number, alpha: number) =>
    `rgba(${rgb >> 16}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${alpha})`;
  function fill(rgb: number, alpha = 1) {
    ctx.fillStyle = color(rgb, alpha);
  }
  function stroke(width: number, rgb: number, alpha = 1) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color(rgb, alpha);
  }
  function points(vertices: Point[]) {
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (const { x, y } of vertices.slice(1)) ctx.lineTo(x, y);
  }
  function fillPoints(vertices: Point[]) {
    points(vertices);
    ctx.fill();
  }
  function strokePoints(vertices: Point[]) {
    points(vertices);
    ctx.stroke();
  }
  function ellipse(x: number, y: number, w: number, h: number) {
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  }
  return {
    fill,
    stroke,
    fillPoints,
    strokePoints,
    roundRect(x: number, y: number, w: number, h: number, radius: number) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
    },
    fillEllipse(x: number, y: number, w: number, h: number) {
      ellipse(x, y, w, h);
      ctx.fill();
    },
    strokeEllipse(x: number, y: number, w: number, h: number) {
      ellipse(x, y, w, h);
      ctx.stroke();
    },
    fillCircle(x: number, y: number, radius: number) {
      ellipse(x, y, radius * 2, radius * 2);
      ctx.fill();
    },
    strokeCircle(x: number, y: number, radius: number) {
      ellipse(x, y, radius * 2, radius * 2);
      ctx.stroke();
    },
    triangle(
      x: number,
      y: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
    ) {
      fillPoints([
        { x, y },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
      ]);
    },
    line(x: number, y: number, x2: number, y2: number) {
      strokePoints([
        { x, y },
        { x: x2, y: y2 },
      ]);
    },
  };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  decor: State["decor"],
) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  prepareContext(ctx);
  if (image.naturalWidth) ctx.drawImage(image, 0, 0, width, height);
  const { fill, stroke, roundRect, fillEllipse, triangle, line } = drawing(ctx);
  const color = [0xf7e4c9, 0xf0dce0, 0xe3ead5][decor.wall];
  fill(color, 0.4);
  ctx.fillRect(0, 0, 420, 175);
  if (decor.shelf) {
    fill(decor.shelf === 1 ? 0xb28e70 : 0x9fb58a);
    roundRect(300, 85, 107, 9, 3);
    for (let i = 0; i < 4; i++) {
      fill([0xf3a6b2, 0xa8c88a, 0xf6d99c][i % 3]);
      roundRect(310 + i * 24, 60, 17, 25, 4);
    }
  }
  if (decor.lamp) {
    stroke(2, 0x795447);
    line(285, 0, 285, 90);
    fill(decor.lamp === 1 ? 0xf6d99c : 0xf3a6b2);
    triangle(264, 108, 306, 108, 285, 80);
    fill(0xf6d99c, 0.18);
    triangle(264, 108, 306, 108, 285, 155);
  }
  if (decor.plant) {
    fill(decor.plant === 1 ? 0xa8c88a : 0x739e88);
    fillEllipse(80, 159, 28, 13);
    fillEllipse(80, 141, 17, 26);
  }
  if (decor.counter) {
    fill([0xd1aa88, 0xe3b5a9, 0xc3c8a3][decor.counter], 0.45);
    ctx.fillRect(0, 213, 420, 157);
  }
}

export function Counter() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    const backdrop = document.createElement("canvas");
    backdrop.width = width;
    backdrop.height = height;
    const background = backdrop.getContext("2d");
    if (!ctx || !background) return;
    const image = new Image();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined;
    let lastTime: number | undefined;
    let lastDecor = "";
    let lastTop: string | null = null;
    let dots: { x: number; y: number; v: number }[] = [];
    const {
      fill,
      stroke,
      roundRect,
      fillEllipse,
      strokeEllipse,
      fillCircle,
      strokeCircle,
      line,
      fillPoints,
      strokePoints,
    } = drawing(ctx);

    function schedule() {
      frame ??= requestAnimationFrame(draw);
    }

    function draw(time: number) {
      frame = undefined;
      if (!ctx || !background) return;
      const s = useGame.getState().game;
      const c = s.cup;
      const decor = s.decor;
      const reducedMotion = motion.matches || s.progression?.reducedMotion;
      const motionTime = reducedMotion ? 0 : time;
      const staff = s.upgrades.staff;
      const sealing = !!c && c.sealLeft > 0;
      const pouring = isPouring(s);
      const delta = lastTime === undefined ? 16 : Math.min(33, time - lastTime);
      lastTime = time;
      const decorKey = `${decor.wall}/${decor.shelf}/${decor.lamp}/${decor.plant}/${decor.counter}`;
      if (decorKey !== lastDecor) {
        drawBackground(background, image, decor);
        lastDecor = decorKey;
      }
      ctx.resetTransform();
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(backdrop, 0, 0);
      prepareContext(ctx);

      if (!s.paused && !reducedMotion && (staff || pouring || sealing))
        schedule();
      if (staff) {
        fill(0xa8c88a);
        roundRect(323, 115 + Math.sin(motionTime / 400) * 3, 65, 46, 12);
        fill(0xf6d4ba);
        fillCircle(355, 110, 20);
        fill(0x795447);
        fillCircle(349, 109, 2);
        fillCircle(363, 109, 2);
        stroke(5, 0xf6d4ba);
        line(330, 140, 314 + Math.sin(motionTime / 200) * 5, 160);
      }
      if (!c) {
        stroke(2, 0x795447, 0.35);
        strokeEllipse(206, 294, 93, 19);
        lastTop = null;
        return;
      }
      const w = c.size === "L" ? 77 : 67,
        x = 205 - w / 2,
        top = c.size === "L" ? 156 : 178,
        bottom = 294,
        h = bottom - top;
      fill(0xfffbef, 0.95);
      fillPoints([
        { x: x - 5, y: top },
        { x: x + w + 5, y: top },
        { x: x + w - 5, y: bottom },
        { x: x + 5, y: bottom },
      ]);
      if (pouring) {
        stroke(5, teas.find((t) => t.id === c.tea)?.color ?? 0xc99670, 0.85);
        line(205, 85, 205, bottom - Math.min(c.fill, 1) * h * 0.9);
        fill(0xffffff, 0.6);
        fillCircle(
          205 + Math.sin(motionTime / 70) * 5,
          bottom - Math.min(c.fill, 1) * h * 0.9,
          4,
        );
      }
      if (c.tea) {
        const th = Math.min(1, c.fill) * h * 0.9;
        fill(teas.find((t) => t.id === c.tea)?.color ?? 0xc99670);
        fillPoints([
          { x: x + 3, y: bottom - th },
          { x: x + w - 3, y: bottom - th },
          { x: x + w - 7, y: bottom - 3 },
          { x: x + 7, y: bottom - 3 },
        ]);
      }
      stroke(3, 0x795447);
      strokePoints([
        { x: x - 5, y: top },
        { x: x + 5, y: bottom },
        { x: x + w - 5, y: bottom },
        { x: x + w + 5, y: top },
      ]);
      strokeEllipse(205, top, w + 10, 12);
      fill(0xa8c88a, 0.3);
      ctx.fillRect(x - 11, bottom - h * 0.93, w + 22, h * 0.16);
      stroke(2, 0x769356);
      line(x - 15, bottom - h * 0.85, x + 2, bottom - h * 0.85);
      line(x + w - 2, bottom - h * 0.85, x + w + 15, bottom - h * 0.85);
      if (!c.topping) lastTop = null;
      if (c.topping) {
        if (lastTop !== c.topping) {
          dots = Array.from({ length: 10 }, (_, i) => ({
            x: x + 13 + ((i * 17) % (w - 25)),
            y: reducedMotion ? bottom - 8 : top - 40 - i * 5,
            v: 0,
          }));
          lastTop = c.topping;
        }
        fill(
          c.topping === "pearl"
            ? 0x604539
            : c.topping === "pudding"
              ? 0xf3ce77
              : c.topping === "aloe"
                ? 0xe5ecd2
                : 0x9a7055,
        );
        for (const d of dots) {
          d.v += delta * 0.0008;
          d.y = Math.min(bottom - 8, d.y + d.v * delta);
          fillCircle(d.x, d.y, 4);
        }
      }
      if (c.ice) {
        fill(0xe8f5f0, 0.8);
        stroke(1, 0xa3c7c4);
        for (let i = 0; i < (c.ice === 50 ? 3 : 6); i++) {
          roundRect(
            x + 10 + (i % 3) * 16,
            Math.max(top + 15, bottom - c.fill * h * 0.8) +
              Math.floor(i / 3) * 17,
            12,
            12,
            3,
          );
        }
      }
      fill(0xffffff, 0.28);
      roundRect(x + 12, top + 12, 7, h - 25, 4);
      fill(
        decor.cup === 1 ? 0xf3a6b2 : decor.cup === 2 ? 0xa8c88a : 0xfff0d8,
        0.9,
      );
      fillCircle(205, top + h * 0.6, 16);
      stroke(2, 0x795447);
      strokeCircle(205, top + h * 0.6, 16);
      fill(0x795447);
      fillCircle(200, top + h * 0.6, 1.5);
      fillCircle(210, top + h * 0.6, 1.5);
      if (sealing) {
        fill(0xf3a6b2, 0.75);
        roundRect(
          x - 10,
          top - 15 + Math.sin(motionTime / 60) * 3,
          w + 20,
          10,
          4,
        );
        stroke(3, 0xa8c88a);
        strokeCircle(355, 207, 12);
        line(
          355,
          207,
          355 + Math.cos(motionTime / 100) * 10,
          207 + Math.sin(motionTime / 100) * 10,
        );
      }
      if (c.sealed) {
        fill(0xf3a6b2);
        fillEllipse(205, top - 2, w + 15, 12);
        stroke(2, 0x795447);
        strokeEllipse(205, top - 2, w + 15, 12);
      }
      if (
        !s.paused &&
        !reducedMotion &&
        c.topping &&
        dots.some((d) => d.y < bottom - 8)
      )
        schedule();
    }

    function isPouring(s: State) {
      const c = s.cup;
      return (
        !!c?.tea &&
        !s.paused &&
        !c.sealed &&
        c.fill < 1.1 &&
        s.clock - c.pourAt < 0.18
      );
    }

    const unsubscribe = useGame.subscribe(({ game }, { game: previous }) => {
      if (game === previous) return;
      const c = game.cup;
      const old = previous.cup;
      if (!c || !old || c.topping !== old.topping) lastTop = null;
      if (
        c?.size !== old?.size ||
        c?.fill !== old?.fill ||
        c?.tea !== old?.tea ||
        c?.topping !== old?.topping ||
        c?.ice !== old?.ice ||
        c?.sealed !== old?.sealed ||
        !!c?.sealLeft !== !!old?.sealLeft ||
        isPouring(game) !== isPouring(previous) ||
        game.paused !== previous.paused ||
        game.upgrades.staff !== previous.upgrades.staff ||
        game.progression?.reducedMotion !==
          previous.progression?.reducedMotion ||
        (Object.keys(game.decor) as (keyof State["decor"])[]).some(
          (key) => game.decor[key] !== previous.decor[key],
        )
      )
        schedule();
    });
    image.onload = () => {
      lastDecor = "";
      schedule();
    };
    image.src = "/assets/shop.svg";
    motion.addEventListener("change", schedule);
    schedule();
    return () => {
      unsubscribe();
      image.onload = null;
      motion.removeEventListener("change", schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      className="phaser"
      aria-label="Quầy pha chế: ly, topping và máy dán nắp"
    >
      <canvas ref={canvas} width={width} height={height} />
    </div>
  );
}
