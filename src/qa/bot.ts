// Development/test controller only. Imported by tests, never imported by main.tsx.
import {
  initial,
  reduce,
  invariant,
  quantity,
  type Action,
  type State,
} from "../engine";
import {
  supplies,
  upgrades,
  teas,
  toppings,
  flavors,
  unlocked,
} from "../catalog";
export class Bot {
  state: State;
  constructor(seed = 4271) {
    this.state = initial(seed);
  }
  act(a: Action) {
    this.state = reduce(this.state, a);
    invariant(this.state);
    return this;
  }
  stock() {
    for (const item of supplies.filter((x) => {
      const entry = [...teas, ...toppings, ...flavors].find(
        (e) => e.id === x.id,
      );
      return (
        (!entry || unlocked(this.state, x.id)) &&
        (x.id !== "cupL" || this.state.day >= 3)
      );
    })) {
      if (
        quantity(this.state, item.id) < 20 &&
        this.state.money >= item.price * 20
      )
        this.act({ type: "buy", id: item.id });
    }
    return this;
  }
  brew(wrong = false) {
    const r = this.state.orders[0].recipe;
    this.act({ type: "cup", size: r.size });
    this.act({
      type: "pour",
      tea: wrong ? (r.tea === "milk" ? "black" : "milk") : r.tea,
      dt: 0.85 / 0.32,
    });
    this.act({ type: "top", id: r.topping });
    this.act({ type: "flavor", id: r.flavor });
    this.act({ type: "sugar", value: r.sugar });
    this.act({ type: "ice", value: r.ice });
    this.act({ type: "seal" });
    for (let i = 0; i < 3; i++) this.act({ type: "tick", dt: 1 });
    this.act({ type: "serve" });
    return this;
  }
  day() {
    for (const u of upgrades)
      if (
        (u.id === "size" ||
          u.id.startsWith("tea-") ||
          u.id.startsWith("top-") ||
          u.id.startsWith("flavor-")) &&
        this.state.day >= u.day &&
        !this.state.upgrades[u.id]
      )
        this.act({ type: "upgrade", id: u.id });
    this.stock();
    this.act({ type: "open" });
    if (this.state.phase !== "open") throw Error(this.state.message);
    let guard = 0;
    while (this.state.phase === "open" && guard++ < 50) this.brew();
    if ((this.state as State).phase !== "summary")
      throw Error("Bot cannot complete day");
    return this;
  }
  next() {
    return this.act({ type: "next" });
  }
  reload() {
    this.state = JSON.parse(JSON.stringify(this.state)) as State;
    invariant(this.state);
    return this;
  }
  timeout() {
    for (let i = 0; i < 200; i++) this.act({ type: "tick", dt: 1 });
    return this;
  }
}
