import { create } from "zustand";
import { initial, reduce, type Action, type State } from "./engine";
import { save, load } from "./persistence";
interface Store {
  game: State;
  ready: boolean;
  error: string;
  act: (a: Action) => void;
  replace: (s: State) => void;
  init: () => Promise<void>;
}
export const useGame = create<Store>((set, get) => ({
  game: initial(),
  ready: false,
  error: "",
  act: (a) => set({ game: reduce(get().game, a) }),
  replace: (s) => set({ game: s }),
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
  if (!s.ready || s.game === prev.game) return;
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    save(useGame.getState().game).catch((e) =>
      useGame.setState({ error: `Không lưu được: ${String(e)}` }),
    );
  }, 500);
});
export const flushSave = () => save(useGame.getState().game);
