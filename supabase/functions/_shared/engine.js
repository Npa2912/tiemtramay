// src/incidents.ts
function dailyRoll(seed, day, salt) {
  let x = (seed ^ Math.imul(day, 2654435769) ^ salt) >>> 0;
  x = Math.imul(x ^ x >>> 16, 569420461);
  x = Math.imul(x ^ x >>> 15, 1935289751);
  return ((x ^ x >>> 15) >>> 0) / 4294967296;
}
function createIncidents(seed, day) {
  return {
    version: 1,
    day,
    theftPlanned: dailyRoll(seed, day, 101) < 0.35,
    powerPlanned: dailyRoll(seed, day, 202) < 0.2,
    machinePlanned: dailyRoll(seed, day, 303) < 0.15,
    theftChecked: false,
    powerChecked: false,
    machineChecked: false,
    powerLeft: 0,
    machineBroken: false,
    expires: {},
    theft: null,
    notice: ""
  };
}
function ensureIncidents(input) {
  if (input.incidents) return input;
  const incidents = createIncidents(input.seed, input.day);
  if (input.progression?.event?.id === "theft") incidents.theftChecked = true;
  if (input.progression?.event?.id === "power") incidents.powerChecked = true;
  if (input.progression?.event?.id === "machine")
    incidents.machineChecked = true;
  if (input.progression?.security.lock) incidents.expires.lock = input.day;
  if (input.progression?.security.camera)
    incidents.expires.camera = input.day + 9;
  return { ...input, incidents };
}
function validIncidents(v) {
  if (!v || typeof v !== "object") return false;
  const i = v;
  return i.version === 1 && Number.isSafeInteger(i.day) && i.day >= 1 && [
    "theftPlanned",
    "powerPlanned",
    "machinePlanned",
    "theftChecked",
    "powerChecked",
    "machineChecked",
    "machineBroken"
  ].every((k) => typeof i[k] === "boolean") && Number.isFinite(i.powerLeft) && i.powerLeft >= 0 && i.powerLeft <= 60 && typeof i.notice === "string" && i.notice.length < 1e3 && !!i.expires && typeof i.expires === "object" && Object.entries(i.expires).every(
    ([k, v2]) => ["lock", "camera"].includes(k) && Number.isSafeInteger(v2) && v2 >= 1
  ) && (i.theft === null || !!i.theft && Number.isSafeInteger(i.theft.day) && i.theft.day >= 1 && Number.isSafeInteger(i.theft.amount) && i.theft.amount >= 0 && typeof i.theft.recovered === "boolean" && (i.theft.camera === void 0 || typeof i.theft.camera === "boolean"));
}
function securityActive(s, id) {
  if (!s.progression?.security[id]) return false;
  if (id !== "lock" && id !== "camera") return true;
  const expiry = s.incidents?.expires[id];
  return expiry === void 0 || expiry >= s.day;
}
function preventsMachineBreakdown(s) {
  const barista = s.progression?.staff.barista;
  const maintenance = 0.1 * (s.upgrades.sealer ?? 0) + 0.1 * (s.upgrades.staff ?? 0) + (barista?.active ? 0.05 * barista.level : 0);
  return maintenance > 0 && dailyRoll(s.seed, s.day, 404) < maintenance;
}
function productionBlocked(s) {
  return !!s.incidents && (s.incidents.machineBroken || s.incidents.powerLeft > 0 && !securityActive(s, "generator"));
}
function expense(s, kind, amount) {
  s.money -= amount;
  s.ledger.push({ day: s.day, kind, amount: -amount });
  s.ledger = s.ledger.slice(-600);
  if (s.progression) {
    if (s.phase === "summary") {
      s.stats.expenses += amount;
      s.stats.profit = s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
      if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    } else
      s.progression.eventExpenses = (s.progression.eventExpenses ?? 0) + amount;
  }
}
function history(s, id, text2) {
  if (s.progression) {
    s.progression.eventHistory.push({
      id,
      day: s.day,
      choice: "incident",
      text: text2
    });
    s.progression.eventHistory = s.progression.eventHistory.slice(-200);
    s.progression.metrics.events++;
  }
  s.message = text2;
}
var brewActions = /* @__PURE__ */ new Set([
  "cup",
  "pour",
  "top",
  "flavor",
  "sugar",
  "ice",
  "seal",
  "serve",
  "trash",
  "selectOrder"
]);
function interceptIncident(input, a) {
  const source = ensureIncidents(input), i = source.incidents;
  if (a.type === "dismissIncident") {
    const s = structuredClone(source);
    s.incidents.notice = "";
    return s;
  }
  if (a.type === "recoverTheft") {
    const s = structuredClone(source), theft = s.incidents.theft;
    if (theft && theft.day === s.day && theft.camera && !theft.recovered && securityActive(s, "camera")) {
      s.money += theft.amount;
      s.ledger.push({
        day: s.day,
        kind: "Camera: thu h\u1ED3i ti\u1EC1n th\u1EA5t l\u1EA1c",
        amount: theft.amount
      });
      s.ledger = s.ledger.slice(-600);
      theft.recovered = true;
      if (s.progression) {
        if (s.phase === "summary") {
          s.stats.expenses = Math.max(0, s.stats.expenses - theft.amount);
          s.stats.profit = s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
          if (s.history.length)
            s.history[s.history.length - 1] = { ...s.stats };
        } else
          s.progression.eventExpenses = Math.max(
            0,
            (s.progression.eventExpenses ?? 0) - theft.amount
          );
      }
      s.incidents.notice = "Camera \u0111\xE3 gi\xFAp \u0111\u1ED1i chi\u1EBFu v\xE0 thu h\u1ED3i ti\u1EC1n th\u1EA5t l\u1EA1c.";
    }
    return s;
  }
  if (a.type === "security" && a.id === "backup" && i.machineBroken) {
    return source;
  }
  if (a.type === "repairMachine" || a.type === "advanceRepair" || a.type === "useBackup") {
    if (!i.machineBroken) return source;
    const s = structuredClone(source);
    if (a.type === "useBackup") {
      if (!securityActive(s, "backup")) return source;
    } else {
      const shortfall = Math.max(0, Math.ceil(5e4 - s.money));
      if (a.type === "advanceRepair") {
        if (!shortfall) return source;
        s.money += shortfall;
        s.debt += shortfall;
        s.ledger = [...s.ledger, {
          day: s.day,
          kind: "\u1EE8ng ti\u1EC1n s\u1EEDa m\xE1y (kh\xF4ng l\xE3i)",
          amount: shortfall
        }].slice(-600);
      } else if (shortfall) {
        s.message = "C\u1EA7n 50.000\u0111 \u0111\u1EC3 s\u1EEDa m\xE1y. C\xF3 th\u1EC3 \u1EE9ng ph\u1EA7n c\xF2n thi\u1EBFu.";
        return s;
      }
      expense(s, "S\u1EEDa m\xE1y d\xE1n n\u1EAFp", 5e4);
    }
    s.incidents.machineBroken = false;
    if (s.phase === "open") s.paused = false;
    s.incidents.notice = a.type === "useBackup" ? "M\xE1y d\u1EF1 ph\xF2ng \u0111\xE3 ti\u1EBFp qu\u1EA3n. Ti\u1EBFp t\u1EE5c pha ly \u0111ang l\xE0m nh\xE9!" : "M\xE1y \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EEDa. Ti\u1EBFp t\u1EE5c pha ly \u0111ang l\xE0m nh\xE9!";
    s.message = s.incidents.notice;
    return s;
  }
  if (a.type === "tick" && productionBlocked(source) && source.phase === "open") {
    if (source.paused) return source;
    const s = structuredClone(source);
    s.incidents.powerLeft = Math.max(
      0,
      s.incidents.powerLeft - Math.max(0, Math.min(1, Number.isFinite(a.dt) ? a.dt : 0))
    );
    if (i.powerLeft > 0 && s.incidents.powerLeft === 0)
      s.incidents.notice = "\u0110i\u1EC7n \u0111\xE3 tr\u1EDF l\u1EA1i! Qu\u1EA7y ti\u1EBFp t\u1EE5c ho\u1EA1t \u0111\u1ED9ng.";
    return s;
  }
  if (brewActions.has(a.type) && productionBlocked(source)) return source;
  if (!source.paused && source.phase === "open" && source.cup && (a.type === "pour" || a.type === "seal")) {
    if (!i.powerChecked && i.powerPlanned) {
      const s = structuredClone(source);
      s.incidents.powerChecked = true;
      s.incidents.powerLeft = securityActive(s, "generator") ? 0 : 60;
      history(
        s,
        "power",
        securityActive(s, "generator") ? "M\u1EA5t \u0111i\u1EC7n! M\xE1y ph\xE1t \u0111\xE3 b\u1EADt, qu\u1EA7y v\u1EABn ho\u1EA1t \u0111\u1ED9ng." : "M\u1EA5t \u0111i\u1EC7n! Qu\u1EA7y t\u1EA1m d\u1EEBng 60 gi\xE2y; kh\xE1ch v\xE0 ly \u0111ang pha \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn."
      );
      s.incidents.notice = s.message;
      if (s.incidents.powerLeft > 0) return s;
    }
    if (!i.machineChecked && i.machinePlanned && !preventsMachineBreakdown(source)) {
      const s = structuredClone(source);
      s.incidents.machineChecked = true;
      s.incidents.machineBroken = true;
      history(
        s,
        "machine",
        "M\xE1y d\xE1n n\u1EAFp b\u1ECB h\u1ECFng! S\u1EEDa 50.000\u0111 ho\u1EB7c d\xF9ng m\xE1y d\u1EF1 ph\xF2ng \u0111\xE3 c\xF3."
      );
      s.incidents.notice = s.message;
      return s;
    }
  }
  return null;
}
function afterIncidents(previous, next, a) {
  if (previous === next) return next;
  const s = ensureIncidents(next), i = s.incidents;
  if (s.day !== i.day) {
    const fresh = createIncidents(previous.seed, s.day);
    fresh.expires = { ...i.expires };
    fresh.theft = i.theft;
    fresh.machineBroken = i.machineBroken;
    s.incidents = fresh;
    for (const id of ["lock", "camera"])
      if (fresh.expires[id] !== void 0 && fresh.expires[id] < s.day && s.progression)
        delete s.progression.security[id];
  }
  if (a.type === "security" && s.progression?.security[a.id] && !previous.progression?.security[a.id]) {
    if (a.id === "lock") s.incidents.expires.lock = s.day;
    if (a.id === "camera") s.incidents.expires.camera = s.day + 9;
    if (a.id === "backup") s.incidents.machineBroken = false;
    if (a.id === "generator") s.incidents.powerLeft = 0;
  }
  const current = s.incidents;
  if (!s.paused && s.phase === "open" && s.cup && (a.type === "pour" || a.type === "seal")) {
    if (!current.theftChecked) {
      current.theftChecked = true;
      if (current.theftPlanned) {
        const loss = securityActive(s, "lock") ? 0 : Math.floor(
          Math.max(0, s.money) * (securityActive(s, "safe") ? 0.05 : 0.1)
        );
        current.theft = {
          day: s.day,
          amount: loss,
          recovered: loss === 0,
          camera: securityActive(s, "camera")
        };
        if (loss) expense(s, "M\u1EA5t tr\u1ED9m: th\u1EA5t tho\xE1t v\u1ED1n", loss);
        history(
          s,
          "theft",
          loss ? `Qu\u1EA7y b\u1ECB tr\u1ED9m ${loss.toLocaleString("vi-VN")}\u0111 (${securityActive(s, "safe") ? "5% nh\u1EDD k\xE9t ti\u1EC1n" : "10% v\u1ED1n hi\u1EC7n c\xF3"}).` : securityActive(s, "lock") ? "Kh\xF3a ch\u1ED1ng tr\u1ED9m h\xF4m nay \u0111\xE3 b\u1EA3o v\u1EC7 to\xE0n b\u1ED9 ti\u1EC1n qu\u1EA7y." : "V\u1EE5 tr\u1ED9m kh\xF4ng g\xE2y th\u1EA5t tho\xE1t v\xEC qu\u1EF9 hi\u1EC7n kh\xF4ng c\xF3 s\u1ED1 d\u01B0."
        );
        current.notice = s.message;
      }
    }
    if (!current.powerChecked) {
      current.powerChecked = true;
      if (current.powerPlanned) {
        current.powerLeft = securityActive(s, "generator") ? 0 : 60;
        history(
          s,
          "power",
          current.powerLeft ? "M\u1EA5t \u0111i\u1EC7n! \u0110\u1EE3i 60 gi\xE2y ho\u1EB7c d\xF9ng m\xE1y ph\xE1t." : "M\u1EA5t \u0111i\u1EC7n, m\xE1y ph\xE1t \u0111ang duy tr\xEC qu\u1EA7y."
        );
        current.notice = s.message;
      }
    }
    if (!current.machineChecked) {
      current.machineChecked = true;
      if (current.machinePlanned) {
        current.machineBroken = !preventsMachineBreakdown(s);
        history(
          s,
          "machine",
          current.machineBroken ? "M\xE1y h\u1ECFng! S\u1EEDa 50.000\u0111 ho\u1EB7c d\xF9ng m\xE1y d\u1EF1 ph\xF2ng \u0111\xE3 c\xF3." : "M\xE1y \u0111\u01B0\u1EE3c b\u1EA3o tr\xEC k\u1ECBp th\u1EDDi, qu\u1EA7y ti\u1EBFp t\u1EE5c ho\u1EA1t \u0111\u1ED9ng."
        );
        current.notice = s.message;
      }
    }
  }
  return s;
}

