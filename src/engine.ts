import {
  ensureIncidents,
  interceptIncident,
  afterIncidents,
  validIncidents,
  type Incidents,
  type IncidentAction,
} from "./incidents";
import {
  createProgression,
  applyProgression,
  reduceProgression,
  validProgression,
  type Progression,
  type ProgressionAction,
} from "./progression";
import {
  customers,
  recipes,
  supplies,
  upgrades,
  unlocked,
  teas,
  toppings,
  flavors,
  label,
  type Recipe,
} from "./catalog";
export interface Lot {
  qty: number;
  expires: number;
}
export interface Order {
  id: number;
  customer: number;
  recipe: Recipe;
  remaining: number;
  total: number;
}
export interface Cup {
  size: "M" | "L";
  tea: string | null;
  fill: number;
  topping: string | null;
  flavor: string | null;
  sugar: number | null;
  ice: number | null;
  sealed: boolean;
  sealLeft: number;
  cost: number;
  pourAt: number;
}
export interface Ledger {
  day: number;
  kind: string;
  amount: number;
}
export interface Summary {
  day: number;
  revenue: number;
  cogs: number;
  expenses: number;
  waste: number;
  served: number;
  lost: number;
  profit: number;
}
export interface Feedback {
  customer: number;
  mood: "happy" | "sad" | "angry" | "satisfied";
  remaining: number;
  text: string;
}
export interface State {
  feedback: Feedback | null;
  progression?: Progression;
  incidents?: Incidents;
  version: 2;
  day: number;
  money: number;
  debt: number;
  creditDay: number;
  reputation: number;
  phase: "prep" | "open" | "summary";
  paused: boolean;
  seed: number;
  sequence: number;
  orders: Order[];
  generated: number;
  target: number;
  cup: Cup | null;
  stock: Record<string, Lot[]>;
  upgrades: Record<string, number>;
  decor: Record<string, number>;
  ledger: Ledger[];
  history: Summary[];
  stats: Summary;
  message: string;
  clock: number;
  tutorial: boolean;
  sound: boolean;
}
export type Action =
  | ProgressionAction
  | IncidentAction
  | { type: "selectOrder"; id: number }
  | { type: "buy"; id: string }
  | { type: "upgrade"; id: string }
  | { type: "decor"; id: string; value: number }
  | { type: "open" }
  | { type: "close" }
  | { type: "next" }
  | { type: "cup"; size: "M" | "L" }
  | { type: "pour"; tea: string; dt: number }
  | { type: "top"; id: string }
  | { type: "flavor"; id: string }
  | { type: "sugar"; value: number }
  | { type: "ice"; value: number }
  | { type: "seal" }
  | { type: "serve" }
  | { type: "trash" }
  | { type: "tick"; dt: number }
  | { type: "pause" }
  | { type: "sound" }
  | { type: "tutorial" }
  | { type: "credit" };
const stats = (day: number): Summary => ({
  day,
  revenue: 0,
  cogs: 0,
  expenses: 0,
  waste: 0,
  served: 0,
  lost: 0,
  profit: 0,
});
export const quantity = (s: State, id: string) =>
  s.stock[id]?.reduce((n, l) => n + l.qty, 0) ?? 0;
