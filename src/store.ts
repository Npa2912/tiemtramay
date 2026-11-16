import { create } from "zustand";
import { initial, reduce, validate, type Action, type State } from "./engine";
import { save, load } from "./persistence";
import { cloudAction, getSession } from "./account/client";
export interface OnlineStatus {
  active: boolean;
  status: "local" | "saving" | "saved" | "error";
  error: string;
  revision: number | null;
  userId: string | null;
}
const localStatus = (): OnlineStatus => ({ active: false, status: "local", error: "", revision: null, userId: null });
interface Store {
  game: State;
  ready: boolean;
  error: string;
  act: (a: Action) => void;
  replace: (s: State) => void;
  init: () => Promise<void>;
  online: OnlineStatus;
  enterOnline: () => Promise<void>;
  leaveOnline: () => Promise<void>;
}
let localSnapshot: State | null = null;
let generation = 0;
let queue: Action[] = [];
let pumpTimer: ReturnType<typeof setTimeout> | undefined;
let pumping = false;
let lastClockSent = 0;
let switching = false;
let startedRequests = 0;
let finishedRequests = 0;
function cancelQueue() {
  generation++;
  queue = [];
  if (pumpTimer) clearTimeout(pumpTimer);
  pumpTimer = undefined;
}
function enqueue(action: Action) {
  const { online, game } = useGame.getState();
  if (!online.active || online.status === "error") return;
  if (action.type === "tick" && (game.phase !== "open" || game.paused)) return;
  if (action.type === "tick" || action.type === "pour") {
    // Frame events are coalesced: a pour carries its own server clock tick.
    const last = queue[queue.length - 1];
    if (last?.type === "tick" || last?.type === "pour") {
      if (action.type === "pour" || last.type === "tick") queue[queue.length - 1] = action;
    } else if (Date.now() - lastClockSent >= 180) queue.push(action);
  } else queue.push(action);
  if (!pumpTimer && !pumping && queue.length) pumpTimer = setTimeout(() => { pumpTimer = undefined; void pump(); }, 40);
}
async function pump() {
  if (pumping || !queue.length) return;
  const ticket = generation;
  const current = useGame.getState();
  if (!current.online.active || current.online.status === "error") return;
  const action = queue.shift()!;
  startedRequests++;
  pumping = true;
  lastClockSent = Date.now();
  useGame.setState({ online: { ...current.online, status: "saving" } });
  try {
    if (getSession()?.user.id !== current.online.userId) throw Error("Tài khoản đã thay đổi. Hãy trở về bản lưu trên thiết bị.");
    const result = await cloudAction(action, current.online.revision);
    if (!validate(result.state)) throw Error("Bản lưu trên máy chủ chưa tương thích. Cần cập nhật máy chủ game.");
    if (ticket === generation) useGame.setState({ game: result.state, online: { ...current.online, revision: result.revision, status: "saved", error: "" } });
  } catch (error) {
    if (ticket === generation) {
      queue = [];
      useGame.setState({ online: { ...current.online, status: "error", error: error instanceof Error ? error.message : String(error) } });
    }
  } finally {
    finishedRequests++;
    pumping = false;
    if (queue.length) void pump();
  }
}
export const useGame = create<Store>((set, get) => ({
  game: initial(),
  ready: false,
  error: "",
  online: localStatus(),
  act: (a) => {
    if (switching) return;
    if (get().online.active) enqueue(a);
    else set({ game: reduce(get().game, a) });
  },
  replace: (s) => {
    if (switching) { set({ error: "Đang chuyển bản lưu. Hãy chờ thao tác hoàn tất." }); return; }
    if (get().online.active) { set({ error: "Không thể nhập hoặc reset save khi đang chơi online. Hãy trở về bản lưu trên thiết bị trước." }); return; }
    set({ game: s });
  },
  enterOnline: async () => {
    if (switching) throw Error("Đang chuyển bản lưu. Hãy chờ thao tác hoàn tất.");
    const identity = getSession()?.user.id;
    if (!identity) throw Error("Hãy đăng nhập trước khi chơi online.");
    switching = true;
    cancelQueue();
    const ticket = generation;
    try {
      if (!get().online.active) {
        localSnapshot = structuredClone(get().game);
        await save(localSnapshot); // Actions are locked until the source switch completes.
      }
      const result = await cloudAction(null, null);
      if (!validate(result.state)) throw Error("Bản lưu trên máy chủ chưa tương thích. Cần cập nhật máy chủ game.");
      if (ticket !== generation) throw Error("Đã hủy chuyển bản lưu.");
      if (getSession()?.user.id !== identity) throw Error("Tài khoản đã thay đổi. Vui lòng thử lại.");
      set({ game: result.state, online: { active: true, status: "saved", error: "", revision: result.revision, userId: identity } });
    } finally {
      if (ticket === generation) switching = false;
    }
  },
  leaveOnline: async () => {
    cancelQueue();
    switching = false;
    const guest = localSnapshot || await load();
    localSnapshot = null;
    set({ game: guest, online: localStatus() });
  },
  init: async () => {
    try {
      set({ game: await load(), ready: true });
    } catch (e) {
      set({ ready: true, error: String(e) });
    }
  },
}));
let timer: ReturnType<typeof setTimeout> | undefined;
useGame.subscribe((s, prev) => {
  if (!s.ready || s.online.active || s.game === prev.game) return;
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    const state = useGame.getState();
    if (state.online.active) return;
    save(state.game).catch((e) =>
      useGame.setState({ error: `Không lưu được: ${String(e)}` }),
    );
  }, 500);
});
export async function flushSave() {
  const current = useGame.getState();
  if (switching) throw Error("Đang chuyển bản lưu. Hãy chờ thao tác hoàn tất.");
  if (!current.online.active) return save(current.game);
  const ticket = generation;
  const target = startedRequests + queue.length;
  const deadline = Date.now() + 10000;
  // Wait for commands that existed at the time of this save request. Later frame
  // ticks must not keep a manual save waiting forever during active gameplay.
  while (true) {
    const status = useGame.getState().online;
    if (ticket !== generation || !status.active) throw Error("Bản lưu đã chuyển chế độ. Hãy lưu lại ở chế độ hiện tại.");
    if (status.status === "error") throw Error(status.error || "Chưa lưu được lên máy chủ.");
    if (finishedRequests >= target) return;
    if (Date.now() >= deadline) throw Error("Máy chủ chưa xác nhận lưu. Vui lòng kiểm tra kết nối và thử lại.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("may-account-change", () => {
    const { online, leaveOnline } = useGame.getState();
    if (online.active && online.userId !== getSession()?.user.id) void leaveOnline();
  });
  window.addEventListener("offline", () => {
    const { online } = useGame.getState();
    if (online.active) {
      cancelQueue();
      useGame.setState({ online: { ...online, status: "error", error: "Mất kết nối. Tiến trình server chưa được ghi đè; hãy kết nối mạng và tải lại bản online." } });
    }
  });
}