// src/catalog.ts
var teas = [
  { id: "milk", name: "Tr\xE0 s\u1EEFa", color: 13211248, day: 1 },
  { id: "black", name: "H\u1ED3ng tr\xE0", color: 11824709, day: 1 },
  { id: "matcha", name: "Matcha", color: 11061386, day: 3 },
  { id: "green", name: "L\u1EE5c tr\xE0", color: 11713897, day: 5 },
  { id: "oolong", name: "Oolong", color: 14132836, day: 8 },
  { id: "thai", name: "Tr\xE0 Th\xE1i", color: 15639381, day: 10 }
];
var toppings = [
  { id: "pearl", name: "Tr\xE2n ch\xE2u", day: 1 },
  { id: "pudding", name: "Pudding", day: 3 },
  { id: "jelly", name: "Th\u1EA1ch c\xE0 ph\xEA", day: 5 },
  { id: "aloe", name: "Nha \u0111am", day: 11 }
];
var flavors = [
  { id: "plain", name: "Nguy\xEAn v\u1ECB", day: 1 },
  { id: "peach", name: "\u0110\xE0o", day: 6 },
  { id: "berry", name: "D\xE2u", day: 10 }
];
var supplies = [
  ...teas.map((t) => ({
    id: t.id,
    name: t.name,
    price: 2400,
    pack: 20,
    life: 4
  })),
  { id: "milkPowder", name: "S\u1EEFa", price: 1500, pack: 20, life: 4 },
  { id: "sugar", name: "\u0110\u01B0\u1EDDng", price: 300, pack: 20, life: 8 },
  { id: "ice", name: "\u0110\xE1", price: 300, pack: 20, life: 2 },
  ...toppings.map((t) => ({
    id: t.id,
    name: t.name,
    price: 1e3,
    pack: 20,
    life: 3
  })),
  { id: "peach", name: "H\u01B0\u01A1ng \u0111\xE0o", price: 600, pack: 20, life: 6 },
  { id: "berry", name: "H\u01B0\u01A1ng d\xE2u", price: 600, pack: 20, life: 6 },
  { id: "cupM", name: "Ly M", price: 700, pack: 20, life: 999 },
  { id: "cupL", name: "Ly L", price: 900, pack: 20, life: 999 },
  { id: "lid", name: "N\u1EAFp", price: 300, pack: 20, life: 999 }
];
var upgrades = [
  ...teas.filter((t) => t.day > 1).map((t) => ({
    id: "tea-" + t.id,
    name: "M\u1EDF b\xECnh " + t.name,
    desc: "Cho ph\xE9p pha v\xE0 nh\u1EADn \u0111\u01A1n " + t.name,
    price: 12e3 + t.day * 1e3,
    day: t.day,
    max: 1
  })),
  ...toppings.filter((t) => t.day > 1).map((t) => ({
    id: "top-" + t.id,
    name: "M\u1EDF " + t.name,
    desc: "Th\xEAm topping n\xE0y v\xE0o menu",
    price: 14e3,
    day: t.day,
    max: 1
  })),
  ...flavors.filter((t) => t.day > 1).map((t) => ({
    id: "flavor-" + t.id,
    name: "M\u1EDF h\u01B0\u01A1ng " + t.name,
    desc: "Th\xEAm h\u01B0\u01A1ng v\u1ECB n\xE0y v\xE0o menu",
    price: 1e4,
    day: t.day,
    max: 1
  })),
  {
    id: "size",
    name: "Ly l\u1EDBn, ni\u1EC1m vui l\u1EDBn",
    desc: "M\u1EDF size L t\u1EEB ng\xE0y 3",
    price: 25e3,
    day: 3,
    max: 1
  },
  {
    id: "sealer",
    name: "M\xE1y d\xE1n n\u1EAFp",
    desc: "M\u1ED7i c\u1EA5p ng\u0103n 10% s\u1EF1 c\u1ED1 m\xE1y d\xE1n n\u1EAFp",
    price: 18e3,
    day: 1,
    max: 3
  },
  {
    id: "counter",
    name: "Qu\u1EA7y r\u1ED9ng r\xE3i",
    desc: "Kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 15 gi\xE2y/c\u1EA5p",
    price: 22e3,
    day: 2,
    max: 3
  },
  {
    id: "storage",
    name: "Kho g\u1ECDn g\xE0ng",
    desc: "T\u0103ng s\u1EE9c ch\u1EE9a m\u1ED7i lo\u1EA1i th\xEAm 40",
    price: 18e3,
    day: 1,
    max: 3
  },
  {
    id: "fridge",
    name: "T\u1EE7 l\u1EA1nh M\xE2y",
    desc: "H\u1EA1n d\xF9ng t\u0103ng th\xEAm 2 ng\xE0y/c\u1EA5p",
    price: 28e3,
    day: 3,
    max: 2
  },
  {
    id: "staff",
    name: "B\u1EA1n \u0111\u1ED3ng h\xE0nh",
    desc: "Ng\u0103n 10% s\u1EF1 c\u1ED1 m\xE1y n\u1EAFp, l\u01B0\u01A1ng 8.000\u0111/ng\xE0y",
    price: 3e4,
    day: 5,
    max: 1
  },
  {
    id: "decor",
    name: "Kh\xF4ng gian \u1EA5m \xE1p",
    desc: "T\u0103ng ti\u1EC1n tip 5%/c\u1EA5p",
    price: 14e3,
    day: 1,
    max: 3
  }
];
var names = [
  "An",
  "B\xECnh",
  "Chi",
  "D\u0169ng",
  "H\xE0",
  "H\u1EA3i",
  "H\xE2n",
  "Kh\xF4i",
  "Lan",
  "Linh",
  "Mai",
  "Minh",
  "My",
  "Nam",
  "Ng\xE2n",
  "Ph\xFAc",
  "Qu\xE2n",
  "Th\u1EA3o",
  "Tr\xE2m",
  "Vy"
];
var customerArchetypes = [
  {
    name: "H\u1ECDc sinh",
    dialogue: "Cho m\xECnh m\u1ED9t ly tr\u01B0\u1EDBc gi\u1EDD v\xE0o l\u1EDBp nh\xE9!",
    sugar: 70,
    budget: 4e4,
    frequency: 1.3
  },
  {
    name: "Sinh vi\xEAn",
    dialogue: "M\u1ED9t ch\xFAt tr\xE0 cho bu\u1ED5i h\u1ECDc nh\xF3m h\xF4m nay.",
    sugar: 50,
    budget: 45e3,
    frequency: 1.4
  },
  {
    name: "Nh\xE2n vi\xEAn v\u0103n ph\xF2ng",
    dialogue: "M\xECnh tranh th\u1EE7 gh\xE9 trong gi\u1EDD ngh\u1EC9.",
    sugar: 30,
    budget: 5e4,
    frequency: 1.2
  },
  {
    name: "Kh\xE1ch du l\u1ECBch",
    dialogue: "Ti\u1EC7m xinh qu\xE1, m\xF3n n\xE0o l\xE0 \u0111\u1EB7c tr\u01B0ng v\u1EADy?",
    sugar: 70,
    budget: 6e4,
    frequency: 0.8
  },
  {
    name: "Ng\u01B0\u1EDDi cao tu\u1ED5i",
    dialogue: "Ch\xE1u pha v\u1ECB thanh nh\u1EB9 gi\xFAp c\xF4 nh\xE9.",
    sugar: 30,
    budget: 45e3,
    frequency: 0.7
  },
  {
    name: "Kh\xE1ch quen",
    dialogue: "M\xE2y \u01A1i, h\xF4m nay ti\u1EC7m m\xECnh c\xF3 g\xEC m\u1EDBi?",
    sugar: 50,
    budget: 5e4,
    frequency: 1.3
  },
  {
    name: "Kh\xE1ch kh\xF3 t\xEDnh",
    dialogue: "M\xECnh th\xEDch \u0111\xFAng v\u1ECB ghi trong \u0111\u01A1n nh\xE9.",
    sugar: 30,
    budget: 6e4,
    frequency: 0.8
  },
  {
    name: "Kh\xE1ch th\xEDch ng\u1ECDt",
    dialogue: "H\xF4m nay m\xECnh mu\u1ED1n m\u1ED9t ch\xFAt ng\u1ECDt ng\xE0o!",
    sugar: 100,
    budget: 45e3,
    frequency: 1
  },
  {
    name: "Kh\xE1ch \xEDt \u0111\u01B0\u1EDDng",
    dialogue: "\xCDt \u0111\u01B0\u1EDDng gi\xFAp m\xECnh nh\xE9, c\u1EA3m \u01A1n M\xE2y.",
    sugar: 30,
    budget: 45e3,
    frequency: 1
  },
  {
    name: "Kh\xE1ch mang \u0111i",
    dialogue: "M\xECnh mang \u0111i, nh\u1EDB d\xE1n n\u1EAFp th\u1EADt k\xEDn nha.",
    sugar: 50,
    budget: 5e4,
    frequency: 1.1
  },
  {
    name: "Kh\xE1ch \u0111i theo nh\xF3m",
    dialogue: "C\u1EA3 nh\xF3m s\u1EBD l\u1EA7n l\u01B0\u1EE3t g\u1ECDi m\xF3n nh\xE9!",
    sugar: 70,
    budget: 7e4,
    frequency: 0.7
  },
  {
    name: "Kh\xE1ch v\u1ED9i",
    dialogue: "M\xECnh s\u1EAFp t\u1EDBi gi\u1EDD xe ch\u1EA1y r\u1ED3i.",
    sugar: 50,
    budget: 55e3,
    frequency: 0.8
  },
  {
    name: "Ng\u01B0\u1EDDi kh\xE1m ph\xE1 v\u1ECB m\u1EDBi",
    dialogue: "M\xECnh mu\u1ED1n th\u1EED c\xF4ng th\u1EE9c m\u1EDBi nh\u1EA5t c\u1EE7a M\xE2y.",
    sugar: 30,
    budget: 65e3,
    frequency: 1
  },
  {
    name: "Kh\xE1ch ng\xE0y h\u1ED9i",
    dialogue: "Ng\xE0y h\u1ED9i th\u1EADt vui, m\xECnh gh\xE9 \u1EE7ng h\u1ED9 ti\u1EC7m!",
    sugar: 70,
    budget: 6e4,
    frequency: 0.6
  },
  {
    name: "Ng\u01B0\u1EDDi y\xEAu tr\xE0",
    dialogue: "H\u01B0\u01A1ng tr\xE0 \u1EDF \u0111\xE2y l\xE0m m\xECnh nh\u1EDB qu\xEA nh\xE0.",
    sugar: 30,
    budget: 7e4,
    frequency: 0.9
  }
];
var ordinaryCustomerIndex = 0;
var customers = names.map((name, i) => {
  const vip = i % 4 === 3;
  const archetype = vip ? {
    name: "VIP",
    dialogue: "M\xECnh nghe nhi\u1EC1u l\u1EDDi khen v\u1EC1 ti\u1EC7m M\xE2y.",
    sugar: 50,
    budget: 1e5,
    frequency: 0.45
  } : customerArchetypes[ordinaryCustomerIndex++];
  return {
    id: i,
    name,
    avatar: `/assets/customer-${i}.svg`,
    personality: archetype.name,
    dialogue: archetype.dialogue,
    patience: 105 + i % 5 * 12,
    strictness: i % 4 === 2 ? 1.2 : 1,
    preference: teas[i % 6].id,
    preferredSugar: archetype.sugar,
    budget: archetype.budget,
    frequency: archetype.frequency,
    relationshipMilestones: [
      {
        visits: 3,
        name: "M\u1ED9t g\u01B0\u01A1ng m\u1EB7t quen",
        story: `${name} \u0111\xE3 nh\u1EDB g\xF3c qu\u1EA7y v\xE0 n\u1EE5 c\u01B0\u1EDDi c\u1EE7a M\xE2y.`
      },
      {
        visits: 10,
        name: "Ng\u01B0\u1EDDi b\u1EA1n c\u1EE7a ti\u1EC7m",
        story: `${name} th\u01B0\u1EDDng k\u1EC3 chuy\u1EC7n trong ng\xE0y khi gh\xE9 u\u1ED1ng tr\xE0.`
      },
      {
        visits: 25,
        name: "M\u1ED9t ph\u1EA7n khu ph\u1ED1",
        story: `V\u1EDBi ${name}, ti\u1EC7m M\xE2y \u0111\xE3 tr\u1EDF th\xE0nh m\u1ED9t n\u01A1i th\xE2n thu\u1ED9c.`
      }
    ]
  };
});
var recipes = Array.from({ length: 36 }, (_, i) => {
  const t = teas[i % 6], p = toppings[Math.floor(i / 6) % 4], f = flavors[Math.floor(i / 12)];
  return {
    id: `recipe-${i}`,
    tea: t.id,
    size: i >= 18 ? "L" : "M",
    topping: p.id,
    flavor: f.id,
    sugar: [70, 50, 30][Math.floor(i / 6) % 3],
    ice: i % 3 === 0 ? 50 : 100,
    price: 26e3 + (i >= 18 ? 6e3 : 0) + (f.id !== "plain" ? 4e3 : 0),
    day: Math.max(
      t.day,
      p.day,
      f.day,
      i >= 30 ? 21 : i >= 24 ? 11 : i >= 18 ? 11 : i >= 12 ? 6 : 1
    ),
    name: `${t.name} ${p.name.toLowerCase()}`
  };
});
var label = (id) => [...teas, ...toppings, ...flavors, ...supplies].find((x) => x.id === id)?.name ?? id;
function unlocked(s, id) {
  const tea = teas.find((t) => t.id === id), top = toppings.find((t) => t.id === id), flavor = flavors.find((t) => t.id === id);
  const item = tea ?? top ?? flavor;
  if (!item) return false;
  if (item.day === 1) return true;
  return s.day >= item.day && !!s.upgrades[(tea ? "tea-" : top ? "top-" : "flavor-") + id];
}