export function missingOpeningSupplies(s: State) {
  return [
    "cupM",
    "lid",
    "milk",
    "black",
    "milkPowder",
    "pearl",
    "sugar",
    "ice",
  ].filter((id) => quantity(s, id) < 1);
}
export function initial(seed = 4271): State {
  const s: State = {
    feedback: null,
    progression: createProgression(),
    version: 2,
    day: 1,
    money: 1000000,
    debt: 0,
    creditDay: 0,
    reputation: 4.5,
    phase: "prep",
    paused: false,
    seed,
    sequence: 0,
    orders: [],
    generated: 0,
    target: 5,
    cup: null,
    stock: {},
    upgrades: {},
    decor: {
      awning: 0,
      sign: 0,
      wall: 0,
      counter: 0,
      shelf: 0,
      plant: 0,
      lamp: 0,
      cup: 0,
    },
    ledger: [],
    history: [],
    stats: stats(1),
    message: "Chào bạn! Nhập nguyên liệu, rồi mở cửa đón vị khách đầu tiên.",
    clock: 0,
    tutorial: true,
    sound: true,
  };
  return ensureIncidents(s);
}
function log(s: State, kind: string, amount: number) {
  s.money = Math.round((s.money + amount) * 100) / 100;
  s.ledger.push({ day: s.day, kind, amount });
  s.ledger = s.ledger.slice(-600);
}
function consume(s: State, id: string, qty: number) {
  if (quantity(s, id) + 1e-7 < qty) return false;
  let left = qty;
  for (const l of s.stock[id] ?? []) {
    const n = Math.min(l.qty, left);
    l.qty -= n;
    left -= n;
  }
  s.stock[id] = (s.stock[id] ?? []).filter((l) => l.qty > 1e-7);
  const cost = (supplies.find((x) => x.id === id)?.price ?? 0) * qty;
  if (s.cup) s.cup.cost += cost;
  s.stats.cogs += cost;
  return true;
}
function random(s: State) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function recipeNeeds(r: Recipe) {
  const needs: Record<string, number> = {
    [r.tea]: 0.85 * (r.size === "L" ? 1.5 : 1),
    [r.topping]: 1,
    [`cup${r.size}`]: 1,
    lid: 1,
    sugar: r.sugar / 100,
    ice: r.ice / 100,
  };
  if (r.tea === "milk") needs.milkPowder = needs[r.tea] * 0.3;
  if (r.flavor !== "plain") needs[r.flavor] = 1;
  return needs;
}
function canQueue(s: State, recipe: Recipe) {
  const reserved: Record<string, number> = {};
  for (const order of s.orders)
    for (const [id, qty] of Object.entries(recipeNeeds(order.recipe)))
      reserved[id] = (reserved[id] || 0) + qty;
  return Object.entries(recipeNeeds(recipe)).every(
    ([id, qty]) => quantity(s, id) + 1e-7 >= qty + (reserved[id] || 0),
  );
}
function enqueue(s: State) {
  while (s.orders.length < 3 && s.generated < s.target) {
    const available = recipes.filter(
      (r) =>
        r.day <= s.day &&
        unlocked(s, r.tea) &&
        unlocked(s, r.topping) &&
        unlocked(s, r.flavor) &&
        (r.size === "M" || s.upgrades.size) &&
        canQueue(s, r),
    );
    if (!available.length) break;
    let recipe = { ...available[Math.floor(random(s) * available.length)] };
    if (s.day < 3) {
      recipe.sugar = 70;
      recipe.ice = 50;
    }
    let draw = random(s) * customers.reduce((sum, c) => sum + c.frequency, 0);
    const customer = customers.findIndex((c) => (draw -= c.frequency) <= 0);
    const favorite = available.filter(
      (r) =>
        r.tea === customers[customer].preference &&
        r.price <= customers[customer].budget,
    );
    if (favorite.length && random(s) < 0.45)
      recipe = { ...favorite[Math.floor(random(s) * favorite.length)] };
    if (s.day < 3) {
      recipe.sugar = 70;
      recipe.ice = 50;
    }
    const total =
      customers[customer].patience +
      15 * (s.upgrades.counter ?? 0) -
      Math.min(35, s.day);
    s.orders.push({
      id: ++s.sequence,
      customer,
      recipe,
      total,
      remaining: total,
    });
    s.generated++;
  }
}
function finish(s: State) {
  if (s.phase === "summary") return;
  s.stats.lost += s.orders.length;
  s.reputation = Math.max(1, s.reputation - 0.05 * s.orders.length);
  s.orders = [];
  s.cup = null;
  s.phase = "summary";
  const expense = 6000 + 2000 + (s.upgrades.staff ? 8000 : 0);
  s.stats.expenses = expense;
  log(s, "Thuê quầy, điện nước và lương", -expense);
  s.stats.profit =
    s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
  s.history.push({ ...s.stats });
  s.history = s.history.slice(-365);
  s.message = "Một ngày chăm chỉ đã khép lại. Hẹn mai tại Mây!";
}
export function complete(c: Cup | null) {
  return (
    !!c &&
    c.tea !== null &&
    c.fill >= 0.6 &&
    c.topping !== null &&
    c.flavor !== null &&
    c.sugar !== null &&
    c.ice !== null &&
    c.sealed
  );
}
export function quality(c: Cup, r: Recipe) {
  let score = 1;
  if (c.tea !== r.tea) score -= 0.45;
  if (c.size !== r.size) score -= 0.15;
  if (Math.abs(c.fill - 0.85) > 0.08) score -= 0.2;
  if (c.topping !== r.topping) score -= 0.2;
  if (c.flavor !== r.flavor) score -= 0.15;
  if (c.sugar !== r.sugar) score -= 0.1;
  if (c.ice !== r.ice) score -= 0.1;
  return Math.max(0, score);
}
const progressionActions = new Set([
  "eventChoice",
  "hire",
  "train",
  "staffAssign",
  "security",
  "claimQuest",
  "ownerName",
  "reducedMotion",
]);
export function reduce(input: State, a: Action): State {
  const prepared = ensureIncidents(input);
  const intercepted = interceptIncident(prepared, a);
  if (intercepted) return intercepted;
  const next = progressionActions.has(a.type)
    ? reduceProgression(prepared, a as ProgressionAction)
    : applyProgression(prepared, reduceCore(prepared, a), a);
  return afterIncidents(prepared, next, a);
}
function reduceCore(input: State, a: Action): State {
  if (a.type === "tick" && (input.phase !== "open" || input.paused))
    return input;
  const s = structuredClone(input);
  const say = (m: string) => {
    s.message = m;
    return s;
  };
  if (a.type === "pause") {
    s.paused = !s.paused;
    return s;
  }
  if (a.type === "sound") {
    s.sound = !s.sound;
    return s;
  }
  if (a.type === "tutorial") {
    s.tutorial = false;
    return s;
  }
  if (s.paused) return s;
  if (a.type === "selectOrder") {
    if (s.phase !== "open" || s.cup)
      return say("Hoàn thành hoặc bỏ ly đang pha trước khi đổi đơn.");
    const index = s.orders.findIndex((o) => o.id === a.id);
    if (index > 0) s.orders.unshift(...s.orders.splice(index, 1));
    return s;
  }
  if (a.type === "credit") {
    if (s.money < 20000 && s.creditDay !== s.day) {
      s.creditDay = s.day;
      s.debt += 200000;
      log(s, "Vay vốn khôi phục (không lãi)", 200000);
      return say(
        "Mây nhận 200.000đ vốn vay. Khoản vay được hoàn khi đủ tiền sau ngày bán.",
      );
    }
    return say("Vốn vay dành cho khi số dư dưới 20.000đ, một lần/ngày.");
  }
  if (a.type === "buy") {
    const item = supplies.find((x) => x.id === a.id);
    if (!item) return s;
    if (s.phase === "open") return say("Hãy đóng cửa trước khi nhập kho.");
    const cost = item.price * item.pack;
    if (s.money < cost) return say("Chưa đủ tiền nhập hàng.");
    if (quantity(s, item.id) + item.pack > 40 + 40 * (s.upgrades.storage ?? 0))
      return say("Kho đầy. Hãy nâng cấp sức chứa.");
    s.stock[item.id] ??= [];
    s.stock[item.id].push({
      qty: item.pack,
      expires: s.day + item.life + 2 * (s.upgrades.fridge ?? 0),
    });
    log(s, `Nhập ${item.name}`, -cost);
    return say(`Đã nhập ${item.pack} phần ${item.name.toLowerCase()}.`);
  }
  if (a.type === "upgrade") {
    const u = upgrades.find((x) => x.id === a.id);
    if (!u || s.phase === "open") return s;
    const lv = s.upgrades[u.id] ?? 0;
    const cost = u.price * (lv + 1);
    if (s.day < u.day || lv >= u.max || s.money < cost)
      return say("Chưa đủ điều kiện nâng cấp.");
    s.upgrades[u.id] = lv + 1;
    log(s, `Nâng cấp ${u.name}`, -cost);
    return say("Góc tiệm vừa xinh hơn một chút!");
  }
  if (a.type === "decor") {
    if (a.id in s.decor)
      s.decor[a.id] = Math.max(0, Math.min(2, Math.floor(a.value)));
    return s;
  }
  if (a.type === "open") {
    if (s.phase !== "prep") return s;
    const missing = missingOpeningSupplies(s);
    if (missing.length)
      return say(
        `Chưa thể mở cửa. Cần nhập: ${missing.map(label).join(", ")}.`,
      );
    s.phase = "open";
    s.clock = 0;
    s.generated = 0;
    s.target = 5 + Math.min(15, Math.floor(s.day / 2));
    enqueue(s);
    return say("Mây mở cửa! Chọn ly đúng size để bắt đầu.");
  }
  if (a.type === "close") {
    finish(s);
    return s;
  }
  if (a.type === "next") {
    if (s.phase !== "summary") return s;
    s.day++;
    s.stats = stats(s.day);
    s.phase = "prep";
    s.clock = 0;
    for (const id of Object.keys(s.stock)) {
      const expired = s.stock[id].filter((l) => l.expires <= s.day);
      const value =
        expired.reduce((n, l) => n + l.qty, 0) *
        (supplies.find((x) => x.id === id)?.price ?? 0);
      if (value) {
        s.stats.waste += value;
        log(s, `Hỏng: ${id}`, 0);
      }
      s.stock[id] = s.stock[id].filter((l) => l.expires > s.day);
    }
    if (s.debt && s.money > 120000) {
      const repaid = Math.min(s.debt, s.money - 100000);
      s.debt -= repaid;
      log(s, "Hoàn vốn vay", -repaid);
    }
    return say(
      `Ngày ${s.day}: kiểm tra hạn dùng và chuẩn bị đủ kho cho menu đã mở.`,
    );
  }
  if (s.phase !== "open") return s;
  if (a.type === "tick") {
    const dt = Math.max(0, Math.min(a.dt, 1));
    s.clock += dt;
    if (s.feedback) {
      s.feedback.remaining -= dt;
      if (s.feedback.remaining <= 0) s.feedback = null;
    }
    if (s.cup && s.cup.sealLeft > 0) {
      s.cup.sealLeft = Math.max(0, s.cup.sealLeft - dt);
      if (s.cup.sealLeft === 0) s.cup.sealed = true;
    }
    for (const o of s.orders) o.remaining -= dt;
    const left = s.orders.filter((o) => o.remaining <= 0);
    if (left.length) {
      s.stats.lost += left.length;
      s.feedback = {
        customer: left[0].customer,
        mood: "angry",
        remaining: 3,
        text: "Mình đã chờ lâu quá…",
      };
      s.reputation = Math.max(1, s.reputation - 0.1 * left.length);
      if (left.some((o) => o.id === s.orders[0]?.id)) s.cup = null;
      s.orders = s.orders.filter((o) => o.remaining > 0);
      s.message = "Khách đã chờ quá lâu và rời đi…";
    }
    enqueue(s);
    if (!s.orders.length) finish(s);
    return s;
  }
  if (a.type === "cup") {
    if (s.cup) return say("Bỏ ly hiện tại trước khi chọn ly mới.");
    if (a.size === "L" && !s.upgrades.size) return say("Size L chưa mở khóa.");
    if (!consume(s, `cup${a.size}`, 1)) return say("Hết ly!");
    s.cup = {
      size: a.size,
      tea: null,
      fill: 0,
      topping: null,
      flavor: null,
      sugar: null,
      ice: null,
      sealed: false,
      sealLeft: 0,
      cost: a.size === "M" ? 700 : 900,
      pourAt: -99,
    };
    return say("Chọn bình trà, nhấn giữ vòi và thả trong vùng vạch xanh.");
  }
  if (a.type === "trash") {
    s.cup = null;
    return say("Đã bỏ ly. Nguyên liệu đã dùng không hoàn lại.");
  }
  const c = s.cup;
  if (!c) return say("Chọn một chiếc ly trước nhé.");
  if (c.sealed || c.sealLeft > 0) {
    if (a.type !== "serve") return say("Ly đang dán hoặc đã có nắp.");
  }
  if (a.type === "pour") {
    if (
      !teas.some((t) => t.id === a.tea) ||
      !unlocked(s, a.tea) ||
      !Number.isFinite(a.dt)
    )
      return s;
    if (c.sealed || c.sealLeft > 0 || c.fill >= 1.1) return s;
    if (c.tea && c.tea !== a.tea)
      return say("Không trộn hai loại trà trong cùng ly.");
    const amount = Math.min(Math.max(0, a.dt) * 0.32, 1.1 - c.fill);
    const qty = amount * (c.size === "L" ? 1.5 : 1);
    if (
      quantity(s, a.tea) < qty ||
      (a.tea === "milk" && quantity(s, "milkPowder") < qty * 0.3)
    )
      return say("Đã hết nguyên liệu của bình này.");
    if (!consume(s, a.tea, qty)) return s;
    if (a.tea === "milk") consume(s, "milkPowder", qty * 0.3);
    c.tea = a.tea;
    c.fill += amount;
    c.pourAt = s.clock;
    return s;
  }
  if (a.type === "top") {
    if (!toppings.some((t) => t.id === a.id) || !unlocked(s, a.id)) return s;
    if (c.topping) return say("Ly đã có topping.");
    if (!consume(s, a.id, 1)) return say("Hết topping này.");
    c.topping = a.id;
    return say("Topping vừa rơi vào ly!");
  }
  if (a.type === "flavor") {
    if (!flavors.some((t) => t.id === a.id) || !unlocked(s, a.id)) return s;
    if (c.flavor) return say("Ly đã có hương vị.");
    if (a.id !== "plain" && !consume(s, a.id, 1))
      return say("Hết hương vị này.");
    c.flavor = a.id;
    return s;
  }
  if (a.type === "sugar") {
    if (![0, 30, 50, 70, 100].includes(a.value)) return s;
    if (c.sugar !== null) return say("Đã thêm đường.");
    if (a.value > 0 && !consume(s, "sugar", a.value / 100))
      return say("Hết đường.");
    c.sugar = a.value;
    return s;
  }
  if (a.type === "ice") {
    if (![0, 50, 100].includes(a.value)) return s;
    if (c.ice !== null) return say("Đã thêm đá.");
    if (a.value > 0 && !consume(s, "ice", a.value / 100)) return say("Hết đá.");
    c.ice = a.value;
    return s;
  }
  if (a.type === "seal") {
    if (
      !c.tea ||
      c.fill < 0.6 ||
      !c.topping ||
      !c.flavor ||
      c.sugar === null ||
      c.ice === null
    )
      return say("Cần đủ trà (≥60%), topping, hương vị, đường và đá.");
    if (!consume(s, "lid", 1)) return say("Hết nắp!");
    c.sealLeft = Math.max(
      0.25,
      1.6 - 0.35 * (s.upgrades.sealer ?? 0) - 0.5 * (s.upgrades.staff ?? 0),
    );
    return say("Máy đang dán nắp…");
  }
  if (a.type === "serve") {
    if (!complete(c) || !s.orders.length)
      return say("Chưa thể giao: hoàn thành ly và chờ dán nắp.");
    const order = s.orders.shift()!;
    const q = Math.max(
      0,
      1 - (1 - quality(c, order.recipe)) * customers[order.customer].strictness,
    );
    const base = Math.round(order.recipe.price * q);
    const tip =
      q >= 0.9
        ? Math.round(
            base *
              (0.05 +
                0.05 * (s.upgrades.decor ?? 0) +
                (customers[order.customer].personality === "VIP" ? 0.05 : 0)),
          )
        : 0;
    log(s, `Đơn #${order.id}`, base + tip);
    s.stats.revenue += base + tip;
    s.stats.served++;
    s.reputation = Math.max(
      1,
      Math.min(5, s.reputation + (q >= 0.9 ? 0.04 : -0.12)),
    );
    s.cup = null;
    s.feedback = {
      customer: order.customer,
      mood:
        q >= 0.99
          ? "happy"
          : q >= 0.8
            ? "satisfied"
            : q >= 0.4
              ? "sad"
              : "angry",
      remaining: 3,
      text: q >= 0.9 ? "Ngon quá, cảm ơn Mây!" : "Lần sau pha đúng đơn nhé.",
    };
    s.message =
      q >= 0.9
        ? `${customers[order.customer].name}: Ngon quá! Cảm ơn Mây. +${base + tip}đ`
        : `Khách chấm ${Math.round(q * 100)}% — hãy đọc kỹ đơn. +${base}đ`;
    enqueue(s);
    if (!s.orders.length) finish(s);
    return s;
  }
  return s;
}
const finite = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  finite(n, min, max) && Number.isInteger(n);
const text = (v: unknown) => typeof v === "string" && v.length < 500;
export function validate(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State;
  try {
    if (s.incidents !== undefined && !validIncidents(s.incidents)) return false;
    if (s.progression !== undefined && !validProgression(s.progression))
      return false;
    if (
      s.version !== 2 ||
      !integer(s.day, 1) ||
      !finite(s.money, -1000000) ||
      !integer(s.debt) ||
      !integer(s.creditDay) ||
      !finite(s.reputation, 1, 5) ||
      !integer(s.seed, 0, 4294967295) ||
      !integer(s.sequence) ||
      !integer(s.generated) ||
      !integer(s.target, 1, 100) ||
      !finite(s.clock) ||
      typeof s.paused !== "boolean" ||
      typeof s.sound !== "boolean" ||
      typeof s.tutorial !== "boolean" ||
      !text(s.message) ||
      !["prep", "open", "summary"].includes(s.phase)
    )
      return false;
    if (
      !Array.isArray(s.orders) ||
      s.orders.length > 3 ||
      !s.stock ||
      typeof s.stock !== "object" ||
      !s.stats ||
      !s.decor ||
      !s.upgrades ||
      !Array.isArray(s.history) ||
      s.history.length > 365 ||
      !Array.isArray(s.ledger) ||
      s.ledger.length > 600
    )
      return false;
    for (const [id, lv] of Object.entries(s.upgrades)) {
      const u = upgrades.find((u) => u.id === id);
      if (!u || !integer(lv, 0, u.max)) return false;
    }
    const decorKeys = [
      "awning",
      "sign",
      "wall",
      "counter",
      "shelf",
      "plant",
      "lamp",
      "cup",
    ];
    if (
      decorKeys.some((id) => !integer(s.decor[id], 0, 2)) ||
      Object.keys(s.decor).length !== 8
    )
      return false;
    for (const [id, lots] of Object.entries(s.stock))
      if (
        !supplies.some((i) => i.id === id) ||
        !Array.isArray(lots) ||
        lots.length > 200 ||
        lots.some((l) => !finite(l.qty, 0, 10000) || !integer(l.expires, 1))
      )
        return false;
    for (const h of [s.stats, ...s.history])
      if (
        !integer(h.day, 1) ||
        !integer(h.served) ||
        !integer(h.lost) ||
        ![h.revenue, h.cogs, h.expenses, h.waste].every((n) => finite(n)) ||
        !finite(h.profit, -100000000)
      )
        return false;
    for (const l of s.ledger)
      if (!integer(l.day, 1) || !text(l.kind) || !finite(l.amount, -100000000))
        return false;
    for (const o of s.orders) {
      const r = o.recipe;
      if (
        !integer(o.id, 1) ||
        o.id > s.sequence ||
        !integer(o.customer, 0, 19) ||
        !finite(o.remaining, 0, 10000) ||
        !finite(o.total, 1, 10000) ||
        !r ||
        !recipes.some(
          (c) =>
            c.id === r.id &&
            c.tea === r.tea &&
            c.size === r.size &&
            c.topping === r.topping &&
            c.flavor === r.flavor &&
            c.price === r.price,
        ) ||
        ![0, 30, 50, 70, 100].includes(r.sugar) ||
        ![0, 50, 100].includes(r.ice)
      )
        return false;
    }
    const c = s.cup;
    if (c !== null) {
      if (
        !c ||
        !["M", "L"].includes(c.size) ||
        !finite(c.fill, 0, 1.101) ||
        !finite(c.cost) ||
        !finite(c.pourAt, -1000) ||
        !finite(c.sealLeft, 0, 10) ||
        typeof c.sealed !== "boolean" ||
        (c.tea !== null && !teas.some((t) => t.id === c.tea)) ||
        (c.topping !== null && !toppings.some((t) => t.id === c.topping)) ||
        (c.flavor !== null && !flavors.some((t) => t.id === c.flavor)) ||
        (c.sugar !== null && ![0, 30, 50, 70, 100].includes(c.sugar)) ||
        (c.ice !== null && ![0, 50, 100].includes(c.ice))
      )
        return false;
    }
    if (
      s.feedback !== null &&
      (!s.feedback ||
        !integer(s.feedback.customer, 0, 19) ||
        !finite(s.feedback.remaining, 0, 10) ||
        !["happy", "sad", "angry", "satisfied"].includes(s.feedback.mood) ||
        !text(s.feedback.text))
    )
      return false;
    invariant(s);
    return true;
  } catch {
    return false;
  }
}
export function invariant(s: State) {
  for (const n of [
    s.money,
    s.debt,
    s.reputation,
    s.clock,
    s.stats.revenue,
    s.stats.cogs,
    s.stats.waste,
  ])
    if (!Number.isFinite(n)) throw Error("Non-finite state");
  for (const lots of Object.values(s.stock))
    for (const l of lots)
      if (!Number.isFinite(l.qty) || l.qty < 0 || !Number.isFinite(l.expires))
        throw Error("Invalid stock");
  if (new Set(s.orders.map((o) => o.id)).size !== s.orders.length)
    throw Error("Duplicate order");
  for (const o of s.orders)
    if (
      !Number.isFinite(o.remaining) ||
      !recipes.some((r) => r.id === o.recipe.id) ||
      !customers[o.customer]
    )
      throw Error("Invalid order");
  if (
    s.cup &&
    (!Number.isFinite(s.cup.fill) || s.cup.fill < 0 || s.cup.fill > 1.101)
  )
    throw Error("Invalid cup");
  if (s.phase === "open" && !s.orders.length) throw Error("Stuck queue");
}
