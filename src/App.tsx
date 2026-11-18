import { useShallow } from "zustand/react/shallow";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Counter } from "./Counter";
import { BrewOptions } from "./BrewOptions";
import { ProgressionPanel } from "./ProgressionPanel";
import { AuthScreen } from "./account/AuthScreen";
import { getSession } from "./account/client";
import { productionBlocked, securityActive } from "./incidents";
import { AccountPanel } from "./account/AccountPanel";
import { useGame, flushSave } from "./store";
import {
  customers,
  flavors,
  label,
  money,
  recipes,
  supplies,
  teas,
  toppings,
  upgrades,
  unlocked,
} from "./catalog";
import {
  complete,
  initial,
  quantity,
  missingOpeningSupplies,
  type Action,
  type State,
} from "./engine";
import { parseSave, freshSeed } from "./persistence";
import { effect, setMusic, setPouring } from "./audio";
type Panel =
  | "kho"
  | "recipe"
  | "upgrade"
  | "decor"
  | "report"
  | "settings"
  | "events"
  | "staff"
  | "quests"
  | "achievements"
  | "account"
  | "brew"
  | null;
const iconPaths: Record<string, ReactNode> = {
    cup: (
      <>
        <path d="M6 7h12l-2 14H8Z M5 4h14 M14 4l3-3" />
        <path d="M9 12h6" />
      </>
    ),
    kho: (
      <>
        <path d="M3 9h18v12H3Z M2 4h20v5H2Z M9 13h6" />
      </>
    ),
    recipe: (
      <>
        <path d="M12 5Q6 1 2 5v16q5-4 10 0 5-4 10 0V5q-5-4-10 0Z M12 5v16" />
      </>
    ),
    upgrade: (
      <>
        <path d="M4 20h16M7 17V9h10v8M5 10l7-7 7 7M10 14h4" />
      </>
    ),
    decor: (
      <>
        <path d="M9 21h6l2-7H7Z M12 14V3 M12 9Q1 0 5 8l7 4M12 10q11-10 7-2l-7 4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
      </>
    ),
    pause: <path d="M8 5v14M16 5v14" />,
    report: <path d="M4 21V4h16v17ZM8 9h8M8 13h8M8 17h5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />,
};
const Icon = memo(function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] ?? iconPaths.cup}
    </svg>
  );
});
function cupCanPour(game: State) {
  const c = game.cup;
  return (
    game.phase === "open" &&
    !game.paused &&
    !productionBlocked(game) &&
    !!c &&
    !c.sealed &&
    c.sealLeft === 0 &&
    c.fill < 1.1
  );
}

