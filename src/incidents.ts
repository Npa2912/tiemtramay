import type { Action, State } from "./engine";

export interface Incidents {
  version: 1;
  day: number;
  theftPlanned: boolean;
  powerPlanned: boolean;
  machinePlanned: boolean;
  theftChecked: boolean;
  powerChecked: boolean;
  machineChecked: boolean;
  powerLeft: number;
  machineBroken: boolean;
  expires: Record<string, number>;
  theft: {
    day: number;
    amount: number;
    recovered: boolean;
    camera?: boolean;
  } | null;
  notice: string;
}
export type IncidentAction = {
  type: "repairMachine" | "recoverTheft" | "dismissIncident";
};
export function dailyRoll(seed: number, day: number, salt: number) {
  let x = (seed ^ Math.imul(day, 0x9e3779b9) ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
export function createIncidents(seed: number, day: number): Incidents {
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
    notice: "",
  };
}
export function ensureIncidents(
  input: State,
): State & { incidents: Incidents } {
  if (input.incidents) return input as State & { incidents: Incidents };
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
export function validIncidents(v: unknown): v is Incidents {
  if (!v || typeof v !== "object") return false;
  const i = v as Incidents;
  return (
    i.version === 1 &&
    Number.isSafeInteger(i.day) &&
    i.day >= 1 &&
    [
      "theftPlanned",
      "powerPlanned",
      "machinePlanned",
      "theftChecked",
      "powerChecked",
      "machineChecked",
      "machineBroken",
    ].every((k) => typeof i[k as keyof Incidents] === "boolean") &&
    Number.isFinite(i.powerLeft) &&
    i.powerLeft >= 0 &&
    i.powerLeft <= 60 &&
    typeof i.notice === "string" &&
    i.notice.length < 1000 &&
    !!i.expires &&
    typeof i.expires === "object" &&
    Object.entries(i.expires).every(
      ([k, v]) =>
        ["lock", "camera"].includes(k) && Number.isSafeInteger(v) && v >= 1,
    ) &&
    (i.theft === null ||
      (!!i.theft &&
        Number.isSafeInteger(i.theft.day) &&
        i.theft.day >= 1 &&
        Number.isSafeInteger(i.theft.amount) &&
        i.theft.amount >= 0 &&
        typeof i.theft.recovered === "boolean" &&
        (i.theft.camera === undefined || typeof i.theft.camera === "boolean")))
  );
}
export function securityActive(s: State, id: string) {
  if (!s.progression?.security[id]) return false;
  if (id !== "lock" && id !== "camera") return true;
  const expiry = s.incidents?.expires[id];
  return expiry === undefined || expiry >= s.day;
}
export function equipmentLabel(s: State, id: string) {
  if (!securityActive(s, id)) return "Chưa có / đã hết hạn";
  if (id === "lock") return "Bảo vệ hết hôm nay";
  if (id === "camera")
    return `Còn ${(s.incidents?.expires.camera ?? s.day + 9) - s.day + 1} ngày`;
  return "Sử dụng vĩnh viễn";
}
export function productionBlocked(s: State) {
  return (
    !!s.incidents &&
    (s.incidents.machineBroken ||
      (s.incidents.powerLeft > 0 && !securityActive(s, "generator")))
  );
}
function expense(s: State, kind: string, amount: number) {
  s.money -= amount;
  s.ledger.push({ day: s.day, kind, amount: -amount });
  s.ledger = s.ledger.slice(-600);
  if (s.progression) {
    if (s.phase === "summary") {
      s.stats.expenses += amount;
      s.stats.profit =
        s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
      if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    } else
      s.progression.eventExpenses = (s.progression.eventExpenses ?? 0) + amount;
  }
}
function history(s: State, id: string, text: string) {
  if (s.progression) {
    s.progression.eventHistory.push({
      id,
      day: s.day,
      choice: "incident",
      text,
    });
    s.progression.eventHistory = s.progression.eventHistory.slice(-200);
    s.progression.metrics.events++;
  }
  s.message = text;
}
const brewActions = new Set([
  "cup",
  "pour",
  "top",
  "flavor",
  "sugar",
  "ice",
  "seal",
  "serve",
  "trash",
  "selectOrder",
]);
export function interceptIncident(input: State, a: Action): State | null {
  const source = ensureIncidents(input),
    i = source.incidents;
  if (a.type === "dismissIncident") {
    const s = structuredClone(source);
    s.incidents.notice = "";
    return s;
  }
  if (a.type === "recoverTheft") {
    const s = structuredClone(source),
      theft = s.incidents.theft;
    if (
      theft &&
      theft.day === s.day &&
      theft.camera &&
      !theft.recovered &&
      securityActive(s, "camera")
    ) {
      s.money += theft.amount;
      s.ledger.push({
        day: s.day,
        kind: "Camera: thu hồi tiền thất lạc",
        amount: theft.amount,
      });
      s.ledger = s.ledger.slice(-600);
      theft.recovered = true;
      if (s.progression) {
        if (s.phase === "summary") {
          s.stats.expenses = Math.max(0, s.stats.expenses - theft.amount);
          s.stats.profit =
            s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
          if (s.history.length)
            s.history[s.history.length - 1] = { ...s.stats };
        } else
          s.progression.eventExpenses = Math.max(
            0,
            (s.progression.eventExpenses ?? 0) - theft.amount,
          );
      }
      s.incidents.notice = "Camera đã giúp đối chiếu và thu hồi tiền thất lạc.";
    }
    return s;
  }
  if (a.type === "repairMachine") {
    const s = structuredClone(source);
    if (!s.incidents.machineBroken) return s;
    if (s.money < 50000) {
      s.message = "Cần 50.000đ để sửa máy, hoặc mua máy dự phòng 25.000đ.";
      return s;
    }
    expense(s, "Sửa máy dán nắp", 50000);
    s.incidents.machineBroken = false;
    s.incidents.notice = "Máy đã được sửa. Tiếp tục pha ly đang làm nhé!";
    return s;
  }
  if (
    a.type === "tick" &&
    productionBlocked(source) &&
    source.phase === "open"
  ) {
    if (source.paused) return source;
    const s = structuredClone(source);
    s.incidents.powerLeft = Math.max(
      0,
      s.incidents.powerLeft -
        Math.max(0, Math.min(1, Number.isFinite(a.dt) ? a.dt : 0)),
    );
    if (i.powerLeft > 0 && s.incidents.powerLeft === 0)
      s.incidents.notice = "Điện đã trở lại! Quầy tiếp tục hoạt động.";
    return s;
  }
  if (brewActions.has(a.type) && productionBlocked(source)) return source;
  if (
    !source.paused &&
    source.phase === "open" &&
    source.cup &&
    (a.type === "pour" || a.type === "seal")
  ) {
    if (!i.powerChecked && i.powerPlanned) {
      const s = structuredClone(source);
      s.incidents.powerChecked = true;
      s.incidents.powerLeft = securityActive(s, "generator") ? 0 : 60;
      history(
        s,
        "power",
        securityActive(s, "generator")
          ? "Mất điện! Máy phát đã bật, quầy vẫn hoạt động."
          : "Mất điện! Quầy tạm dừng 60 giây; khách và ly đang pha được giữ nguyên.",
      );
      s.incidents.notice = s.message;
      if (s.incidents.powerLeft > 0) return s;
    }
    if (
      !i.machineChecked &&
      i.machinePlanned &&
      !securityActive(source, "backup")
    ) {
      const s = structuredClone(source);
      s.incidents.machineChecked = true;
      s.incidents.machineBroken = true;
      history(
        s,
        "machine",
        "Máy dán nắp bị hỏng! Sửa 50.000đ hoặc mua máy dự phòng 25.000đ.",
      );
      s.incidents.notice = s.message;
      return s;
    }
  }
  return null;
}
export function afterIncidents(previous: State, next: State, a: Action): State {
  if (previous === next) return next;
  const s = ensureIncidents(next),
    i = s.incidents;
  if (s.day !== i.day) {
    const fresh = createIncidents(previous.seed, s.day);
    fresh.expires = { ...i.expires };
    fresh.theft = i.theft;
    fresh.machineBroken = i.machineBroken;
    s.incidents = fresh;
    for (const id of ["lock", "camera"])
      if (
        fresh.expires[id] !== undefined &&
        fresh.expires[id] < s.day &&
        s.progression
      )
        delete s.progression.security[id];
  }
  if (
    a.type === "security" &&
    s.progression?.security[a.id] &&
    !previous.progression?.security[a.id]
  ) {
    if (a.id === "lock") s.incidents.expires.lock = s.day;
    if (a.id === "camera") s.incidents.expires.camera = s.day + 9;
    if (a.id === "backup") s.incidents.machineBroken = false;
    if (a.id === "generator") s.incidents.powerLeft = 0;
  }
  const current = s.incidents;
  if (
    !s.paused &&
    s.phase === "open" &&
    s.cup &&
    (a.type === "pour" || a.type === "seal")
  ) {
    if (!current.theftChecked) {
      current.theftChecked = true;
      if (current.theftPlanned) {
        const loss = securityActive(s, "lock")
          ? 0
          : Math.floor(
              Math.max(0, s.money) * (securityActive(s, "safe") ? 0.05 : 0.1),
            );
        current.theft = {
          day: s.day,
          amount: loss,
          recovered: loss === 0,
          camera: securityActive(s, "camera"),
        };
        if (loss) expense(s, "Mất trộm: thất thoát vốn", loss);
        history(
          s,
          "theft",
          loss
            ? `Quầy bị trộm ${loss.toLocaleString("vi-VN")}đ (${securityActive(s, "safe") ? "5% nhờ két tiền" : "10% vốn hiện có"}).`
            : securityActive(s, "lock")
              ? "Khóa chống trộm hôm nay đã bảo vệ toàn bộ tiền quầy."
              : "Vụ trộm không gây thất thoát vì quỹ hiện không có số dư.",
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
          current.powerLeft
            ? "Mất điện! Đợi 60 giây hoặc dùng máy phát."
            : "Mất điện, máy phát đang duy trì quầy.",
        );
        current.notice = s.message;
      }
    }
    if (!current.machineChecked) {
      current.machineChecked = true;
      if (current.machinePlanned) {
        current.machineBroken = !securityActive(s, "backup");
        history(
          s,
          "machine",
          current.machineBroken
            ? "Máy hỏng! Sửa 50.000đ hoặc máy dự phòng 25.000đ."
            : "Máy chính hỏng; máy dự phòng đã tiếp quản.",
        );
        current.notice = s.message;
      }
    }
  }
  return s;
}