// src/progression.ts
var metricNames = [
  "served",
  "accurate",
  "revenue",
  "purchases",
  "upgrades",
  "decorations",
  "events",
  "vip",
  "regulars",
  "training",
  "staff",
  "lowSugar",
  "large",
  "flavored",
  "toppings",
  "days",
  "savings",
  "recipes",
  "security",
  "perfectDays"
];
function validOwnerName(name) {
  return typeof name === "string" && name.length >= 2 && name.length <= 30 && /^[\p{L}\p{N} .'-]+$/u.test(name) && !/(địt|đụ má|fuck|shit)/iu.test(name);
}
function createProgression() {
  return {
    schema: 1,
    metrics: Object.fromEntries(metricNames.map((k) => [k, 0])),
    relationships: {},
    tasted: [],
    claimed: [],
    staff: {},
    security: {},
    event: null,
    eventHistory: [],
    cooldowns: {},
    lastEventDay: 0,
    eventExpenses: 0,
    boosts: { patience: 0, seal: 0, tip: 0, discount: 0 },
    ownerName: "Ch\u1EE7 Ti\u1EC7m An",
    reducedMotion: false
  };
}
var finite = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
function validProgression(v) {
  if (!v || typeof v !== "object") return false;
  const p = v;
  try {
    return p.schema === 1 && !!p.metrics && metricNames.every((k) => finite(p.metrics[k])) && validOwnerName(p.ownerName) && typeof p.reducedMotion === "boolean" && Array.isArray(p.claimed) && p.claimed.every((k) => typeof k === "string") && Array.isArray(p.tasted) && p.tasted.every((k) => typeof k === "string") && !!p.staff && Object.entries(p.staff).every(
      ([id, s]) => staffCatalog.some((x) => x.id === id) && Number.isInteger(s.level) && s.level >= 1 && s.level <= 5 && typeof s.active === "boolean"
    ) && !!p.security && Object.entries(p.security).every(
      ([id, n]) => securityCatalog.some((x) => x.id === id) && n === 1
    ) && !!p.relationships && Object.values(p.relationships).every(finite) && !!p.cooldowns && Object.values(p.cooldowns).every(finite) && finite(p.lastEventDay) && (p.eventExpenses === void 0 || finite(p.eventExpenses)) && Array.isArray(p.eventHistory) && p.eventHistory.every(
      (e) => events.some((x) => x.id === e.id) && finite(e.day) && typeof e.choice === "string" && typeof e.text === "string"
    ) && (p.event === null || events.some((e) => e.id === p.event?.id) && finite(p.event.day)) && !!p.boosts && finite(p.boosts.patience) && finite(p.boosts.tip) && finite(p.boosts.discount) && typeof p.boosts.seal === "number" && Number.isFinite(p.boosts.seal) && Math.abs(p.boosts.seal) <= 2;
  } catch {
    return false;
  }
}
function migrateProgression(s) {
  const existing = s.progression;
  if (existing && !validProgression(existing))
    throw new Error(
      "D\u1EEF li\u1EC7u ti\u1EBFn tr\xECnh kh\xF4ng h\u1EE3p l\u1EC7. B\u1EA3n l\u01B0u g\u1ED1c \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn."
    );
  return { ...s, progression: existing ?? createProgression() };
}
var staffCatalog = [
  {
    id: "barista",
    name: "Miu",
    role: "Pha ch\u1EBF",
    day: 5,
    cost: 45e3,
    wage: 4e3,
    desc: "Ng\u0103n th\xEAm 5% s\u1EF1 c\u1ED1 m\xE1y d\xE1n n\u1EAFp m\u1ED7i c\u1EA5p."
  },
  {
    id: "cashier",
    name: "B\xF4ng",
    role: "Thu ng\xE2n",
    day: 8,
    cost: 5e4,
    wage: 3500,
    desc: "T\u0103ng ti\u1EC1n tip 1% gi\xE1 \u0111\u01A1n/c\u1EA5p khi pha \u0111\xFAng."
  },
  {
    id: "server",
    name: "S\xF3c",
    role: "Ph\u1EE5c v\u1EE5",
    day: 8,
    cost: 45e3,
    wage: 3500,
    desc: "Kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 3 gi\xE2y/c\u1EA5p."
  },
  {
    id: "courier",
    name: "N\u1EA5m",
    role: "Giao h\xE0ng",
    day: 10,
    cost: 6e4,
    wage: 4e3,
    desc: "Kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 2 gi\xE2y/c\u1EA5p."
  },
  {
    id: "manager",
    name: "Lam",
    role: "Qu\u1EA3n l\xFD",
    day: 15,
    cost: 8e4,
    wage: 5e3,
    desc: "Gi\u1EA3m gi\xE1 nh\u1EADp kho 1%/c\u1EA5p; h\u1ED7 tr\u1EE3 ki\u1EC3m k\xEA m\u1EA5t tr\u1ED9m."
  }
];
var securityCatalog = [
  {
    id: "lock",
    name: "Kh\xF3a ch\u1ED1ng tr\u1ED9m",
    cost: 2e4,
    day: 1,
    desc: "Ch\u1EB7n ho\xE0n to\xE0n tr\u1ED9m trong ng\xE0y mua. H\xF4m sau c\u1EA7n mua l\u1EA1i (20.000\u0111/ng\xE0y)."
  },
  {
    id: "camera",
    name: "Camera an ninh",
    cost: 5e4,
    day: 1,
    desc: "C\xF3 hi\u1EC7u l\u1EF1c 10 ng\xE0y t\xEDnh c\u1EA3 ng\xE0y mua. \u0110\u1ED1i chi\u1EBFu \u0111\u1EC3 thu h\u1ED3i ti\u1EC1n b\u1ECB tr\u1ED9m khi camera c\xF2n h\u1EA1n."
  },
  {
    id: "safe",
    name: "K\xE9t ti\u1EC1n",
    cost: 7e4,
    day: 1,
    desc: "V\u0129nh vi\u1EC5n: gi\u1EDBi h\u1EA1n t\u1ED5n th\u1EA5t do tr\u1ED9m c\xF2n 5% v\u1ED1n hi\u1EC7n c\xF3 thay v\xEC 10%."
  },
  {
    id: "generator",
    name: "M\xE1y ph\xE1t \u0111i\u1EC7n",
    cost: 6e4,
    day: 1,
    desc: "V\u0129nh vi\u1EC5n: duy tr\xEC qu\u1EA7y khi m\u1EA5t \u0111i\u1EC7n (20% m\u1ED7i ng\xE0y); kh\xF4ng c\u1EA7n \u0111\u1EE3i 60 gi\xE2y."
  },
  {
    id: "backup",
    name: "M\xE1y d\xE1n n\u1EAFp d\u1EF1 ph\xF2ng",
    cost: 25e3,
    day: 1,
    desc: "V\u0129nh vi\u1EC5n: t\u1EF1 thay m\xE1y ch\xEDnh khi h\u1ECFng. Ho\u1EB7c s\u1EEDa m\xE1y ch\xEDnh v\u1EDBi gi\xE1 50.000\u0111."
  }
];
var events = [
  {
    id: "theft",
    name: "Ti\u1EC1n qu\u1EA7y b\u1ECB thi\u1EBFu",
    story: "M\xE2y th\u1EA5y ti\u1EC1n qu\u1EA7y ch\u01B0a kh\u1EDBp s\u1ED5. C\xF3 th\u1EC3 l\xE0 nh\u1EA7m l\u1EABn ho\u1EB7c th\u1EA5t l\u1EA1c; ch\u01B0a c\xF3 b\u1EB1ng ch\u1EE9ng \u0111\u1EC3 k\u1EBFt lu\u1EADn ai g\xE2y ra.",
    day: 4,
    cooldown: 1,
    priority: 3,
    choices: [
      {
        id: "camera",
        label: "Ki\u1EC3m tra camera",
        description: "\u0110\u1ED1i chi\u1EBFu h\xECnh \u1EA3nh, thu h\u1ED3i kho\u1EA3n th\u1EA5t l\u1EA1c.",
        requires: "camera"
      },
      {
        id: "inventory",
        label: "Ki\u1EC3m k\xEA c\xF9ng nh\xE2n vi\xEAn",
        description: "\u0110\u1ED1i chi\u1EBFu s\u1ED5, gi\u1EA3m thi\u1EC7t h\u1EA1i; kh\xF4ng bu\u1ED9c t\u1ED9i ai."
      },
      {
        id: "continue",
        label: "Ghi nh\u1EADn v\xE0 ti\u1EBFp t\u1EE5c",
        description: "M\u1EA5t 10% v\u1ED1n hi\u1EC7n c\xF3; c\xF3 k\xE9t ti\u1EC1n th\xEC t\u1ED1i \u0111a 5%, c\xF3 kh\xF3a h\xF4m nay th\xEC kh\xF4ng m\u1EA5t ti\u1EC1n."
      }
    ]
  },
  {
    id: "vip",
    name: "L\u1EDDi m\u1EDDi c\u1EE7a kh\xE1ch VIP",
    story: "M\u1ED9t kh\xE1ch s\xE0nh tr\xE0 mu\u1ED1n gi\u1EDBi thi\u1EC7u ti\u1EC7m. Ch\u1EA5t l\u01B0\u1EE3ng ph\u1EE5c v\u1EE5 h\xF4m nay s\u1EBD t\u1EA1o \u1EA5n t\u01B0\u1EE3ng.",
    day: 8,
    cooldown: 6,
    priority: 2,
    choices: [
      {
        id: "welcome",
        label: "Chu\u1EA9n b\u1ECB \u0111\xF3n kh\xE1ch",
        description: "Tip cho c\xE1c ly pha \u0111\xFAng t\u0103ng 5% h\xF4m nay."
      },
      {
        id: "gift",
        label: "Chu\u1EA9n b\u1ECB qu\xE0 nh\u1ECF",
        description: "Chi 10.000\u0111, danh ti\u1EBFng +0,1.",
        cost: 1e4
      }
    ]
  },
  {
    id: "power",
    name: "M\u1EA5t \u0111i\u1EC7n trong ph\u1ED1",
    story: "\u0110i\u1EC7n v\u1EEBa ch\u1EADp ch\u1EDDn tr\u01B0\u1EDBc gi\u1EDD m\u1EDF c\u1EEDa. M\xE2y c\xF3 th\u1EC3 ch\u1EE7 \u0111\u1ED9ng chu\u1EA9n b\u1ECB \u0111\u1EC3 kh\xF4ng l\xE0m gi\xE1n \u0111o\u1EA1n \u0111\u01A1n.",
    day: 5,
    cooldown: 8,
    priority: 3,
    choices: [
      {
        id: "generator",
        label: "B\u1EADt m\xE1y ph\xE1t",
        description: "M\xE1y ho\u1EA1t \u0111\u1ED9ng b\xECnh th\u01B0\u1EDDng.",
        requires: "generator"
      },
      {
        id: "wait",
        label: "Ch\u1EDD \u0111i\u1EC7n \u1ED5n \u0111\u1ECBnh",
        description: "Qu\u1EA7y m\u1EA5t \u0111i\u1EC7n 60 gi\xE2y, c\xF3 \u0111\u1EBFm ng\u01B0\u1EE3c; m\xE1y ph\xE1t gi\xFAp ti\u1EBFp t\u1EE5c ho\u1EA1t \u0111\u1ED9ng."
      },
      {
        id: "notice",
        label: "B\xE1o tr\u01B0\u1EDBc cho kh\xE1ch",
        description: "Danh ti\u1EBFng -0,03; kh\xF4ng \u1EA3nh h\u01B0\u1EDFng m\xE1y."
      }
    ]
  },
  {
    id: "inspection",
    name: "Thanh tra v\u1EC7 sinh",
    story: "Ti\u1EC7m \u0111\u01B0\u1EE3c ki\u1EC3m tra kho, h\u1EA1n d\xF9ng v\xE0 c\xE1ch qu\u1EA3n l\xFD v\u1EADt t\u01B0. M\xE2y c\xF3 \u0111\u1EE7 h\u1ED3 s\u01A1 \u0111\u1EC3 h\u1EE3p t\xE1c.",
    day: 7,
    cooldown: 10,
    priority: 2,
    choices: [
      {
        id: "check",
        label: "M\u1EDDi ki\u1EC3m tra kho",
        description: "Kho kh\xF4ng c\xF3 l\xF4 h\u1EBFt h\u1EA1n: uy t\xEDn +0,1. N\u1EBFu c\xF3, t\u1EF1 lo\u1EA1i l\xF4 h\u1ECFng."
      },
      {
        id: "clean",
        label: "V\u1EC7 sinh b\u1ED5 sung",
        description: "Chi 8.000\u0111, uy t\xEDn +0,05.",
        cost: 8e3
      }
    ]
  },
  {
    id: "demanding",
    name: "Kh\xE1ch c\u1EA7n \xEDt \u0111\u01B0\u1EDDng",
    story: "M\u1ED9t kh\xE1ch quen mu\u1ED1n c\u1EA3 nh\xF3m \u0111\u01B0\u1EE3c t\u01B0 v\u1EA5n r\xF5 h\u01A1n v\u1EC1 l\u01B0\u1EE3ng \u0111\u01B0\u1EDDng. M\xE2y c\xF3 th\u1EC3 d\xE0nh th\xEAm th\u1EDDi gian ch\u0103m s\xF3c.",
    day: 4,
    cooldown: 5,
    priority: 1,
    choices: [
      {
        id: "listen",
        label: "L\u1EAFng nghe v\xE0 t\u01B0 v\u1EA5n",
        description: "Kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 8 gi\xE2y h\xF4m nay."
      },
      {
        id: "voucher",
        label: "G\u1EEDi phi\u1EBFu \u01B0u \u0111\xE3i",
        description: "Chi 5.000\u0111; uy t\xEDn +0,05.",
        cost: 5e3
      }
    ]
  },
  {
    id: "shortage",
    name: "Nh\xE0 cung c\u1EA5p giao ch\u1EADm",
    story: "M\u1ED9t tuy\u1EBFn giao nguy\xEAn li\u1EC7u b\u1ECB ch\u1EADm. Kho hi\u1EC7n c\xF3 v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn; h\xE3y ch\u1ECDn ph\u01B0\u01A1ng \xE1n nh\u1EADp h\xE0ng.",
    day: 6,
    cooldown: 7,
    priority: 2,
    choices: [
      {
        id: "alternate",
        label: "Nh\xE0 cung c\u1EA5p thay th\u1EBF",
        description: "Chi 5.000\u0111 v\u1EADn chuy\u1EC3n; gi\u1EA3m 3% ti\u1EC1n nh\u1EADp kho h\xF4m nay.",
        cost: 5e3
      },
      {
        id: "wait",
        label: "D\xF9ng kho d\u1EF1 ph\xF2ng",
        description: "Gi\u1EEF nguy\xEAn kho, kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 3 gi\xE2y v\xEC \u0111\u01B0\u1EE3c b\xE1o tr\u01B0\u1EDBc."
      }
    ]
  },
  {
    id: "festival",
    name: "Ng\xE0y h\u1ED9i tr\xE0 s\u1EEFa",
    story: "Khu ph\u1ED1 t\u1ED5 ch\u1EE9c ng\xE0y h\u1ED9i nh\u1ECF. Nh\u1EEFng ly pha ch\xEDnh x\xE1c s\u1EBD \u0111\u01B0\u1EE3c kh\xE1ch th\u01B0\u1EDFng th\xEAm.",
    day: 3,
    cooldown: 7,
    priority: 1,
    choices: [
      {
        id: "join",
        label: "Tham gia ng\xE0y h\u1ED9i",
        description: "Tip cho \u0111\u01A1n \u0111\xFAng t\u0103ng 8% h\xF4m nay."
      },
      {
        id: "decorate",
        label: "Trang tr\xED gian h\xE0ng",
        description: "Chi 12.000\u0111; uy t\xEDn +0,15.",
        cost: 12e3
      }
    ]
  },
  {
    id: "celebrity",
    name: "M\u1ED9t v\u1ECB kh\xE1ch n\u1ED5i ti\u1EBFng",
    story: "M\u1ED9t t\xE1c gi\u1EA3 du l\u1ECBch mu\u1ED1n gh\xE9 th\u0103m g\xF3c ti\u1EC7m. M\xE2y c\xF3 th\u1EC3 gi\u1EDBi thi\u1EC7u c\xE2u chuy\u1EC7n c\u1EE7a qu\xE1n.",
    day: 12,
    cooldown: 12,
    priority: 1,
    choices: [
      {
        id: "story",
        label: "K\u1EC3 chuy\u1EC7n c\u1EE7a ti\u1EC7m",
        description: "Danh ti\u1EBFng +0,08."
      },
      {
        id: "welcome",
        label: "Chu\u1EA9n b\u1ECB bu\u1ED5i \u0111\xF3n ti\u1EBFp",
        description: "Chi 10.000\u0111; tip \u0111\u01A1n \u0111\xFAng t\u0103ng 10% h\xF4m nay.",
        cost: 1e4
      }
    ]
  },
  {
    id: "lost",
    name: "Chi\u1EBFc v\xED b\u1ECF qu\xEAn",
    story: "M\u1ED9t v\u1ECB kh\xE1ch \u0111\u1EC3 qu\xEAn v\xED. M\xE2y gi\u1EEF nguy\xEAn \u0111\u1ED3 b\xEAn trong v\xE0 t\xECm c\xE1ch li\xEAn h\u1EC7 an to\xE0n.",
    day: 3,
    cooldown: 8,
    priority: 1,
    choices: [
      {
        id: "return",
        label: "Li\xEAn h\u1EC7 ch\u1EE7 nh\xE2n",
        description: "Danh ti\u1EBFng +0,1, kh\xE1ch quen th\xEAm m\u1ED9t l\u1EA7n gh\xE9."
      },
      {
        id: "hold",
        label: "G\u1EEDi qu\u1EA7y \u0111\u1ED3 th\u1EA5t l\u1EA1c",
        description: "Danh ti\u1EBFng +0,05; ghi v\xE0o nh\u1EADt k\xFD."
      }
    ]
  },
  {
    id: "machine",
    name: "M\xE1y d\xE1n n\u1EAFp c\u1EA7n b\u1EA3o tr\xEC",
    story: "Tr\u01B0\u1EDBc gi\u1EDD m\u1EDF c\u1EEDa, m\xE1y b\xE1o c\u1EA7n v\u1EC7 sinh tr\u1EE5c l\u0103n. Kh\xF4ng c\xF3 ly \u0111ang pha n\xE0o b\u1ECB m\u1EA5t.",
    day: 6,
    cooldown: 9,
    priority: 3,
    choices: [
      {
        id: "repair",
        label: "G\u1ECDi b\u1EA3o tr\xEC",
        description: "Chi 50.000\u0111; m\xE1y ho\u1EA1t \u0111\u1ED9ng b\xECnh th\u01B0\u1EDDng.",
        cost: 5e4
      },
      {
        id: "backup",
        label: "D\xF9ng m\xE1y d\u1EF1 ph\xF2ng",
        description: "Kh\xF4ng m\u1EA5t ph\xED s\u1EEDa h\xF4m nay.",
        requires: "backup"
      },
      {
        id: "manual",
        label: "V\u1EC7 sinh th\u1EE7 c\xF4ng",
        description: "Qu\u1EA7y t\u1EA1m d\u1EEBng t\u1EDBi khi s\u1EEDa m\xE1y ho\u1EB7c chuy\u1EC3n sang m\xE1y d\u1EF1 ph\xF2ng \u0111\xE3 c\xF3."
      }
    ]
  },
  {
    id: "rival",
    name: "Ti\u1EC7m m\u1EDBi \u1EDF g\xF3c ph\u1ED1",
    story: "M\u1ED9t qu\xE1n m\u1EDBi v\u1EEBa m\u1EDF. M\xE2y mu\u1ED1n gi\u1EEF b\u1EA3n s\u1EAFc v\xE0 ch\u0103m ch\xFAt tr\u1EA3i nghi\u1EC7m c\u1EE7a kh\xE1ch.",
    day: 10,
    cooldown: 12,
    priority: 1,
    choices: [
      {
        id: "quality",
        label: "Ch\xFA tr\u1ECDng ch\u1EA5t l\u01B0\u1EE3ng",
        description: "Kh\xE1ch ki\xEAn nh\u1EABn th\xEAm 5 gi\xE2y h\xF4m nay."
      },
      {
        id: "advertise",
        label: "Gi\u1EDBi thi\u1EC7u ti\u1EC7m",
        description: "Chi 15.000\u0111; danh ti\u1EBFng +0,15.",
        cost: 15e3
      }
    ]
  },
  {
    id: "bulk",
    name: "L\u1EDDi m\u1EDDi \u0111\u1EB7t ti\u1EC7c",
    story: "M\u1ED9t nh\xF3m mu\u1ED1n \u0111\u1EB7t ti\u1EC7c tr\xE0 sau gi\u1EDD b\xE1n. M\xE2y c\u1EA7n d\xE0nh nguy\xEAn li\u1EC7u thay v\xEC h\u1EE9a v\u01B0\u1EE3t kh\u1EA3 n\u0103ng.",
    day: 9,
    cooldown: 7,
    priority: 2,
    choices: [
      {
        id: "accept",
        label: "Nh\u1EADn g\xF3i 5 ly tr\xE0 s\u1EEFa",
        description: "C\u1EA7n 5 tr\xE0 s\u1EEFa, 5 ly M, 5 n\u1EAFp, 5 tr\xE2n ch\xE2u v\xE0 2 s\u1EEFa; nh\u1EADn 100.000\u0111."
      },
      {
        id: "decline",
        label: "H\u1EB9n d\u1ECBp kh\xE1c",
        description: "Gi\u1EEF nguy\xEAn kho v\xE0 t\xE0i ch\xEDnh; kh\xE1ch \u0111\xE1nh gi\xE1 s\u1EF1 trung th\u1EF1c."
      }
    ]
  }
];
var mainData = [
  ["\u0110\u01A1n \u0111\u1EA7u ti\xEAn", "served", 1, "Ph\u1EE5c v\u1EE5 ly \u0111\u1EA7u ti\xEAn."],
  ["Kho s\u1EB5n s\xE0ng", "purchases", 8, "Nh\u1EADp \u0111\u1EE7 nhi\u1EC1u nh\xF3m v\u1EADt t\u01B0."],
  ["Pha \u0111\xFAng c\xF4ng th\u1EE9c", "accurate", 3, "\u0110\u01B0\u1EE3c kh\xE1ch \u0111\xE1nh gi\xE1 ngon."],
  ["M\u1ED9t ng\xE0y ch\u0103m ch\u1EC9", "days", 1, "Ho\xE0n t\u1EA5t ng\xE0y b\xE1n \u0111\u1EA7u ti\xEAn."],
  ["G\xF3c qu\xE1n m\u1EDBi", "decorations", 1, "\u0110\u1ED5i m\u1ED9t trang tr\xED."],
  ["M\xE1y m\u1EDBi", "upgrades", 1, "Mua m\u1ED9t n\xE2ng c\u1EA5p."],
  ["Kh\xE1ch nh\u1EDB t\xEAn ti\u1EC7m", "regulars", 2, "Ph\u1EE5c v\u1EE5 l\u1EA1i kh\xE1ch c\u0169."],
  ["V\u1ECB \xEDt ng\u1ECDt", "lowSugar", 3, "Pha \u0111\xFAng \u0111\u01A1n c\xF3 \u0111\u01B0\u1EDDng t\u1ED1i \u0111a 50%."],
  ["S\u1ED5 thu \u0111\u1EA7u ti\xEAn", "revenue", 2e5, "T\xEDch l\u0169y doanh thu b\xE1n h\xE0ng."],
  ["C\xF9ng khu ph\u1ED1", "events", 1, "Gi\u1EA3i quy\u1EBFt s\u1EF1 ki\u1EC7n."],
  ["Topping \u0111a d\u1EA1ng", "toppings", 2, "Ph\u1EE5c v\u1EE5 \u0111\xFAng hai lo\u1EA1i topping."],
  ["M\u1ED9t tu\u1EA7n b\xEAn M\xE2y", "days", 7, "K\u1EBFt th\xFAc b\u1EA3y ng\xE0y kinh doanh."],
  ["B\u1EA1n \u0111\u1ED3ng h\xE0nh", "staff", 1, "Tuy\u1EC3n m\u1ED9t nh\xE2n vi\xEAn."],
  ["\u0110\xE0o t\u1EA1o t\u1EADn t\xE2m", "training", 1, "\u0110\xE0o t\u1EA1o nh\xE2n vi\xEAn m\u1ED9t l\u1EA7n."],
  ["Ly l\u1EDBn ni\u1EC1m vui", "large", 3, "Ph\u1EE5c v\u1EE5 \u0111\xFAng \u0111\u01A1n ly L."],
  ["Kh\xF3a c\u1EEDa an t\xE2m", "security", 1, "Mua thi\u1EBFt b\u1ECB b\u1EA3o v\u1EC7 ho\u1EB7c d\u1EF1 ph\xF2ng."],
  ["H\u01B0\u01A1ng m\u1EDBi", "flavored", 3, "Ph\u1EE5c v\u1EE5 \u0111\xFAng \u0111\u01A1n c\xF3 h\u01B0\u01A1ng tr\xE1i c\xE2y."],
  ["Kh\xE1ch s\xE0nh tr\xE0", "vip", 3, "Pha \u0111\xFAng \u0111\u01A1n c\u1EE7a kh\xE1ch VIP."],
  ["Menu c\u1EE7a M\xE2y", "recipes", 8, "M\u1EDF t\xE1m c\xF4ng th\u1EE9c \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n."],
  [
    "Ng\xE0y kh\xF4ng b\u1ECF l\u1EE1",
    "perfectDays",
    1,
    "Ho\xE0n t\u1EA5t ng\xE0y c\xF3 kh\xE1ch v\xE0 kh\xF4ng b\u1ECF l\u1EE1 ai."
  ],
  ["N\u1EEDa th\xE1ng r\u1EF1c r\u1EE1", "days", 15, "K\u1EBFt th\xFAc ng\xE0y kinh doanh th\u1EE9 m\u01B0\u1EDDi l\u0103m."],
  ["T\u1ED5 \u0111\u1ED9i nh\u1ECF", "staff", 3, "Tuy\u1EC3n ba vai tr\xF2 nh\xE2n vi\xEAn."],
  ["K\u1EF9 n\u0103ng v\u1EEFng v\xE0ng", "training", 5, "\u0110\xE0o t\u1EA1o t\u1ED5ng c\u1ED9ng n\u0103m l\u1EA7n."],
  ["D\u1EF1 ph\xF2ng b\xECnh y\xEAn", "savings", 6e5, "Gi\u1EEF \u0111\u01B0\u1EE3c kho\u1EA3n ti\u1EC1n d\u1EF1 ph\xF2ng."],
  ["Chuy\u1EC7n \u1EDF g\xF3c ph\u1ED1", "events", 6, "Gi\u1EA3i quy\u1EBFt s\xE1u s\u1EF1 ki\u1EC7n."],
  ["Ti\u1EC7m c\u1EE7a kh\xE1ch quen", "regulars", 20, "Ph\u1EE5c v\u1EE5 nhi\u1EC1u l\u01B0\u1EE3t kh\xE1ch quay l\u1EA1i."],
  [
    "M\u1ED9t tri\u1EC7u doanh thu",
    "revenue",
    1e6,
    "T\xEDch l\u0169y m\u1ED9t tri\u1EC7u \u0111\u1ED3ng doanh thu."
  ],
  ["Menu phong ph\xFA", "recipes", 20, "M\u1EDF hai m\u01B0\u01A1i c\xF4ng th\u1EE9c."],
  ["Th\xE1ng \u0111\u1EA7u ti\xEAn", "days", 30, "K\u1EBFt th\xFAc ba m\u01B0\u01A1i ng\xE0y kinh doanh."],
  [
    "Ti\u1EC7m tr\xE0 b\u1EC1n v\u1EEFng",
    "accurate",
    150,
    "Ph\u1EE5c v\u1EE5 ch\xEDnh x\xE1c m\u1ED9t tr\u0103m n\u0103m m\u01B0\u01A1i \u0111\u01A1n."
  ]
];
var sideData = [
  ["Tr\xE0 \u0111\u1EA7u ng\xE0y", "served", 5, "Ph\u1EE5c v\u1EE5 kh\xE1ch."],
  ["B\xE0n tay kh\xE9o", "accurate", 5, "Pha \u0111\xFAng \u0111\u01A1n."],
  ["Ghi s\u1ED5 c\u1EA9n th\u1EADn", "revenue", 8e4, "Doanh thu b\xE1n h\xE0ng."],
  ["Chuy\u1EBFn h\xE0ng nh\u1ECF", "purchases", 4, "Nh\u1EADp kho th\xE0nh c\xF4ng."],
  ["Ch\u0103m ch\xFAt thi\u1EBFt b\u1ECB", "upgrades", 2, "N\xE2ng c\u1EA5p ti\u1EC7m."],
  ["\u0110\u1ED5i m\xE0u m\xE1i hi\xEAn", "decorations", 2, "Thay trang tr\xED."],
  ["Nghe chuy\u1EC7n ph\u1ED1", "events", 2, "Gi\u1EA3i quy\u1EBFt s\u1EF1 ki\u1EC7n."],
  ["\u0110\xF3n kh\xE1ch s\xE0nh tr\xE0", "vip", 1, "Ph\u1EE5c v\u1EE5 ch\xEDnh x\xE1c kh\xE1ch VIP."],
  ["M\u1ED9t l\u1EDDi h\u1EB9n", "regulars", 1, "Ph\u1EE5c v\u1EE5 kh\xE1ch quay l\u1EA1i."],
  ["Bu\u1ED5i h\u1ECDc \u0111\u1EA7u", "training", 2, "\u0110\xE0o t\u1EA1o nh\xE2n vi\xEAn."],
  ["\u0110\u1ED9i ng\u0169 m\u1EDBi", "staff", 2, "Tuy\u1EC3n nh\xE2n vi\xEAn."],
  ["V\u1ECB thanh nh\u1EB9", "lowSugar", 1, "Pha \u0111\xFAng \u0111\u01A1n \xEDt \u0111\u01B0\u1EDDng."],
  ["Mang \u0111i ly l\u1EDBn", "large", 1, "Pha \u0111\xFAng ly l\u1EDBn."],
  ["H\u01B0\u01A1ng th\u01A1m v\u01B0\u1EDDn", "flavored", 1, "Pha \u0111\xFAng v\u1ECB tr\xE1i c\xE2y."],
  ["B\xE1t topping m\u1EDBi", "toppings", 3, "Ph\u1EE5c v\u1EE5 \u0111a d\u1EA1ng topping."],
  ["Ba ng\xE0y m\u1EDF c\u1EEDa", "days", 3, "Ho\xE0n t\u1EA5t ng\xE0y b\xE1n."],
  ["Qu\u1EF9 ng\xE0y m\u01B0a", "savings", 25e4, "Duy tr\xEC ti\u1EC1n d\u1EF1 ph\xF2ng."],
  ["Ghi th\xEAm c\xF4ng th\u1EE9c", "recipes", 4, "M\u1EDF c\xF4ng th\u1EE9c."],
  ["Thi\u1EBFt b\u1ECB an to\xE0n", "security", 2, "Mua thi\u1EBFt b\u1ECB d\u1EF1 ph\xF2ng."],
  [
    "Ng\xE0y vui tr\u1ECDn v\u1EB9n",
    "perfectDays",
    2,
    "Kh\xF4ng m\u1EA5t kh\xE1ch trong ng\xE0y ho\xE0n t\u1EA5t."
  ],
  ["M\u01B0\u1EDDi l\u1EDDi c\u1EA3m \u01A1n", "accurate", 10, "Pha ch\xEDnh x\xE1c."],
  ["T\xFAi tr\xE0 chi\u1EC1u", "served", 15, "Ph\u1EE5c v\u1EE5 kh\xE1ch."],
  ["N\u1EE5 c\u01B0\u1EDDi VIP", "vip", 5, "Ph\u1EE5c v\u1EE5 \u0111\xFAng kh\xE1ch VIP."],
  ["M\xF3n quen", "regulars", 5, "Kh\xE1ch quay l\u1EA1i."],
  ["H\xE0ng m\u1EDBi \u0111\xFAng l\xFAc", "purchases", 15, "Nh\u1EADp v\u1EADt t\u01B0."],
  ["Qu\u1EA7y ti\u1EC7n nghi", "upgrades", 4, "C\u1EA3i ti\u1EBFn thi\u1EBFt b\u1ECB."],
  ["M\xE1i nh\xE0 s\u1EAFc m\xE0u", "decorations", 4, "Thay \u0111\u1ED5i kh\xF4ng gian."],
  ["D\u1EC5 ch\u1ECBu \xEDt \u0111\u01B0\u1EDDng", "lowSugar", 8, "Pha \u0111\xFAng \u0111\u01A1n \xEDt \u0111\u01B0\u1EDDng."],
  ["T\u1EB7ng v\u1ECB tr\xE1i c\xE2y", "flavored", 8, "Pha \u0111\xFAng h\u01B0\u01A1ng m\u1EDBi."],
  ["Chia s\u1EBB ly l\u1EDBn", "large", 8, "Pha \u0111\xFAng ly L."],
  ["Chuy\u1EC7n k\u1EC3 m\u01B0\u1EDDi ng\xE0y", "days", 10, "Ho\xE0n t\u1EA5t ng\xE0y b\xE1n."],
  ["M\u1ED9t n\u1EEDa tri\u1EC7u", "revenue", 5e5, "T\xEDch l\u0169y doanh thu."],
  ["T\u1ED5 tr\u01B0\u1EDFng t\u01B0\u01A1ng lai", "training", 4, "\u0110\xE0o t\u1EA1o \u0111\u1ED9i ng\u0169."],
  ["B\u1ED1n ng\u01B0\u1EDDi b\u1EA1n", "staff", 4, "Tuy\u1EC3n \u0111\u1EE7 b\u1ED1n vai tr\xF2."],
  ["B\u1ED1n lo\u1EA1i topping", "toppings", 4, "Pha \u0111\xFAng t\u1EA5t c\u1EA3 topping."],
  ["M\u01B0\u1EDDi hai c\xF4ng th\u1EE9c", "recipes", 12, "M\u1EDF th\xEAm c\xF4ng th\u1EE9c."],
  ["K\xE9t v\xE0 kh\xF3a", "security", 3, "Mua thi\u1EBFt b\u1ECB an to\xE0n."],
  ["L\u1EDDi gi\u1EA3i d\u1ECBu d\xE0ng", "events", 4, "Gi\u1EA3i quy\u1EBFt s\u1EF1 ki\u1EC7n."],
  ["Kh\xF4ng ai ch\u1EDD m\xE3i", "perfectDays", 3, "Ng\xE0y b\xE1n kh\xF4ng m\u1EA5t kh\xE1ch."],
  ["Qu\u1EF9 v\u1EEFng v\xE0ng", "savings", 8e5, "Gi\u1EEF ti\u1EC1n d\u1EF1 ph\xF2ng."],
  ["Hai m\u01B0\u01A1i ng\xE0y", "days", 20, "Ti\u1EBFp t\u1EE5c kinh doanh."],
  ["Chuy\xEAn gia v\u1ECB thanh", "lowSugar", 20, "Pha \u0111\xFAng \u0111\u01A1n \xEDt ng\u1ECDt."],
  ["Qu\xE1n c\u1EE7a khu ph\u1ED1", "regulars", 40, "Ph\u1EE5c v\u1EE5 kh\xE1ch quay l\u1EA1i."],
  ["C\u1EA3 \u0111\u1ED9i b\xEAn nhau", "staff", 5, "Tuy\u1EC3n \u0111\u1EE7 n\u0103m vai tr\xF2."],
  ["Tay ngh\u1EC1 ng\xE0y m\u1EDBi", "training", 10, "\u0110\xE0o t\u1EA1o chuy\xEAn s\xE2u."],
  ["Hai tri\u1EC7u doanh thu", "revenue", 2e6, "T\xEDch l\u0169y doanh thu."],
  ["Kh\xE1ch \u0111\u1EBFn tr\u0103m l\u1EA7n", "served", 100, "Ph\u1EE5c v\u1EE5 kh\xE1ch."],
  ["M\u01B0\u1EDDi chuy\u1EC7n nh\u1ECF", "events", 10, "Gi\u1EA3i quy\u1EBFt s\u1EF1 ki\u1EC7n."],
  ["Th\u1EF1c \u0111\u01A1n cu\u1ED1i m\xF9a", "recipes", 30, "M\u1EDF ba m\u01B0\u01A1i c\xF4ng th\u1EE9c."],
  ["B\u1EA3y ng\xE0y ho\xE0n h\u1EA3o", "perfectDays", 7, "Ho\xE0n t\u1EA5t ng\xE0y kh\xF4ng m\u1EA5t kh\xE1ch."]
];
var achievementData = [
  ["Ly \u0111\u1EA7u tay", "served", 1],
  ["Tay pha chu\u1EA9n", "accurate", 25],
  ["S\u1ED5 v\xE0ng", "revenue", 1e6],
  ["Ng\u01B0\u1EDDi gi\u1EEF kho", "purchases", 30],
  ["Th\u1EE3 m\xE1y c\u1EE7a ti\u1EC7m", "upgrades", 8],
  ["G\xF3c qu\xE1n ngh\u1EC7 thu\u1EADt", "decorations", 8],
  ["Chuy\u1EC7n ph\u1ED1 M\xE2y", "events", 12],
  ["Kh\xE1ch VIP y\xEAu m\u1EBFn", "vip", 10],
  ["Ng\xF4i nh\xE0 th\u1EE9 hai", "regulars", 30],
  ["Ng\u01B0\u1EDDi th\u1EA7y ki\xEAn nh\u1EABn", "training", 12],
  ["\u0110\u1ED9i ng\u0169 M\xE2y", "staff", 5],
  ["Ng\u1ECDt v\u1EEBa \u0111\u1EE7", "lowSugar", 30],
  ["Ly l\u1EDBn \u0111ong \u0111\u1EA7y", "large", 25],
  ["V\u01B0\u1EDDn h\u01B0\u01A1ng", "flavored", 25],
  ["Topping tinh t\u1EBF", "toppings", 4],
  ["M\u1ED9t th\xE1ng b\xEAn nhau", "days", 30],
  ["Qu\u1EF9 an t\xE2m", "savings", 15e5],
  ["Cu\u1ED1n s\xE1ch c\xF4ng th\u1EE9c", "recipes", 36],
  ["Qu\u1EA7y \u0111\u01B0\u1EE3c b\u1EA3o v\u1EC7", "security", 5],
  ["B\u1EA3y ng\xE0y kh\xF4ng b\u1ECF l\u1EE1", "perfectDays", 7]
];
var quests = [
  ...mainData.map(([name, metric, target, description], i) => ({
    id: `main-${i + 1}`,
    name,
    metric,
    target,
    description,
    kind: "main",
    day: 1,
    reward: 3e3 + Math.floor(i / 5) * 1e3
  })),
  ...sideData.map(([name, metric, target, description], i) => ({
    id: `side-${i + 1}`,
    name,
    metric,
    target,
    description,
    kind: "side",
    day: 1,
    reward: 2e3 + Math.floor(i / 10) * 1e3
  })),
  ...achievementData.map(([name, metric, target], i) => ({
    id: `achievement-${i + 1}`,
    name,
    metric,
    target,
    description: "Danh hi\u1EC7u ghi nh\u1EADn h\xE0nh tr\xECnh c\u1EE7a ti\u1EC7m.",
    kind: "achievement",
    day: 1,
    reward: 5e3
  }))
];
function log(s, description, amount) {
  s.money = Math.round(s.money + amount);
  s.ledger.push({ day: s.day, kind: description, amount });
  s.ledger = s.ledger.slice(-600);
}
function eventSpend(s, description, amount) {
  log(s, description, -amount);
  if (s.phase === "summary") {
    s.stats.expenses += amount;
    s.stats.profit -= amount;
    if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
  } else
    s.progression.eventExpenses = (s.progression.eventExpenses ?? 0) + amount;
}
var level = (p, id) => p.staff[id]?.active ? p.staff[id].level : 0;
function updateMetrics(s) {
  const p = s.progression;
  p.metrics.days = Math.max(
    p.metrics.days,
    s.phase === "summary" ? s.day : s.day - 1
  );
  p.metrics.savings = Math.max(p.metrics.savings, s.money);
  p.metrics.staff = Object.keys(p.staff).length;
  p.metrics.security = Object.keys(p.security).length;
  p.metrics.recipes = recipes.filter(
    (r) => r.day <= s.day && unlocked(s, r.tea) && unlocked(s, r.topping) && unlocked(s, r.flavor) && (r.size === "M" || s.upgrades.size)
  ).length;
}
function applyProgression(previous, next, action) {
  if (previous === next) return next;
  const s = next;
  s.progression ??= createProgression();
  const p = s.progression;
  if (action.type === "buy" && s.money < previous.money) {
    p.metrics.purchases++;
    const refund = Math.round(
      (previous.money - s.money) * Math.min(0.15, p.boosts.discount + 0.01 * level(p, "manager"))
    );
    if (refund) log(s, "\u01AFu \u0111\xE3i nh\u1EADp kho", refund);
  }
  if (action.type === "upgrade" && s.money < previous.money)
    p.metrics.upgrades++;
  if (action.type === "decor" && JSON.stringify(s.decor) !== JSON.stringify(previous.decor))
    p.metrics.decorations++;
  const oldIds = new Set(previous.orders.map((o) => o.id));
  for (const o of s.orders)
    if (!oldIds.has(o.id)) {
      const bonus = 3 * level(p, "server") + 2 * level(p, "courier") + p.boosts.patience;
      o.total += bonus;
      o.remaining += bonus;
    }
  if (action.type === "serve" && s.stats.served > previous.stats.served) {
    p.metrics.served++;
    p.metrics.revenue += Math.max(0, s.stats.revenue - previous.stats.revenue);
    const o = previous.orders[0];
    if (o) {
      const key = String(o.customer);
      if ((p.relationships[key] ?? 0) > 0) p.metrics.regulars++;
      p.relationships[key] = (p.relationships[key] ?? 0) + 1;
      if (s.feedback?.mood === "happy") {
        p.metrics.accurate++;
        if (customers[o.customer].personality === "VIP") p.metrics.vip++;
        if (o.recipe.sugar <= 50) p.metrics.lowSugar++;
        if (o.recipe.size === "L") p.metrics.large++;
        if (o.recipe.flavor !== "plain") p.metrics.flavored++;
        if (!p.tasted.includes(o.recipe.topping))
          p.tasted.push(o.recipe.topping);
        p.metrics.toppings = p.tasted.length;
        const bonus = Math.round(
          o.recipe.price * (p.boosts.tip + 0.01 * level(p, "cashier"))
        );
        if (bonus) {
          log(s, "Tip ch\u0103m s\xF3c kh\xE1ch h\xE0ng", bonus);
          s.stats.revenue += bonus;
          p.metrics.revenue += bonus;
        }
      }
    }
  }
  if (previous.phase !== "summary" && s.phase === "summary") {
    if (s.stats.served > 0 && s.stats.lost === 0) p.metrics.perfectDays++;
    const eventCosts = p.eventExpenses ?? 0;
    s.stats.expenses += eventCosts;
    s.stats.profit -= eventCosts;
    p.eventExpenses = 0;
    const wages = staffCatalog.reduce(
      (n, x) => n + (p.staff[x.id]?.active ? x.wage : 0),
      0
    );
    const paid = Math.min(Math.max(0, s.money), wages);
    if (paid) {
      log(s, "L\u01B0\u01A1ng \u0111\u1ED9i ng\u0169", -paid);
      s.stats.expenses += paid;
      s.stats.profit -= paid;
    }
    s.stats.profit = s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
    if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    if (paid < wages) {
      Object.values(p.staff).forEach((x) => x.active = false);
      s.message += " \u0110\u1ED9i ng\u0169 t\u1EA1m ngh\u1EC9 v\xEC qu\u1EF9 l\u01B0\u01A1ng ch\u01B0a \u0111\u1EE7; c\xF3 th\u1EC3 ph\xE2n c\xF4ng l\u1EA1i.";
    }
  }
  if (s.day > previous.day) {
    p.boosts = { patience: 0, seal: 0, tip: 0, discount: 0 };
    p.eventExpenses = 0;
    if (!p.event && s.day >= 3 && s.day - p.lastEventDay >= 3) {
      const roll = (Math.imul(s.seed ^ s.day, 1103515245) >>> 0) % 100;
      if (roll < 42) {
        const available = events.filter(
          (e) => !["theft", "power", "machine"].includes(e.id) && e.day <= s.day && s.day - (p.cooldowns[e.id] ?? -999) >= e.cooldown
        );
        if (available.length) {
          const weight = available.reduce((n, e) => n + e.priority, 0);
          let ticket = (roll + s.day) % weight;
          const event = available.find((e) => {
            ticket -= e.priority;
            return ticket < 0;
          });
          p.event = { id: event.id, day: s.day };
          p.lastEventDay = s.day;
        }
      }
    }
  }
  updateMetrics(s);
  return s;
}
function reduceProgression(input, action) {
  const s = migrateProgression(structuredClone(input));
  const p = s.progression;
  if (action.type === "ownerName") {
    const name = action.name.trim().replace(/\s+/g, " ");
    if (validOwnerName(name)) p.ownerName = name;
    else s.message = "T\xEAn c\u1EA7n 2\u201330 k\xFD t\u1EF1 ch\u1EEF, s\u1ED1 ho\u1EB7c d\u1EA5u c\xE1ch ph\xF9 h\u1EE3p.";
    return s;
  }
  if (action.type === "reducedMotion") {
    p.reducedMotion = !p.reducedMotion;
    return s;
  }
  if (action.type === "claimQuest") {
    const q = quests.find((x) => x.id === action.id);
    if (q && p.metrics[q.metric] >= q.target && !p.claimed.includes(q.id)) {
      p.claimed.push(q.id);
      log(s, `Ho\xE0n th\xE0nh: ${q.name}`, q.reward);
      s.message = `\u2728 ${q.name}: +${q.reward.toLocaleString("vi-VN")}\u0111`;
    }
    return s;
  }
  if (action.type === "eventChoice") {
    const e = events.find((x) => x.id === p.event?.id), c = e?.choices.find((x) => x.id === action.choice);
    if (!e || !c) return s;
    if (c.requires && !securityActive(s, c.requires)) {
      s.message = "C\u1EA7n mua thi\u1EBFt b\u1ECB ph\xF9 h\u1EE3p tr\u01B0\u1EDBc.";
      return s;
    }
    if ((c.cost ?? 0) > s.money) {
      s.message = "Ch\u01B0a \u0111\u1EE7 ti\u1EC1n cho l\u1EF1a ch\u1ECDn n\xE0y.";
      return s;
    }
    if (e.id === "bulk" && c.id === "accept") {
      if (s.phase === "open") {
        s.message = "H\xE3y k\u1EBFt s\u1ED5 tr\u01B0\u1EDBc khi nh\u1EADn ti\u1EC7c tr\xE0 \u0111\u1EC3 gi\u1EEF \u0111\u1EE7 nguy\xEAn li\u1EC7u cho c\xE1c \u0111\u01A1n \u0111ang ch\u1EDD.";
        return s;
      }
      const needed = {
        milk: 5,
        cupM: 5,
        lid: 5,
        pearl: 5,
        milkPowder: 2
      };
      if (Object.entries(needed).some(
        ([id, n]) => (s.stock[id] ?? []).reduce((t, l) => t + l.qty, 0) < n
      )) {
        s.message = "Ch\u01B0a \u0111\u1EE7 kho cho 5 ly; c\xF3 th\u1EC3 t\u1EEB ch\u1ED1i m\xE0 kh\xF4ng b\u1ECB ph\u1EA1t.";
        return s;
      }
      let ingredientCost = 0;
      for (const [id, n] of Object.entries(needed)) {
        ingredientCost += (supplies.find((x) => x.id === id)?.price ?? 0) * n;
        let left = n;
        for (const lot of s.stock[id]) {
          const used = Math.min(left, lot.qty);
          lot.qty -= used;
          left -= used;
        }
        s.stock[id] = s.stock[id].filter((l) => l.qty > 0);
      }
      s.stats.cogs += ingredientCost;
      s.stats.served += 5;
      p.metrics.served += 5;
      log(s, "Ti\u1EC7c tr\xE0 5 ly", 1e5);
      s.stats.revenue += 1e5;
      p.metrics.revenue += 1e5;
    }
    if (c.cost) eventSpend(s, e.name, c.cost);
    let text2 = c.description;
    switch (e.id) {
      case "theft": {
        const loss = securityActive(s, "lock") ? 0 : Math.floor(
          Math.max(0, s.money) * (securityActive(s, "safe") ? 0.05 : 0.1)
        );
        const recovered = c.id === "camera" ? 1 : c.id === "inventory" ? level(p, "manager") ? 0.8 : 0.5 : 0;
        const amount = Math.round(loss * (1 - recovered));
        if (amount) eventSpend(s, "Ch\xEAnh l\u1EC7ch qu\u1EA7y \u0111\xE3 \u0111\u1ED1i chi\u1EBFu", amount);
        text2 = `\u0110\xE3 \u0111\u1ED1i chi\u1EBFu s\u1ED5; th\u1EA5t tho\xE1t ${amount.toLocaleString("vi-VN")}\u0111. Ch\u01B0a c\xF3 b\u1EB1ng ch\u1EE9ng bu\u1ED9c t\u1ED9i b\u1EA5t k\u1EF3 ai.`;
        break;
      }
      case "vip":
        if (c.id === "welcome") p.boosts.tip += 0.05;
        else s.reputation += 0.1;
        break;
      case "power":
        if (c.id === "wait") {
          if (s.incidents) s.incidents.powerLeft = 60;
        } else if (c.id === "notice") s.reputation -= 0.03;
        break;
      case "inspection":
        if (c.id === "clean") s.reputation += 0.05;
        else {
          let expired = false;
          for (const lots of Object.values(s.stock))
            for (const l of lots)
              if (l.expires <= s.day && l.qty > 0) {
                l.qty = 0;
                expired = true;
              }
          if (!expired) s.reputation += 0.1;
          text2 = expired ? "\u0110\xE3 lo\u1EA1i nguy\xEAn li\u1EC7u qu\xE1 h\u1EA1n, kh\xF4ng ph\u1EA1t ti\u1EC1n." : "Kho \u0111\u1EA1t y\xEAu c\u1EA7u; danh ti\u1EBFng +0,1.";
        }
        break;
      case "demanding":
        if (c.id === "listen") p.boosts.patience += 8;
        else s.reputation += 0.05;
        break;
      case "shortage":
        if (c.id === "alternate") p.boosts.discount += 0.03;
        else p.boosts.patience += 3;
        break;
      case "festival":
        if (c.id === "join") p.boosts.tip += 0.08;
        else s.reputation += 0.15;
        break;
      case "celebrity":
        if (c.id === "story") s.reputation += 0.08;
        else p.boosts.tip += 0.1;
        break;
      case "lost":
        s.reputation += c.id === "return" ? 0.1 : 0.05;
        if (c.id === "return") p.metrics.regulars++;
        break;
      case "machine":
        if (c.id === "manual" && s.incidents) s.incidents.machineBroken = true;
        break;
      case "rival":
        if (c.id === "quality") p.boosts.patience += 5;
        else s.reputation += 0.15;
        break;
    }
    s.reputation = Math.max(1, Math.min(5, s.reputation));
    p.eventHistory.push({ id: e.id, day: s.day, choice: c.id, text: text2 });
    p.eventHistory = p.eventHistory.slice(-200);
    p.cooldowns[e.id] = s.day;
    p.metrics.events++;
    p.event = null;
    if (s.phase === "summary") {
      s.stats.profit = s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
      if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    }
    s.message = text2;
    updateMetrics(s);
    return s;
  }
  if (s.phase === "open" && action.type !== "security") {
    s.message = "H\xE3y k\u1EBFt s\u1ED5 \u0111\u1EC3 tuy\u1EC3n d\u1EE5ng, \u0111\xE0o t\u1EA1o ho\u1EB7c mua thi\u1EBFt b\u1ECB.";
    return s;
  }
  if (action.type === "security") {
    const item = securityCatalog.find((x) => x.id === action.id);
    if (item && !securityActive(s, item.id) && s.day >= item.day && s.money >= item.cost) {
      p.security[item.id] = 1;
      log(s, item.name, -item.cost);
      s.message = `\u0110\xE3 l\u1EAFp ${item.name.toLowerCase()}.`;
    } else s.message = "Ch\u01B0a \u0111\u1EE7 ti\u1EC1n ho\u1EB7c \u0111i\u1EC1u ki\u1EC7n mua thi\u1EBFt b\u1ECB.";
  } else {
    const member = staffCatalog.find((x) => x.id === action.id);
    if (!member) return s;
    const current = p.staff[member.id];
    if (action.type === "hire") {
      if (!current && s.day >= member.day && s.money >= member.cost) {
        p.staff[member.id] = { level: 1, active: true };
        log(s, `Tuy\u1EC3n ${member.name}`, -member.cost);
        s.message = `${member.name} \u0111\xE3 s\u1EB5n s\xE0ng h\u1ED7 tr\u1EE3 ti\u1EC7m!`;
      } else s.message = "Ch\u01B0a \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n tuy\u1EC3n d\u1EE5ng.";
    } else if (action.type === "train" && current) {
      const cost = 1e4 * current.level;
      if (current.level < 5 && s.money >= cost) {
        log(s, `\u0110\xE0o t\u1EA1o ${member.name}`, -cost);
        current.level++;
        p.metrics.training++;
        s.message = `${member.name} \u0111\u1EA1t c\u1EA5p ${current.level}.`;
      } else s.message = "Ch\u01B0a \u0111\u1EE7 ti\u1EC1n ho\u1EB7c \u0111\xE3 \u0111\u1EA1t c\u1EA5p t\u1ED1i \u0111a.";
    } else if (action.type === "staffAssign" && current)
      current.active = !current.active;
  }
  updateMetrics(s);
  return s;
}

// src/engine.ts
var stats = (day) => ({
  day,
  revenue: 0,
  cogs: 0,
  expenses: 0,
  waste: 0,
  served: 0,
  lost: 0,
  profit: 0
});
var quantity = (s, id) => s.stock[id]?.reduce((n, l) => n + l.qty, 0) ?? 0;
function missingOpeningSupplies(s) {
  return [
    "cupM",
    "lid",
    "milk",
    "black",
    "milkPowder",
    "pearl",
    "sugar",
    "ice"
  ].filter((id) => quantity(s, id) < 1);
}
function initial(seed = 4271) {
  const s = {
    feedback: null,
    progression: createProgression(),
    version: 2,
    day: 1,
    money: 1e6,
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
      cup: 0
    },
    ledger: [],
    history: [],
    stats: stats(1),
    message: "Ch\xE0o b\u1EA1n! Nh\u1EADp nguy\xEAn li\u1EC7u, r\u1ED3i m\u1EDF c\u1EEDa \u0111\xF3n v\u1ECB kh\xE1ch \u0111\u1EA7u ti\xEAn.",
    clock: 0,
    tutorial: true,
    sound: true
  };
  return ensureIncidents(s);
}
function log2(s, kind, amount) {
  s.money = Math.round((s.money + amount) * 100) / 100;
  s.ledger.push({ day: s.day, kind, amount });
  s.ledger = s.ledger.slice(-600);
}
function consume(s, id, qty) {
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
function random(s) {
  s.seed = Math.imul(1664525, s.seed) + 1013904223 >>> 0;
  return s.seed / 4294967296;
}
function recipeNeeds(r) {
  const needs = {
    [r.tea]: 0.85 * (r.size === "L" ? 1.5 : 1),
    [r.topping]: 1,
    [`cup${r.size}`]: 1,
    lid: 1,
    sugar: r.sugar / 100,
    ice: r.ice / 100
  };
  if (r.tea === "milk") needs.milkPowder = needs[r.tea] * 0.3;
  if (r.flavor !== "plain") needs[r.flavor] = 1;
  return needs;
}
function canQueue(s, recipe) {
  const reserved = {};
  for (const order of s.orders)
    for (const [id, qty] of Object.entries(recipeNeeds(order.recipe)))
      reserved[id] = (reserved[id] || 0) + qty;
  return Object.entries(recipeNeeds(recipe)).every(
    ([id, qty]) => quantity(s, id) + 1e-7 >= qty + (reserved[id] || 0)
  );
}
function enqueue(s) {
  while (s.orders.length < 3 && s.generated < s.target) {
    const available = recipes.filter(
      (r) => r.day <= s.day && unlocked(s, r.tea) && unlocked(s, r.topping) && unlocked(s, r.flavor) && (r.size === "M" || s.upgrades.size) && canQueue(s, r)
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
      (r) => r.tea === customers[customer].preference && r.price <= customers[customer].budget
    );
    if (favorite.length && random(s) < 0.45)
      recipe = { ...favorite[Math.floor(random(s) * favorite.length)] };
    if (s.day < 3) {
      recipe.sugar = 70;
      recipe.ice = 50;
    }
    const total = customers[customer].patience + 15 * (s.upgrades.counter ?? 0) - Math.min(35, s.day);
    s.orders.push({
      id: ++s.sequence,
      customer,
      recipe,
      total,
      remaining: total
    });
    s.generated++;
  }
}
function finish(s) {
  if (s.phase === "summary") return;
  s.stats.lost += s.orders.length;
  s.reputation = Math.max(1, s.reputation - 0.05 * s.orders.length);
  s.orders = [];
  s.cup = null;
  s.phase = "summary";
  const expense2 = 6e3 + 2e3 + (s.upgrades.staff ? 8e3 : 0);
  s.stats.expenses = expense2;
  log2(s, "Thu\xEA qu\u1EA7y, \u0111i\u1EC7n n\u01B0\u1EDBc v\xE0 l\u01B0\u01A1ng", -expense2);
  s.stats.profit = s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
  s.history.push({ ...s.stats });
  s.history = s.history.slice(-365);
  s.message = "M\u1ED9t ng\xE0y ch\u0103m ch\u1EC9 \u0111\xE3 kh\xE9p l\u1EA1i. H\u1EB9n mai t\u1EA1i M\xE2y!";
}
function complete(c) {
  return !!c && c.tea !== null && c.fill >= 0.6 && c.topping !== null && c.flavor !== null && c.sugar !== null && c.ice !== null && c.sealed;
}
function quality(c, r) {
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
var progressionActions = /* @__PURE__ */ new Set([
  "eventChoice",
  "hire",
  "train",
  "staffAssign",
  "security",
  "claimQuest",
  "ownerName",
  "reducedMotion"
]);
function pourTea(s, a) {
  const c = s.cup;
  const say = (message) => ({ ...s, message });
  if (!teas.some((t) => t.id === a.tea) || !unlocked(s, a.tea) || !Number.isFinite(a.dt))
    return s;
  if (c.sealed || c.sealLeft > 0 || c.fill >= 1.1) return s;
  if (c.tea && c.tea !== a.tea)
    return say("Kh\xF4ng tr\u1ED9n hai lo\u1EA1i tr\xE0 trong c\xF9ng ly.");
  const amount = Math.min(Math.max(0, a.dt) * 0.32, 1.1 - c.fill);
  const qty = amount * (c.size === "L" ? 1.5 : 1);
  if (quantity(s, a.tea) < qty || a.tea === "milk" && quantity(s, "milkPowder") < qty * 0.3)
    return say("\u0110\xE3 h\u1EBFt nguy\xEAn li\u1EC7u c\u1EE7a b\xECnh n\xE0y.");
  const next = {
    ...s,
    cup: { ...c },
    stats: { ...s.stats },
    stock: { ...s.stock, [a.tea]: s.stock[a.tea]?.map((lot) => ({ ...lot })) ?? [] }
  };
  if (a.tea === "milk") next.stock.milkPowder = s.stock.milkPowder?.map((lot) => ({ ...lot })) ?? [];
  if (!consume(next, a.tea, qty)) return s;
  if (a.tea === "milk") consume(next, "milkPowder", qty * 0.3);
  next.cup.tea = a.tea;
  next.cup.fill += amount;
  next.cup.pourAt = s.clock;
  return next;
}
function reduce(input, a) {
  const prepared = ensureIncidents(input);
  const intercepted = interceptIncident(prepared, a);
  if (intercepted) return intercepted;
  if (a.type === "pour" && prepared.progression && prepared.incidents.day === prepared.day && prepared.incidents.theftChecked && prepared.incidents.machineChecked && prepared.incidents.powerChecked) {
    if (prepared.phase !== "open" || prepared.paused) return prepared;
    if (!prepared.cup) return { ...prepared, message: "Ch\u1ECDn m\u1ED9t chi\u1EBFc ly tr\u01B0\u1EDBc nh\xE9." };
    return pourTea(prepared, a);
  }
  const next = progressionActions.has(a.type) ? reduceProgression(prepared, a) : applyProgression(prepared, reduceCore(prepared, a), a);
  return afterIncidents(prepared, next, a);
}
function reduceCore(input, a) {
  if (a.type === "tick" && (input.phase !== "open" || input.paused))
    return input;
  const s = structuredClone(input);
  const say = (m) => {
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
      return say("Ho\xE0n th\xE0nh ho\u1EB7c b\u1ECF ly \u0111ang pha tr\u01B0\u1EDBc khi \u0111\u1ED5i \u0111\u01A1n.");
    const index = s.orders.findIndex((o) => o.id === a.id);
    if (index > 0) s.orders.unshift(...s.orders.splice(index, 1));
    return s;
  }
  if (a.type === "credit") {
    if (s.money < 2e4 && s.creditDay !== s.day) {
      s.creditDay = s.day;
      s.debt += 2e5;
      log2(s, "Vay v\u1ED1n kh\xF4i ph\u1EE5c (kh\xF4ng l\xE3i)", 2e5);
      return say(
        "M\xE2y nh\u1EADn 200.000\u0111 v\u1ED1n vay. Kho\u1EA3n vay \u0111\u01B0\u1EE3c ho\xE0n khi \u0111\u1EE7 ti\u1EC1n sau ng\xE0y b\xE1n."
      );
    }
    return say("V\u1ED1n vay d\xE0nh cho khi s\u1ED1 d\u01B0 d\u01B0\u1EDBi 20.000\u0111, m\u1ED9t l\u1EA7n/ng\xE0y.");
  }
  if (a.type === "buy") {
    const item = supplies.find((x) => x.id === a.id);
    if (!item) return s;
    if (s.phase === "open") return say("H\xE3y \u0111\xF3ng c\u1EEDa tr\u01B0\u1EDBc khi nh\u1EADp kho.");
    const cost = item.price * item.pack;
    if (s.money < cost) return say("Ch\u01B0a \u0111\u1EE7 ti\u1EC1n nh\u1EADp h\xE0ng.");
    if (quantity(s, item.id) + item.pack > 40 + 40 * (s.upgrades.storage ?? 0))
      return say("Kho \u0111\u1EA7y. H\xE3y n\xE2ng c\u1EA5p s\u1EE9c ch\u1EE9a.");
    s.stock[item.id] ??= [];
    s.stock[item.id].push({
      qty: item.pack,
      expires: s.day + item.life + 2 * (s.upgrades.fridge ?? 0)
    });
    log2(s, `Nh\u1EADp ${item.name}`, -cost);
    return say(`\u0110\xE3 nh\u1EADp ${item.pack} ph\u1EA7n ${item.name.toLowerCase()}.`);
  }
  if (a.type === "upgrade") {
    const u = upgrades.find((x) => x.id === a.id);
    if (!u || s.phase === "open") return s;
    const lv = s.upgrades[u.id] ?? 0;
    const cost = u.price * (lv + 1);
    if (s.day < u.day || lv >= u.max || s.money < cost)
      return say("Ch\u01B0a \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n n\xE2ng c\u1EA5p.");
    s.upgrades[u.id] = lv + 1;
    log2(s, `N\xE2ng c\u1EA5p ${u.name}`, -cost);
    return say("G\xF3c ti\u1EC7m v\u1EEBa xinh h\u01A1n m\u1ED9t ch\xFAt!");
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
        `Ch\u01B0a th\u1EC3 m\u1EDF c\u1EEDa. C\u1EA7n nh\u1EADp: ${missing.map(label).join(", ")}.`
      );
    s.phase = "open";
    s.clock = 0;
    s.generated = 0;
    s.target = 5 + Math.min(15, Math.floor(s.day / 2));
    enqueue(s);
    return say("M\xE2y m\u1EDF c\u1EEDa! Ch\u1ECDn ly \u0111\xFAng size \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u.");
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
      const value = expired.reduce((n, l) => n + l.qty, 0) * (supplies.find((x) => x.id === id)?.price ?? 0);
      if (value) {
        s.stats.waste += value;
        log2(s, `H\u1ECFng: ${id}`, 0);
      }
      s.stock[id] = s.stock[id].filter((l) => l.expires > s.day);
    }
    if (s.debt && s.money > 12e4) {
      const repaid = Math.min(s.debt, Math.floor(s.money - 1e5));
      s.debt -= repaid;
      log2(s, "Ho\xE0n v\u1ED1n vay", -repaid);
    }
    return say(
      `Ng\xE0y ${s.day}: ki\u1EC3m tra h\u1EA1n d\xF9ng v\xE0 chu\u1EA9n b\u1ECB \u0111\u1EE7 kho cho menu \u0111\xE3 m\u1EDF.`
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
        text: "M\xECnh \u0111\xE3 ch\u1EDD l\xE2u qu\xE1\u2026"
      };
      s.reputation = Math.max(1, s.reputation - 0.1 * left.length);
      if (left.some((o) => o.id === s.orders[0]?.id)) s.cup = null;
      s.orders = s.orders.filter((o) => o.remaining > 0);
      s.message = "Kh\xE1ch \u0111\xE3 ch\u1EDD qu\xE1 l\xE2u v\xE0 r\u1EDDi \u0111i\u2026";
    }
    enqueue(s);
    if (!s.orders.length) finish(s);
    return s;
  }
  if (a.type === "cup") {
    if (s.cup) return say("B\u1ECF ly hi\u1EC7n t\u1EA1i tr\u01B0\u1EDBc khi ch\u1ECDn ly m\u1EDBi.");
    if (a.size === "L" && !s.upgrades.size) return say("Size L ch\u01B0a m\u1EDF kh\xF3a.");
    if (!consume(s, `cup${a.size}`, 1)) return say("H\u1EBFt ly!");
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
      pourAt: -99
    };
    return say("Ch\u1ECDn b\xECnh tr\xE0, nh\u1EA5n gi\u1EEF v\xF2i v\xE0 th\u1EA3 trong v\xF9ng v\u1EA1ch xanh.");
  }
  if (a.type === "trash") {
    s.cup = null;
    return say("\u0110\xE3 b\u1ECF ly. Nguy\xEAn li\u1EC7u \u0111\xE3 d\xF9ng kh\xF4ng ho\xE0n l\u1EA1i.");
  }
  const c = s.cup;
  if (!c) return say("Ch\u1ECDn m\u1ED9t chi\u1EBFc ly tr\u01B0\u1EDBc nh\xE9.");
  if (c.sealed || c.sealLeft > 0) {
    if (a.type !== "serve") return say("Ly \u0111ang d\xE1n ho\u1EB7c \u0111\xE3 c\xF3 n\u1EAFp.");
  }
  if (a.type === "pour") return pourTea(s, a);
  if (a.type === "top") {
    if (!toppings.some((t) => t.id === a.id) || !unlocked(s, a.id)) return s;
    if (c.topping) return say("Ly \u0111\xE3 c\xF3 topping.");
    if (!consume(s, a.id, 1)) return say("H\u1EBFt topping n\xE0y.");
    c.topping = a.id;
    return say("Topping v\u1EEBa r\u01A1i v\xE0o ly!");
  }
  if (a.type === "flavor") {
    if (!flavors.some((t) => t.id === a.id) || !unlocked(s, a.id)) return s;
    if (c.flavor) return say("Ly \u0111\xE3 c\xF3 h\u01B0\u01A1ng v\u1ECB.");
    if (a.id !== "plain" && !consume(s, a.id, 1))
      return say("H\u1EBFt h\u01B0\u01A1ng v\u1ECB n\xE0y.");
    c.flavor = a.id;
    return s;
  }
  if (a.type === "sugar") {
    if (![0, 30, 50, 70, 100].includes(a.value)) return s;
    if (c.sugar !== null) return say("\u0110\xE3 th\xEAm \u0111\u01B0\u1EDDng.");
    if (a.value > 0 && !consume(s, "sugar", a.value / 100))
      return say("H\u1EBFt \u0111\u01B0\u1EDDng.");
    c.sugar = a.value;
    return s;
  }
  if (a.type === "ice") {
    if (![0, 50, 100].includes(a.value)) return s;
    if (c.ice !== null) return say("\u0110\xE3 th\xEAm \u0111\xE1.");
    if (a.value > 0 && !consume(s, "ice", a.value / 100)) return say("H\u1EBFt \u0111\xE1.");
    c.ice = a.value;
    return s;
  }
  if (a.type === "seal") {
    if (!c.tea || c.fill < 0.6 || !c.topping || !c.flavor || c.sugar === null || c.ice === null)
      return say("C\u1EA7n \u0111\u1EE7 tr\xE0 (\u226560%), topping, h\u01B0\u01A1ng v\u1ECB, \u0111\u01B0\u1EDDng v\xE0 \u0111\xE1.");
    if (!consume(s, "lid", 1)) return say("H\u1EBFt n\u1EAFp!");
    c.sealed = true;
    return say("\u0110\xE3 d\xE1n n\u1EAFp. Ly s\u1EB5n s\xE0ng giao kh\xE1ch!");
  }
  if (a.type === "serve") {
    if (!complete(c) || !s.orders.length)
      return say("Ch\u01B0a th\u1EC3 giao: h\xE3y ho\xE0n th\xE0nh ly v\xE0 d\xE1n n\u1EAFp.");
    const order = s.orders.shift();
    const q = Math.max(
      0,
      1 - (1 - quality(c, order.recipe)) * customers[order.customer].strictness
    );
    const base = Math.round(order.recipe.price * q);
    const tip = q >= 0.9 ? Math.round(
      base * (0.05 + 0.05 * (s.upgrades.decor ?? 0) + (customers[order.customer].personality === "VIP" ? 0.05 : 0))
    ) : 0;
    log2(s, `\u0110\u01A1n #${order.id}`, base + tip);
    s.stats.revenue += base + tip;
    s.stats.served++;
    s.reputation = Math.max(
      1,
      Math.min(5, s.reputation + (q >= 0.9 ? 0.04 : -0.12))
    );
    s.cup = null;
    s.feedback = {
      customer: order.customer,
      mood: q >= 0.99 ? "happy" : q >= 0.8 ? "satisfied" : q >= 0.4 ? "sad" : "angry",
      remaining: 3,
      text: q >= 0.9 ? "Ngon qu\xE1, c\u1EA3m \u01A1n M\xE2y!" : "L\u1EA7n sau pha \u0111\xFAng \u0111\u01A1n nh\xE9."
    };
    s.message = q >= 0.9 ? `${customers[order.customer].name}: Ngon qu\xE1! C\u1EA3m \u01A1n M\xE2y. +${base + tip}\u0111` : `Kh\xE1ch ch\u1EA5m ${Math.round(q * 100)}% \u2014 h\xE3y \u0111\u1ECDc k\u1EF9 \u0111\u01A1n. +${base}\u0111`;
    enqueue(s);
    if (!s.orders.length) finish(s);
    return s;
  }
  return s;
}
var finite2 = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
var integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => finite2(n, min, max) && Number.isInteger(n);
var text = (v) => typeof v === "string" && v.length < 500;
function validate(value) {
  if (!value || typeof value !== "object") return false;
  const s = value;
  try {
    if (s.incidents !== void 0 && !validIncidents(s.incidents)) return false;
    if (s.progression !== void 0 && !validProgression(s.progression))
      return false;
    if (s.version !== 2 || !integer(s.day, 1) || !finite2(s.money, -1e6) || !integer(s.debt) || !integer(s.creditDay) || !finite2(s.reputation, 1, 5) || !integer(s.seed, 0, 4294967295) || !integer(s.sequence) || !integer(s.generated) || !integer(s.target, 1, 100) || !finite2(s.clock) || typeof s.paused !== "boolean" || typeof s.sound !== "boolean" || typeof s.tutorial !== "boolean" || !text(s.message) || !["prep", "open", "summary"].includes(s.phase))
      return false;
    if (!Array.isArray(s.orders) || s.orders.length > 3 || !s.stock || typeof s.stock !== "object" || !s.stats || !s.decor || !s.upgrades || !Array.isArray(s.history) || s.history.length > 365 || !Array.isArray(s.ledger) || s.ledger.length > 600)
      return false;
    for (const [id, lv] of Object.entries(s.upgrades)) {
      const u = upgrades.find((u2) => u2.id === id);
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
      "cup"
    ];
    if (decorKeys.some((id) => !integer(s.decor[id], 0, 2)) || Object.keys(s.decor).length !== 8)
      return false;
    for (const [id, lots] of Object.entries(s.stock))
      if (!supplies.some((i) => i.id === id) || !Array.isArray(lots) || lots.length > 200 || lots.some((l) => !finite2(l.qty, 0, 1e4) || !integer(l.expires, 1)))
        return false;
    for (const h of [s.stats, ...s.history])
      if (!integer(h.day, 1) || !integer(h.served) || !integer(h.lost) || ![h.revenue, h.cogs, h.expenses, h.waste].every((n) => finite2(n)) || !finite2(h.profit, -1e8))
        return false;
    for (const l of s.ledger)
      if (!integer(l.day, 1) || !text(l.kind) || !finite2(l.amount, -1e8))
        return false;
    for (const o of s.orders) {
      const r = o.recipe;
      if (!integer(o.id, 1) || o.id > s.sequence || !integer(o.customer, 0, 19) || !finite2(o.remaining, 0, 1e4) || !finite2(o.total, 1, 1e4) || !r || !recipes.some(
        (c2) => c2.id === r.id && c2.tea === r.tea && c2.size === r.size && c2.topping === r.topping && c2.flavor === r.flavor && c2.price === r.price
      ) || ![0, 30, 50, 70, 100].includes(r.sugar) || ![0, 50, 100].includes(r.ice))
        return false;
    }
    const c = s.cup;
    if (c !== null) {
      if (!c || !["M", "L"].includes(c.size) || !finite2(c.fill, 0, 1.101) || !finite2(c.cost) || !finite2(c.pourAt, -1e3) || !finite2(c.sealLeft, 0, 10) || typeof c.sealed !== "boolean" || c.tea !== null && !teas.some((t) => t.id === c.tea) || c.topping !== null && !toppings.some((t) => t.id === c.topping) || c.flavor !== null && !flavors.some((t) => t.id === c.flavor) || c.sugar !== null && ![0, 30, 50, 70, 100].includes(c.sugar) || c.ice !== null && ![0, 50, 100].includes(c.ice))
        return false;
    }
    if (s.feedback !== null && (!s.feedback || !integer(s.feedback.customer, 0, 19) || !finite2(s.feedback.remaining, 0, 10) || !["happy", "sad", "angry", "satisfied"].includes(s.feedback.mood) || !text(s.feedback.text)))
      return false;
    invariant(s);
    return true;
  } catch {
    return false;
  }
}
function invariant(s) {
  for (const n of [
    s.money,
    s.debt,
    s.reputation,
    s.clock,
    s.stats.revenue,
    s.stats.cogs,
    s.stats.waste
  ])
    if (!Number.isFinite(n)) throw Error("Non-finite state");
  for (const lots of Object.values(s.stock))
    for (const l of lots)
      if (!Number.isFinite(l.qty) || l.qty < 0 || !Number.isFinite(l.expires))
        throw Error("Invalid stock");
  if (new Set(s.orders.map((o) => o.id)).size !== s.orders.length)
    throw Error("Duplicate order");
  for (const o of s.orders)
    if (!Number.isFinite(o.remaining) || !recipes.some((r) => r.id === o.recipe.id) || !customers[o.customer])
      throw Error("Invalid order");
  if (s.cup && (!Number.isFinite(s.cup.fill) || s.cup.fill < 0 || s.cup.fill > 1.101))
    throw Error("Invalid cup");
  if (s.phase === "open" && !s.orders.length) throw Error("Stuck queue");
}
export {
  complete,
  initial,
  invariant,
  missingOpeningSupplies,
  quality,
  quantity,
  recipeNeeds,
  reduce,
  validate
};