export default function App() {
  const { game: s, act, ready, error, online } = useGame(
    useShallow(({ game, act, ready, error, online }) => ({ game, act, ready, error, online })),
  );
  const [panel, setPanel] = useState<Panel>(
      location.hash.includes("access_token") ? "account" : null,
    ),
    [tea, setTea] = useState("milk"),
    [notice, setNotice] = useState(""),
    [confirmReset, setConfirmReset] = useState(false);
  const [guest, setGuest] = useState(
    () => sessionStorage.getItem("may.guest") === "1",
  );
  useEffect(() => {
    function changed() {
      if (!getSession()) {
        sessionStorage.removeItem("may.guest");
        setGuest(false);
      }
    }
    window.addEventListener("may-account-change", changed);
    return () => window.removeEventListener("may-account-change", changed);
  }, []);
  const pourSince = useRef<number | null>(null),
    last = useRef(0),
    file = useRef<HTMLInputElement>(null);
  const order = s.orders[0],
    r = order?.recipe,
    c = s.cup;
  const missingSupplies =
    s.phase === "open" && panel !== "kho" ? [] : missingOpeningSupplies(s);
  const actor = s.feedback?.customer ?? order?.customer;
  const mood =
    s.feedback?.mood ??
    (order && order.remaining < order.total * 0.25 ? "angry" : "");
  const send = (a: Action) => {
    act(a);
    if (s.sound) effect(a.type);
  };
  useEffect(() => {
    void useGame.getState().init();
  }, []);
  useEffect(() => {
    setMusic(s.sound);
    return () => setMusic(false);
  }, [s.sound]);
  useEffect(() => {
    let frame: number;
    function loop(now: number) {
      if (now - last.current >= 70) {
        const { online, act } = useGame.getState();
        if (!online.active || pourSince.current === null)
          act({ type: "tick", dt: (now - last.current) / 1000 });
        last.current = now;
      }
      const began = pourSince.current;
      if (began !== null) {
        const { game, act, online } = useGame.getState();
        const canPour = online.status !== "error" && cupCanPour(game);
        if (!canPour) {
          pourSince.current = null;
          useGame.setState({ pourInput: null });
          setPouring(false);
        }
        // The local reducer runs at most 30 times per second while held.
        const elapsed = now - began;
        if (canPour && elapsed >= 1000 / 30) {
          pourSince.current = now;
          act({ type: "pour", tea, dt: Math.min(0.15, elapsed / 1000) });
        }
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      setPouring(false);
    };
  }, [tea]);
  useEffect(() => {
    function stop() {
      pourSince.current = null;
      if (useGame.getState().pourInput !== null) useGame.setState({ pourInput: null });
      setPouring(false);
    }
    function hidden() {
      stop();
      if (document.hidden && !useGame.getState().game.paused)
        useGame.getState().act({ type: "pause" });
      void flushSave().catch(() => {});
    }
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", hidden);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", hidden);
    };
  }, []);
  function startPour() {
    const { game, online } = useGame.getState();
    if (pourSince.current !== null || online.status === "error" || !cupCanPour(game)) return;
    pourSince.current = performance.now();
    useGame.setState({ pourInput: tea });
    setPouring(game.sound);
  }
  function stopPour(commit: boolean) {
    const began = pourSince.current;
    pourSince.current = null;
    if (useGame.getState().pourInput !== null) useGame.setState({ pourInput: null });
    setPouring(false);
    if (began === null || !commit) return;
    const { game, act } = useGame.getState();
    const dt = Math.min(0.15, (performance.now() - began) / 1000);
    if (dt > 0 && cupCanPour(game))
      act({ type: "pour", tea, dt });
  }
  function openPanel(p: Panel) {
    stopPour(false);
    setPanel(p);
    if (s.phase === "open" && !s.paused) act({ type: "pause" });
  }
  function closePanel() {
    setPanel(null);
    setNotice("");
    setConfirmReset(false);
    if (s.paused) act({ type: "pause" });
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TiemTraMay-ngay-${s.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!ready)
    return (
      <main className="loading">
        <img src="/assets/cloud.svg" alt="" />
        <p>Mây đang dọn quầy…</p>
      </main>
    );
  if (!online.active && (!guest || getSession()))
    return (
      <AuthScreen
        onGuest={() => {
          sessionStorage.setItem("may.guest", "1");
          setGuest(true);
        }}
      />
    );
  return (
    <div className="world">
      <main
        className={`game awning-${s.decor.awning} ${s.progression?.reducedMotion ? "reduce-motion" : ""}`}
      >
        {s.incidents && productionBlocked(s) && (
          <div
            className={`incident-blocker ${s.incidents.powerLeft > 0 && !securityActive(s, "generator") ? "blackout" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Sự cố thiết bị"
          >
            <div className="incident-dialog">
              <span className="incident-symbol">
                {s.incidents.powerLeft > 0 && !securityActive(s, "generator")
                  ? "🔦"
                  : "🔧"}
              </span>
              <h2>
                {s.incidents.powerLeft > 0 && !securityActive(s, "generator")
                  ? "Mất điện trong khu phố!"
                  : "Máy dán nắp bị hỏng!"}
              </h2>
              {s.incidents.powerLeft > 0 && !securityActive(s, "generator") ? (
                <>
                  <strong className="power-countdown">
                    {Math.ceil(s.incidents.powerLeft)} giây
                  </strong>
                  <p>
                    Đang chờ điện trở lại. Ly đang pha và thời gian chờ của
                    khách được giữ nguyên.
                  </p>
                  <button
                    onClick={() => act({ type: "security", id: "generator" })}
                    disabled={s.money < 60000}
                  >
                    Dùng máy phát · 60.000đ
                  </button>
                  <button onClick={() => act({ type: "close" })}>
                    Kết sổ hôm nay
                  </button>
                </>
              ) : (
                <>
                  <p>Sửa máy chính hoặc dùng máy dự phòng để tiếp tục.</p>
                  <button
                    disabled={s.money < 50000}
                    onClick={() => act({ type: "repairMachine" })}
                  >
                    Sửa máy · 50.000đ
                  </button>
                  {securityActive(s, "backup") && (
                    <button onClick={() => act({ type: "useBackup" })}>
                      Dùng máy dự phòng
                    </button>
                  )}
                  {s.money < 50000 && (
                    <button onClick={() => act({ type: "advanceRepair" })}>
                      Ứng {money(Math.ceil(50000 - s.money))} & sửa máy
                    </button>
                  )}
                </>
              )}
              {s.paused && (
                <button onClick={() => act({ type: "pause" })}>
                  Tiếp tục đếm giờ
                </button>
              )}
            </div>
          </div>
        )}
        {s.incidents?.notice && !productionBlocked(s) && (
          <div className="incident-toast" role="status">
            <span>{s.incidents.notice}</span>
            {s.incidents.theft &&
              s.incidents.theft.day === s.day &&
              s.incidents.theft.camera &&
              !s.incidents.theft.recovered &&
              securityActive(s, "camera") && (
                <button onClick={() => act({ type: "recoverTheft" })}>
                  Kiểm tra camera & thu hồi
                </button>
              )}
            <button
              onClick={() => act({ type: "dismissIncident" })}
              aria-label="Đóng thông báo sự cố"
            >
              ×
            </button>
          </div>
        )}
        <header className="statusbar">
          <button
            className="owner-chip"
            onClick={() => openPanel("account")}
            aria-label="Hồ sơ chủ quán"
          >
            <img src="/assets/may-host.svg" alt="" />
            <span>
              <b>{s.progression?.ownerName || "Chủ Tiệm An"}</b>
              <small>
                Lv.{Math.max(1, Math.floor(s.day / 3) + 1)} · Tiệm của bạn
              </small>
            </span>
          </button>
          <div>
            <small>NGÀY {String(s.day).padStart(2, "0")}</small>
            <b>
              {s.phase === "open"
                ? `${String(8 + Math.floor(s.clock / 60)).padStart(2, "0")}:${String(Math.floor(s.clock % 60)).padStart(2, "0")}`
                : "08:00"}
            </b>
          </div>
          <div className="wallet">
            <small>🪙 VỐN CỦA TIỆM</small>
            <b>{money(s.money)}</b>
          </div>
          <div className="rating">
            <Icon name="star" />
            <b>{s.reputation.toFixed(1)}</b>
          </div>
          <button
            className="icon-button"
            aria-label="Tạm dừng"
            onClick={() => {
              stopPour(false);
              act({ type: "pause" });
            }}
          >
            <Icon name="pause" />
          </button>
          <button
            className="icon-button"
            aria-label="Cài đặt"
            onClick={() => openPanel("settings")}
          >
            ☰
          </button>
        </header>
        <div className="shop-name">
          <div className="awning" />
          <img className="sign-cloud" src="/assets/cloud.svg" alt="" />
          <img className="garden-frame" src="/assets/garden-frame.svg" alt="" />
          <span>• TRÀ NGON, NGÀY LÀNH •</span>
          <strong>
            {
              ["Tiệm Trà Mây", "Mây & Những Tách Trà", "Một Chút Ngọt Ngào"][
                s.decor.sign
              ]
            }
          </strong>
          <i>est. 2026</i>
        </div>
        <section className="welcome-scene" aria-label="Mây chào bạn">
          <img
            className="may-host"
            src="/assets/may-host.svg"
            alt="Mây vẫy tay chào"
          />
          <div className="welcome-bubble">
            <b>Chào {s.progression?.ownerName || "Chủ Tiệm An"}! ♡</b>
            <p>
              {s.feedback?.text ||
                (s.phase === "open"
                  ? "Thêm chút ngọt ngào vào ngày của khách nhé!"
                  : "Một chút trà thơm, một ngày thật lành.")}
            </p>
            <button onClick={() => openPanel("quests")}>
              📋 Nhiệm vụ hôm nay
            </button>
          </div>
          <button className="daily-goals" onClick={() => openPanel("quests")}>
            <b>⭐ Mục tiêu hôm nay</b>
            <span>
              ☑ Phục vụ {s.target} ly ({s.stats.served}/{s.target})
            </span>
            <span>🪙 {money(s.stats.revenue)} doanh thu</span>
            <span>⭐ Đánh giá ≥ 4.5</span>
          </button>
        </section>

        <section className="workbench" aria-label="Quầy pha chế">
          <div className="tea-row">
            {teas.map((t) => (
              <button
                key={t.id}
                className={`tea ${tea === t.id ? "selected" : ""}`}
                disabled={!unlocked(s, t.id) || s.phase !== "open" || s.paused}
                onClick={() => setTea(t.id)}
                aria-label={`Chọn ${t.name}`}
              >
                <img src={`/assets/drink-${t.id}.svg`} alt="" />
                <span>{t.name}</span>
                {!unlocked(s, t.id) ? (
                  <small>
                    {s.day < t.day ? "Ngày " + t.day : "Mở ở Nâng cấp"}
                  </small>
                ) : (
                  <small>{Math.floor(quantity(s, t.id))} phần</small>
                )}
              </button>
            ))}
          </div>
          <section className="customer-area" aria-label="Khách hàng">
            <h2 className="section-label">
              🔔 Đơn hàng chờ ({s.orders.length})
            </h2>
            <div className="queue">
              <span>
                {s.phase === "open"
                  ? `ĐANG CHỜ · ${s.orders.length}`
                  : "HẸN BẠN Ở MÂY"}
              </span>
              <div>
                {s.orders.slice(1).map((o) => (
                  <img
                    key={o.id}
                    src={customers[o.customer].avatar}
                    alt={customers[o.customer].name}
                  />
                ))}
              </div>
              <small>
                {s.stats.served}/{s.target} ly
              </small>
            </div>
            <div className="order-list">
              {s.orders.map((o, index) => (
                <button
                  key={o.id}
                  className={`order-ticket ${index === 0 ? "selected" : ""}`}
                  disabled={!!c || s.paused}
                  onClick={() => send({ type: "selectOrder", id: o.id })}
                  aria-label={`Chọn đơn ${o.id}`}
                >
                  <img
                    src={customers[o.customer].avatar}
                    alt={customers[o.customer].name}
                  />
                  <img
                    className="order-drink"
                    src={`/assets/drink-${o.recipe.tea}.svg`}
                    alt={label(o.recipe.tea)}
                  />
                  <span>
                    <b>{label(o.recipe.tea)}</b>
                    <small>
                      ⏱ {Math.ceil(o.remaining)}s · {o.recipe.size}
                    </small>
                    <strong>+{money(o.recipe.price)}</strong>
                  </span>
                  <i>{index === 0 ? "✓" : "♡"}</i>
                </button>
              ))}
            </div>
            <div className="customer-row">
              <div className={`portrait ${s.feedback ? "happy" : ""}`}>
                <img
                  src={
                    actor !== undefined
                      ? `/assets/customer-${actor}${mood ? "-" + mood : ""}.svg`
                      : "/assets/customer-0.svg"
                  }
                  alt={
                    actor !== undefined
                      ? `${customers[actor].name} ${mood}`
                      : "Chủ tiệm"
                  }
                />
                <b>{actor !== undefined ? customers[actor].name : "Mây"}</b>
              </div>
              <div className="speech">
                {r ? (
                  <>
                    <div className="order-heading">
                      <b>
                        {label(r.tea)} · {r.size}
                      </b>
                      <span>#{order.id}</span>
                    </div>
                    <p>
                      {label(r.topping)} · {label(r.flavor)}
                    </p>
                    <p>
                      Đường <strong>{r.sugar}%</strong> ·{" "}
                      {r.ice === 50 ? "Ít đá" : "Đá thường"}
                    </p>
                    <small>
                      {money(r.price)} · {customers[order.customer].personality}
                    </small>
                    <div
                      className="patience"
                      role="progressbar"
                      aria-label="Kiên nhẫn"
                      aria-valuenow={Math.round(
                        (order.remaining / order.total) * 100,
                      )}
                    >
                      <i
                        style={{
                          width: `${Math.max(0, (order.remaining / order.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <b>
                      {s.phase === "summary"
                        ? "Hôm nay vất vả rồi!"
                        : "Chào mừng về tiệm."}
                    </b>
                    <p>
                      {s.phase === "summary"
                        ? "Xem sổ ngày, rồi chuẩn bị cho ngày mai nhé."
                        : "Nhập kho, chuẩn bị quầy và mở cửa đón những vị khách đầu tiên."}
                    </p>
                    <small>Mỗi chiếc ly, một niềm vui.</small>
                  </>
                )}
              </div>
            </div>
          </section>
          <div className="stage">
            <h2 className="section-label">🧋 Pha chế đồ uống</h2>
            <Counter />
            <div className="cup-stack">
              <span>CHỌN LY</span>
              <button
                disabled={s.phase !== "open" || !!c || s.paused}
                onClick={() => send({ type: "cup", size: "M" })}
                aria-label="Chọn ly M"
              >
                <Icon name="cup" />M <small>{quantity(s, "cupM")}</small>
              </button>
              <button
                disabled={
                  s.phase !== "open" || !!c || !s.upgrades.size || s.paused
                }
                onClick={() => send({ type: "cup", size: "L" })}
                aria-label="Chọn ly L"
              >
                <Icon name="cup" />L{" "}
                <small>{s.upgrades.size ? quantity(s, "cupL") : "Khóa"}</small>
              </button>
            </div>
            <button
              className="pour-button"
              data-testid="pour"
              disabled={
                !c ||
                c.sealed ||
                c.sealLeft > 0 ||
                s.phase !== "open" ||
                s.paused
              }
              onPointerDown={(e) => {
                if (!e.isPrimary || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                startPour();
              }}
              onPointerUp={(e) => {
                if (e.isPrimary) stopPour(true);
              }}
              onPointerCancel={(e) => {
                if (e.isPrimary) stopPour(false);
              }}
              onLostPointerCapture={() => stopPour(false)}
              onKeyDown={(e) => {
                if (e.code === "Space" || e.code === "Enter") {
                  e.preventDefault();
                  startPour();
                }
              }}
              onKeyUp={(e) => {
                if (e.code === "Space" || e.code === "Enter") stopPour(true);
              }}
              onBlur={() => stopPour(false)}
            >
              Giữ để rót <span>{label(tea)}</span>
            </button>
            <div className="fill-readout" data-testid="fill">
              {c ? `${Math.round(c.fill * 100)}%` : "Đặt ly để bắt đầu"}
              <small>Vạch chuẩn 77–93%</small>
            </div>
            <button
              className="seal-button"
              disabled={!c || c.sealed || c.sealLeft > 0 || s.paused}
              onClick={() => {
                stopPour(true);
                send({ type: "seal" });
              }}
            >
              {c?.sealed ? "Đã dán nắp" : c?.sealLeft ? "Đang dán…" : "Dán nắp"}
              <small>{s.upgrades.staff ? "Có bạn hỗ trợ" : "máy Mây 01"}</small>
            </button>
            <div className="serve-row">
              <button
                className="trash"
                onClick={() => send({ type: "trash" })}
                disabled={!c || s.paused}
              >
                Bỏ ly
              </button>
              <button
                className="primary serve"
                disabled={!complete(c) || s.paused}
                onClick={() => send({ type: "serve" })}
              >
                Giao cho khách <span>→</span>
              </button>
            </div>
            {s.phase !== "open" && (
              <div className="closed-card">
                <img src="/assets/cloud.svg" alt="" />
                <h2>
                  {s.phase === "prep"
                    ? "Một ngày mới ở Mây"
                    : "Cảm ơn một ngày ngọt ngào"}
                </h2>
                <p>
                  {s.phase === "prep"
                    ? missingSupplies.length
                      ? `Cần nhập: ${missingSupplies.map(label).join(", ")}.`
                      : `Ngày ${s.day} · Nguyên liệu đã sẵn sàng!`
                    : `${s.stats.served} ly đã trao · Doanh thu ${money(s.stats.revenue)}`}
                </p>
                <div>
                  {s.phase === "prep" ? (
                    <>
                      <button onClick={() => openPanel("kho")}>
                        Nhập nguyên liệu
                      </button>
                      <button
                        className="primary"
                        onClick={() => {
                          send({ type: "open" });
                          if (missingSupplies.length) openPanel("kho");
                        }}
                      >
                        Mở cửa tiệm
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openPanel("report")}>
                        Xem tổng kết
                      </button>
                      <button
                        className="primary"
                        onClick={() => send({ type: "next" })}
                      >
                        Sang ngày {s.day + 1}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="ingredient-drawer">
            <div className="drawer-title">
              <span>THÊM MỘT CHÚT NGON</span>
              <button className="expand-brew" onClick={() => openPanel("brew")}>
                Phóng to lựa chọn ↗
              </button>
            </div>
            <div className="toppings">
              {toppings.map((t, i) => (
                <button
                  className={`topping t${i} ${c?.topping === t.id ? "chosen" : ""}`}
                  key={t.id}
                  disabled={
                    !unlocked(s, t.id) ||
                    s.phase !== "open" ||
                    s.paused ||
                    !!c?.topping
                  }
                  onClick={() => send({ type: "top", id: t.id })}
                >
                  <span className="bowl">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{t.name}</span>
                  <small>
                    {!unlocked(s, t.id)
                      ? s.day < t.day
                        ? `Ngày ${t.day}`
                        : "Chưa mở"
                      : `${Math.floor(quantity(s, t.id))} phần`}
                  </small>
                </button>
              ))}
            </div>
            <div className="options">
              <span>Hương</span>
              <div>
                {flavors.map((f) => (
                  <button
                    key={f.id}
                    className={c?.flavor === f.id ? "active" : ""}
                    disabled={
                      !unlocked(s, f.id) ||
                      s.phase !== "open" ||
                      s.paused ||
                      (c?.flavor !== null && !!c)
                    }
                    onClick={() => send({ type: "flavor", id: f.id })}
                  >
                    {f.name}
                    {s.day < f.day ? ` · ${f.day}` : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="options">
              <span>Đường</span>
              <div>
                {[0, 30, 50, 70, 100].map((v) => (
                  <button
                    key={v}
                    className={c?.sugar === v ? "active" : ""}
                    disabled={
                      s.phase !== "open" ||
                      s.paused ||
                      (c?.sugar !== null && !!c)
                    }
                    onClick={() => send({ type: "sugar", value: v })}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div className="options">
              <span>Đá</span>
              <div>
                {[0, 50, 100].map((v, i) => (
                  <button
                    key={v}
                    className={c?.ice === v ? "active" : ""}
                    disabled={
                      s.phase !== "open" || s.paused || (c?.ice !== null && !!c)
                    }
                    onClick={() => send({ type: "ice", value: v })}
                  >
                    {["Không đá", "Ít đá", "Đá thường"][i]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <button className="event-banner" onClick={() => openPanel("events")}>
          <span>🌸 SỰ KIỆN TẠI MÂY</span>
          <b>
            {s.progression?.event
              ? "Có chuyện mới! Ghé xem nhé ♡"
              : "Mỗi ngày, một câu chuyện mới"}
          </b>
          <span className="event-arrow">❯</span>
        </button>
        <div className="message" role="status">
          {online.active
            ? online.status === "error"
              ? online.error
              : online.status === "saving"
                ? "☁ Đang lưu online…"
                : "☁ Đã lưu online · " + s.message
            : s.message}
        </div>
        {s.tutorial && (
          <div className="tutorial">
            <b>Sổ tay ngày đầu</b>
            <p>
              {s.phase === "prep"
                ? "1. Nhập 8 nguyên liệu cần thiết trong Kho. Sau đó mở cửa."
                : !c
                  ? "2. Đọc đơn và chọn ly M."
                  : !c.tea
                    ? "3. Chọn trà, giữ vòi rồi thả ở 77–93%."
                    : !c.topping
                      ? "4. Thêm topping, hương vị, đường và đá đúng đơn."
                      : !c.sealed
                        ? "5. Dán nắp, đợi máy hoàn tất rồi giao khách."
                        : "6. Giao ly. Hoàn thành các đơn để kết thúc ngày."}
            </p>
            <button onClick={() => act({ type: "tutorial" })}>Đã hiểu</button>
          </div>
        )}
        <nav className="bottom-nav" aria-label="Quản lý tiệm">
          <button className="nav-home active" onClick={closePanel}>
            <span className="nav-emoji" aria-hidden="true">
              🏪
            </span>
            <span>Tiệm</span>
          </button>
          {(
            [
              "kho",
              "upgrade",
              "decor",
              "staff",
              "events",
              "achievements",
            ] as const
          ).map((p, i) => (
            <button key={p} onClick={() => openPanel(p)}>
              <span className="nav-emoji" aria-hidden="true">
                {["📦", "🏡", "🪑", "👩‍🍳", "🎁", "🏆"][i]}
              </span>
              <span>
                {
                  [
                    "Kho",
                    "Nâng cấp",
                    "Trang trí",
                    "Nhân viên",
                    "Sự kiện",
                    "Thành tựu",
                  ][i]
                }
              </span>
            </button>
          ))}
        </nav>
        {s.phase !== "summary" && (
          <button className="close-day" onClick={() => send({ type: "close" })}>
            {s.phase === "open"
              ? "Đóng cửa sớm & tổng kết"
              : "Nghỉ hôm nay & kết sổ"}
          </button>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {s.paused && !panel && (
          <div className="modal-scrim">
            <section className="modal pause-modal">
              <img src="/assets/cloud.svg" alt="" />
              <h2>Mây nghỉ một chút</h2>
              <p>Khách và quầy pha chế đang tạm dừng.</p>
              <button
                className="primary"
                onClick={() => act({ type: "pause" })}
              >
                Tiếp tục
              </button>
              <button
                onClick={() => {
                  void flushSave()
                    .then(() => setNotice("Đã lưu tiến trình."))
                    .catch((e) => setNotice(String(e)));
                }}
              >
                Lưu game
              </button>
              <p>{notice}</p>
            </section>
          </div>
        )}
        {panel && (
          <div className="modal-scrim">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={panel}
            >
              <div className="modal-head">
                <div>
                  <small>SỔ TAY CỦA MÂY</small>
                  <h2>
                    {
                      {
                        kho: "Kho nguyên liệu",
                        recipe: "Những ly trà thương",
                        upgrade: "Chăm chút tiệm mình",
                        decor: "Góc nhỏ của bạn",
                        report: "Sổ bán hàng",
                        settings: "Cài đặt & lưu game",
                        events: "Chuyện nhỏ ở Mây",
                        staff: "Những người bạn đồng hành",
                        quests: "Nhiệm vụ hôm nay",
                        achievements: "Bộ sưu tập thành tựu",
                        account: "Hồ sơ chủ quán",
                        brew: "Chọn vị ngon cho ly trà",
                      }[panel]
                    }
                  </h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Đóng cửa sổ"
                  onClick={closePanel}
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-body">
                {panel === "brew" && <BrewOptions game={s} act={act} />}
                {panel === "account" && <AccountPanel onClose={closePanel} />}
                {(
                  ["staff", "events", "quests", "achievements"] as string[]
                ).includes(panel) && (
                  <ProgressionPanel
                    game={s}
                    tab={
                      panel as "staff" | "events" | "quests" | "achievements"
                    }
                    act={(a) => act(a)}
                  />
                )}
                {panel === "kho" && (
                  <>
                    <div className="panel-summary">
                      <b>{money(s.money)}</b>
                      <span>
                        Sức chứa: {40 + 40 * (s.upgrades.storage ?? 0)}/loại
                      </span>
                    </div>
                    <p className="hint">
                      Mỗi gói 20 phần. Nguyên liệu hết hạn bị loại bỏ khi sang
                      ngày. Trong giờ mở cửa, kho chỉ xem.
                    </p>
                    {missingSupplies.length > 0 && (
                      <p className="hint" role="alert">
                        Để mở cửa, cần nhập:{" "}
                        {missingSupplies.map(label).join(", ")}. Mua bằng nút
                        +20 bên cạnh từng loại.
                      </p>
                    )}
                    <div className="inventory">
                      {supplies.map((item) => (
                        <article key={item.id}>
                          <div>
                            <b>{item.name}</b>
                            <small>
                              {quantity(s, item.id).toFixed(1)} phần ·{" "}
                              {s.stock[item.id]?.length
                                ? `HSD ngày ${Math.min(...s.stock[item.id].map((l) => l.expires))}`
                                : "Chưa có hàng"}{" "}
                              {quantity(s, item.id) < 3 ? "· Sắp hết" : ""}
                            </small>
                            {s.stock[item.id]?.some(
                              (l) => l.expires <= s.day + 1,
                            ) && <small className="warning">Sắp hết hạn</small>}
                          </div>
                          <button
                            disabled={
                              s.phase === "open" ||
                              s.money < item.price * item.pack ||
                              quantity(s, item.id) + 20 >
                                40 + 40 * (s.upgrades.storage ?? 0)
                            }
                            onClick={() => send({ type: "buy", id: item.id })}
                          >
                            +20<small>{money(item.price * item.pack)}</small>
                          </button>
                        </article>
                      ))}
                    </div>
                    <button onClick={() => send({ type: "credit" })}>
                      Vốn vay khôi phục · Nợ {money(s.debt)}
                    </button>
                  </>
                )}
                {panel === "recipe" && (
                  <>
                    <p className="hint">
                      36 công thức. Mở trà và topping theo ngày; size L cần nâng
                      cấp. Đơn đầu ưu tiên ít tùy chỉnh.
                    </p>
                    {recipes.map((rec) => (
                      <article className="recipe-card" key={rec.id}>
                        <img src={`/assets/tea-${rec.tea}.svg`} alt="" />
                        <div>
                          <b>
                            {rec.name} · {rec.size}
                          </b>
                          <small>
                            {label(rec.flavor)} · {rec.sugar}% đường ·{" "}
                            {rec.ice === 50 ? "ít đá" : "đá thường"}
                          </small>
                          <small>
                            {rec.day > s.day
                              ? `Mở ngày ${rec.day}`
                              : !unlocked(s, rec.tea) ||
                                  !unlocked(s, rec.topping) ||
                                  !unlocked(s, rec.flavor)
                                ? "Cần mở nguyên liệu"
                                : rec.size === "L" && !s.upgrades.size
                                  ? "Cần nâng cấp size L"
                                  : "Đã mở"}{" "}
                            · {money(rec.price)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </>
                )}
                {panel === "upgrade" && (
                  <>
                    <div className="panel-summary">
                      <b>{money(s.money)}</b>
                      <span>Đầu tư cho ngày mai</span>
                    </div>
                    {upgrades.map((u) => (
                      <article className="upgrade-card" key={u.id}>
                        <div>
                          <b>{u.name}</b>
                          <p>{u.desc}</p>
                          <small>
                            Cấp {s.upgrades[u.id] ?? 0}/{u.max} · Mở ngày{" "}
                            {u.day}
                          </small>
                        </div>
                        <button
                          disabled={
                            s.phase === "open" ||
                            s.day < u.day ||
                            (s.upgrades[u.id] ?? 0) >= u.max ||
                            s.money < u.price * ((s.upgrades[u.id] ?? 0) + 1)
                          }
                          onClick={() => send({ type: "upgrade", id: u.id })}
                        >
                          {(s.upgrades[u.id] ?? 0) >= u.max
                            ? "Đã tối đa"
                            : money(u.price * ((s.upgrades[u.id] ?? 0) + 1))}
                        </button>
                      </article>
                    ))}
                  </>
                )}
                {panel === "decor" && (
                  <>
                    <p className="hint">
                      Bộ trang trí gốc miễn phí. Phong cách được lưu cùng tiệm,
                      thay đổi xuất hiện trên quầy.
                    </p>
                    {Object.keys(s.decor).map((id, i) => (
                      <div className="decor-row" key={id}>
                        <b>
                          {
                            [
                              "Mái hiên",
                              "Biển hiệu",
                              "Tường",
                              "Mặt quầy",
                              "Kệ",
                              "Cây xanh",
                              "Đèn",
                              "Họa tiết ly",
                            ][i]
                          }
                        </b>
                        <div>
                          {[0, 1, 2].map((v) => (
                            <button
                              key={v}
                              className={s.decor[id] === v ? "active" : ""}
                              onClick={() => {
                                const was = s.paused;
                                if (was) act({ type: "pause" });
                                act({ type: "decor", id, value: v });
                                if (was) act({ type: "pause" });
                              }}
                            >
                              {["Mây hồng", "Vườn trà", "Nắng nhẹ"][v]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {panel === "report" && (
                  <>
                    <div className="panel-summary">
                      <b>Ngày {s.day}</b>
                      <span>Nợ vốn: {money(s.debt)}</span>
                    </div>
                    {(s.phase === "summary"
                      ? [s.stats]
                      : s.history.slice(-1)
                    ).map((day) => (
                      <div key={day.day} className="receipt">
                        <h3>TIỆM TRÀ MÂY · NGÀY {day.day}</h3>
                        {[
                          ["Đã phục vụ", `${day.served} khách`],
                          ["Khách rời đi", `${day.lost} khách`],
                          ["Doanh thu", money(day.revenue)],
                          ["Giá vốn sử dụng", money(day.cogs)],
                          ["Thuê / điện / lương", money(day.expenses)],
                          ["Nguyên liệu hỏng", money(day.waste)],
                          ["Lợi nhuận", money(day.profit)],
                        ].map(([k, v]) => (
                          <p key={k}>
                            <span>{k}</span>
                            <b>{v}</b>
                          </p>
                        ))}
                      </div>
                    ))}
                    <h3>Nhật ký giao dịch</h3>
                    {s.ledger
                      .slice(-60)
                      .reverse()
                      .map((l, i) => (
                        <div className="ledger" key={i}>
                          <span>
                            Ngày {l.day} · {l.kind}
                          </span>
                          <b>{money(l.amount)}</b>
                        </div>
                      ))}
                    <h3>Lịch sử ngày</h3>
                    {s.history
                      .slice()
                      .reverse()
                      .map((h) => (
                        <div className="ledger" key={h.day}>
                          <span>
                            Ngày {h.day} · {h.served} ly
                          </span>
                          <b>{money(h.profit)}</b>
                        </div>
                      ))}
                  </>
                )}
                {panel === "settings" && (
                  <div className="settings">
                    <button onClick={() => act({ type: "reducedMotion" })}>
                      Giảm hiệu ứng:{" "}
                      {s.progression?.reducedMotion ? "Bật" : "Tắt"}
                    </button>
                    <label>
                      Tên chủ quán
                      <input
                        defaultValue={s.progression?.ownerName || "Chủ Tiệm An"}
                        maxLength={30}
                        onBlur={(e) =>
                          act({ type: "ownerName", name: e.target.value })
                        }
                      />
                    </label>
                    <button onClick={() => setPanel("recipe")}>
                      Sổ công thức
                    </button>
                    <button onClick={() => setPanel("account")}>
                      Hồ sơ & tài khoản
                    </button>
                    <button onClick={() => act({ type: "sound" })}>
                      Âm thanh: {s.sound ? "Bật" : "Tắt"}
                    </button>
                    <button
                      onClick={() => {
                        void flushSave()
                          .then(() => setNotice("Đã lưu vào IndexedDB."))
                          .catch((e) => setNotice(String(e)));
                      }}
                    >
                      Lưu thủ công
                    </button>
                    <button onClick={exportSave}>Xuất save JSON</button>
                    <button onClick={() => file.current?.click()}>
                      Nhập save JSON
                    </button>
                    <input
                      ref={file}
                      hidden
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        try {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const loaded = parseSave(await f.text());
                          useGame.getState().replace(loaded);
                          await flushSave();
                          setNotice("Đã nhập bản lưu.");
                        } catch (err) {
                          setNotice(String(err));
                        }
                        e.target.value = "";
                      }}
                    />
                    <button onClick={() => setPanel("report")}>
                      Xem sổ bán hàng
                    </button>
                    <button
                      className="danger"
                      onClick={() => setConfirmReset(true)}
                    >
                      Bắt đầu tiệm mới
                    </button>
                    {confirmReset && (
                      <div className="reset-confirm">
                        <p>
                          Xóa tiến trình trên thiết bị này? Hãy xuất save trước
                          nếu muốn giữ lại.
                        </p>
                        <button
                          className="danger"
                          onClick={() => {
                            useGame.getState().replace(initial(freshSeed()));
                            void flushSave();
                            setConfirmReset(false);
                            setNotice("Đã bắt đầu tiệm mới.");
                          }}
                        >
                          Xóa và bắt đầu lại
                        </button>
                        <button onClick={() => setConfirmReset(false)}>
                          Hủy
                        </button>
                      </div>
                    )}
                    <p className="hint">
                      Tự lưu sau thao tác. Game chạy độc lập, không gửi dữ liệu
                      lên máy chủ. Dữ liệu gắn với trình duyệt và địa chỉ web
                      hiện tại.
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-footer" role="status">
                {notice || s.message}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
