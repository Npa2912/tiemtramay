import { useEffect, useState, type FormEvent } from "react";
import { useGame } from "../store";
import { money } from "../catalog";
import {
  accountConfigured,
  acceptRecoveryLink,
  getSession,
  readProfile,
  recover,
  restoreSession,
  signIn,
  signOut,
  signUp,
  updatePassword,
  updateProfile,
  type Profile,
} from "./client";
import "./account.css";

export function AccountPanel({
  onClose,
  onEntered,
  fullPage = false,
}: {
  onClose: () => void;
  onEntered?: () => void;
  fullPage?: boolean;
}) {
  const game = useGame((state) => state.game);
  const online = useGame((state) => state.online);
  const [mode, setMode] = useState<
    "login" | "register" | "recover" | "password"
  >("login");
  const [session, setSession] = useState(getSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [name, setName] = useState("Chủ Tiệm An"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [messageKind, setMessageKind] = useState<"info"|"error"|"success">("info");
  const [showPassword, setShowPassword] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    let alive = true;
    async function sync() {
      setSession(getSession());
      if (!getSession() || !accountConfigured) return;
      try {
        const value = await readProfile();
        if (alive) {
          setProfile(value);
          setName(value.owner_name);
        }
      } catch (error) {
        if (alive)
          setMessage(String(error instanceof Error ? error.message : error));
      }
    }
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener("may-account-change", sync);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    void (async () => {
      try {
        const hadLink = location.hash.includes("access_token");
        const recovery = await acceptRecoveryLink();
        if (recovery) setMode("password");
        await restoreSession();
        await sync();
        if (
          hadLink &&
          !recovery &&
          getSession() &&
          !useGame.getState().online.active
        ) {
          await useGame.getState().enterOnline();
          onEntered?.();
        }
      } catch (error) {
        if (alive)
          setMessage(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener("may-account-change", sync);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setMessageKind("info");
    try {
      await work();
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setPassword("");
      setConfirm("");
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      if (!accountConfigured) throw Error("Tài khoản online chưa được kết nối máy chủ. Chủ game cần hoàn tất cấu hình Supabase trước khi đăng ký hoặc đăng nhập. Bạn vẫn có thể chọn chơi trên thiết bị.");
      if (offline) throw Error("Bạn đang mất mạng. Hãy kết nối Internet rồi thử lại.");
      if (mode === "recover") {
        await recover(email);
        setMessage(
          "Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn khôi phục. Hãy kiểm tra hộp thư.",
        );
        return;
      }
      if ((mode === "register" || mode === "password") && password !== confirm)
        throw Error("Mật khẩu xác nhận chưa trùng khớp.");
      if (mode === "password") {
        await updatePassword(password);
        await useGame.getState().enterOnline();
        onEntered?.();
        setMode("login");
        setMessage("Đã cập nhật mật khẩu.");
        return;
      }
      if (mode === "register") {
        const active = await signUp(email, password, name);
        if (active) {
          setMessageKind("success");
          setMessage("Đăng ký thành công. Đang mở tiệm của bạn…");
          await useGame.getState().enterOnline();
          onEntered?.();
        }
        setMessage(
          active
            ? "Đăng ký thành công."
            : "Đã gửi yêu cầu đăng ký. Hãy mở email xác nhận để hoàn tất, sau đó quay lại đăng nhập. Nếu đã có tài khoản, chọn Đăng nhập hoặc Quên mật khẩu.",
        );
      } else {
        await signIn(email, password);
        setMessageKind("success");
        setMessage("Đăng nhập thành công. Đang tải tiến trình và mở tiệm…");
        await useGame.getState().enterOnline();
        onEntered?.();
      }
    });
  }
  const accountScreen = session && mode !== "password";
  const todayRevenue = game.phase === "summary" ? 0 : game.stats.revenue;
  const todayServed = game.phase === "summary" ? 0 : game.stats.served;
  const totalRevenue = game.history.reduce(
    (sum, day) => sum + day.revenue,
    todayRevenue,
  );
  const totalServed = game.history.reduce(
    (sum, day) => sum + day.served,
    todayServed,
  );
  return (
    <section
      className={`account-panel ${fullPage ? "account-full" : ""} account-mode-${mode}`}
    >
      <div className="account-welcome">
        <h3>
          {accountScreen
            ? "Hồ sơ chủ quán"
            : mode === "register"
              ? "Mở tiệm của bạn"
              : mode === "recover"
                ? "Tìm lại chìa khóa tiệm"
                : mode === "password"
                  ? "Đặt mật khẩu mới"
                  : "Chào mừng trở lại!"}
        </h3>
        <p>
          {mode === "register"
            ? "Một tiệm nhỏ, một giấc mơ"
            : "Mây đang chờ bạn về tiệm ♡"}
        </p>
        <span className="account-divider">──── ❧ ────</span>
      </div>
      {fullPage && (
        <img
          className="account-host"
          src="/assets/owner-chibi.webp"
          alt="Chủ tiệm chibi cầm ly trà sữa"
        />
      )}
      {message && <p role={messageKind === "error" ? "alert" : "status"} className={`account-feedback account-feedback-${messageKind}`} aria-live="polite">{message}</p>}
      {!accountConfigured && (
        <p className="account-banner config-banner">
          Đăng nhập online đang chờ kết nối máy chủ. Bản lưu trên thiết bị vẫn dùng được.
        </p>
      )}
      {offline && (
        <p role="status" className="account-banner">
          Bạn đang ngoại tuyến. Không thể đồng bộ tài khoản lúc này.
        </p>
      )}
      {accountScreen ? (
        <>
          <p className="account-email">{session.user.email}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                await updateProfile(name);
                setProfile(await readProfile());
                useGame
                  .getState()
                  .act({ type: "ownerName", name: name.trim() });
                setMessage("Đã lưu tên chủ quán.");
              });
            }}
          >
            <label>
              Tên chủ quán
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={30}
              />
            </label>
            <button disabled={busy || offline} className="primary">
              Lưu tên chủ quán
            </button>
          </form>
          <div className="account-stat-grid">
            <span>
              Tiệm<b>{profile?.shop_name || "Tiệm Trà Mây"}</b>
            </span>
            <span>
              Bắt đầu
              <b>
                {profile
                  ? new Date(profile.created_at).toLocaleDateString("vi-VN")
                  : "—"}
              </b>
            </span>
            <span>
              Ngày kinh doanh<b>{game.day}</b>
            </span>
            <span>
              {online.active
                ? "Doanh thu tài khoản"
                : "Doanh thu trên thiết bị"}
              <b>{money(totalRevenue)}</b>
            </span>
            <span>
              Đơn đã phục vụ<b>{totalServed}</b>
            </span>
            <span>
              Cấp tiệm<b>{1 + Math.floor(totalServed / 10)}</b>
            </span>
          </div>
          <div className="account-banner" role="status">
            {online.active
              ? {
                  saving: "Đang lưu lên máy chủ…",
                  saved: "Đã lưu trên máy chủ",
                  error: "Đồng bộ đã dừng",
                  local: "Lưu trên thiết bị",
                }[online.status]
              : "Đang chơi bằng bản lưu trên thiết bị"}
            {online.error && <p>{online.error}</p>}
          </div>
          <p className="hint">
            Chơi online dùng tiến trình riêng của tài khoản. Tiến trình tài
            khoản được lưu trên máy chủ, dùng lại khi đăng nhập trên thiết bị
            hoặc mạng khác. Bản lưu khách trên thiết bị được giữ riêng và không
            ghi đè tài khoản.
          </p>
          <button
            className="primary"
            disabled={busy || offline || !accountConfigured}
            onClick={() =>
              void perform(async () => {
                await useGame.getState().enterOnline();
                setMessage(
                  "Đã tải tiến trình từ máy chủ. Bạn có thể quay về tiệm.",
                );
                onEntered?.();
              })
            }
          >
            {online.active ? "Tải lại bản online" : "Chơi online"}
          </button>

          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await signOut();
                setProfile(null);
                setMessage("Đã đăng xuất. Save trên thiết bị được giữ nguyên.");
              })
            }
          >
            Đăng xuất
          </button>
        </>
      ) : (
        <>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                ♙ Tên chủ quán
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={30}
                  autoComplete="nickname"
                />
              </label>
            )}
            {mode !== "password" && (
              <label>
                ✉ Email
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="ban@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "recover" && (
              <label>
                {mode === "password" ? "Mật khẩu mới" : "Mật khẩu"}
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "login" ? 1 : 10}
                />
              </label>
            )}
            {(mode === "register" || mode === "password") && (
              <>
                <small>Ít nhất 10 ký tự, có chữ và số.</small>
                <label>
                  Xác nhận mật khẩu
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                  />
                </label>
              </>
            )}
            {mode !== "recover" && (
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ẩn mật khẩu ◉" : "Hiện mật khẩu ◉"}
              </button>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="forgot-password"
                onClick={() => setMode("recover")}
              >
                Quên mật khẩu?
              </button>
            )}
            {mode === "register" && (
              <div className="startup-capital">
                🪙{" "}
                <span>
                  Vốn khởi nghiệp<strong>1.000.000đ</strong>
                </span>{" "}
                ✧
              </div>
            )}
            <button
              className="primary account-submit"
              disabled={busy}
              onClick={event => {
                if(!accountConfigured || offline){
                  event.preventDefault();
                  setMessageKind("error");
                  setMessage(!accountConfigured ? "Tài khoản online chưa được kết nối máy chủ. Chủ game cần hoàn tất cấu hình Supabase trước khi đăng ký hoặc đăng nhập. Bạn vẫn có thể chọn chơi trên thiết bị." : "Bạn đang mất mạng. Hãy kết nối Internet rồi thử lại.");
                }
              }}
            >
              {busy
                ? mode === "register" ? "Đang đăng ký…" : mode === "login" ? "Đang đăng nhập…" : "Đang xử lý…"
                : {
                    login: "Đăng nhập",
                    register: "Tạo tài khoản",
                    recover: "Gửi email khôi phục",
                    password: "Đặt mật khẩu mới",
                  }[mode]}
            </button>
          </form>
          <p className="account-switch-text">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
          </p>
          <button
            className="account-switch"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMessage("");
            }}
          >
            {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </>
      )}
      <button
        className="account-link guest-button"
        onClick={() => {
          if (fullPage && getSession()) {
            setMessage(
              "Bạn đang đăng nhập. Hãy đăng xuất trước nếu muốn chơi bản lưu riêng trên thiết bị.",
            );
            return;
          }
          onClose();
        }}
      >
        {fullPage ? "Tiếp tục chơi trên thiết bị" : "Quay về tiệm"}
      </button>
    </section>
  );
}
