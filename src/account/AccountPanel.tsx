import { useEffect, useState, type FormEvent } from "react";
import { useGame } from "../store";
import { money } from "../catalog";
import { accountConfigured, acceptRecoveryLink, getSession, readProfile, recover, restoreSession, signIn, signOut, signUp, updatePassword, updateProfile, type Profile } from "./client";
import "./account.css";

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const game = useGame((state) => state.game);
  const online = useGame((state) => state.online);
  const [mode, setMode] = useState<"login" | "register" | "recover" | "password">("login");
  const [session, setSession] = useState(getSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [name, setName] = useState("Chủ Tiệm An"), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    let alive = true;
    async function sync() {
      setSession(getSession());
      if (!getSession() || !accountConfigured) return;
      try {
        const value = await readProfile();
        if (alive) { setProfile(value); setName(value.owner_name); }
      } catch (error) { if (alive) setMessage(String(error instanceof Error ? error.message : error)); }
    }
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener("may-account-change", sync);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    void (async () => {
      try {
        if (await acceptRecoveryLink()) setMode("password");
        await restoreSession();
        await sync();
      } catch (error) { if (alive) setMessage(error instanceof Error ? error.message : String(error)); }
    })();
    return () => { alive = false; window.removeEventListener("may-account-change", sync); window.removeEventListener("online", network); window.removeEventListener("offline", network); };
  }, []);
  async function perform(work: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); setPassword(""); setConfirm(""); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      if (mode === "recover") {
        await recover(email); setMessage("Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn khôi phục. Hãy kiểm tra hộp thư."); return;
      }
      if ((mode === "register" || mode === "password") && password !== confirm) throw Error("Mật khẩu xác nhận chưa trùng khớp.");
      if (mode === "password") { await updatePassword(password); setMode("login"); setMessage("Đã cập nhật mật khẩu."); return; }
      if (mode === "register") {
        const active = await signUp(email, password, name);
        setMessage(active ? "Đã tạo tài khoản." : "Hãy kiểm tra email để xác minh và tiếp tục đăng nhập. Nếu đã có tài khoản, hãy dùng Đăng nhập hoặc Quên mật khẩu.");
      } else await signIn(email, password);
    });
  }
  const accountScreen = session && mode !== "password";
  const todayRevenue = game.phase === "summary" ? 0 : game.stats.revenue;
  const todayServed = game.phase === "summary" ? 0 : game.stats.served;
  const totalRevenue = game.history.reduce((sum, day) => sum + day.revenue, todayRevenue);
  const totalServed = game.history.reduce((sum, day) => sum + day.served, todayServed);
  return <section className="account-panel">
    <div className="account-welcome"><img src="/assets/cloud.svg" alt="Mây" /><h3>{accountScreen ? "Hồ sơ chủ quán" : "Một tiệm nhỏ, một giấc mơ"}</h3><p>Mây luôn chờ bạn trở về ♡</p></div>
    {!accountConfigured && <p className="account-banner">Tài khoản online chưa được cấu hình. Tiến trình trên thiết bị vẫn được giữ nguyên. Cần thiết lập Supabase để đăng ký và đồng bộ.</p>}
    {offline && <p role="status" className="account-banner">Bạn đang ngoại tuyến. Không thể đồng bộ tài khoản lúc này.</p>}
    {accountScreen ? <>
      <p className="account-email">{session.user.email}</p>
      <form onSubmit={(event) => { event.preventDefault(); void perform(async () => { await updateProfile(name); setProfile(await readProfile()); useGame.getState().act({ type: "ownerName", name: name.trim() }); setMessage("Đã lưu tên chủ quán."); }); }}>
        <label>Tên chủ quán<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={30} /></label>
        <button disabled={busy || offline} className="primary">Lưu tên chủ quán</button>
      </form>
      <div className="account-stat-grid"><span>Tiệm<b>{profile?.shop_name || "Tiệm Trà Mây"}</b></span><span>Bắt đầu<b>{profile ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "—"}</b></span><span>Ngày kinh doanh<b>{game.day}</b></span><span>{online.active ? "Doanh thu tài khoản" : "Doanh thu trên thiết bị"}<b>{money(totalRevenue)}</b></span><span>Đơn đã phục vụ<b>{totalServed}</b></span><span>Cấp tiệm<b>{1 + Math.floor(totalServed / 10)}</b></span></div>
      <div className="account-banner" role="status">{online.active ? ({ saving: "Đang lưu lên máy chủ…", saved: "Đã lưu trên máy chủ", error: "Đồng bộ đã dừng", local: "Lưu trên thiết bị" })[online.status] : "Đang chơi bằng bản lưu trên thiết bị"}{online.error && <p>{online.error}</p>}</div>
      <p className="hint">Chơi online dùng tiến trình riêng của tài khoản. Bản lưu trên thiết bị được giữ nguyên và khôi phục khi thoát online. Save cũ chưa được nhập vào tài khoản. Cần triển khai máy chủ game trước khi sử dụng.</p>
      <button className="primary" disabled={busy || offline || !accountConfigured} onClick={() => void perform(async () => { await useGame.getState().enterOnline(); setMessage("Đã tải tiến trình từ máy chủ. Bạn có thể quay về tiệm."); })}>{online.active ? "Tải lại bản online" : "Chơi online"}</button>
      {online.active && <button disabled={busy} onClick={() => void perform(async () => { await useGame.getState().leaveOnline(); setMessage("Đã khôi phục bản lưu trên thiết bị."); })}>Về bản lưu trên thiết bị</button>}
      <button disabled={busy} onClick={() => void perform(async () => { await signOut(); setProfile(null); setMessage("Đã đăng xuất. Save trên thiết bị được giữ nguyên."); })}>Đăng xuất</button>
    </> : <>
      <div className="account-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Đăng nhập</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Đăng ký</button></div>
      <form onSubmit={submit}>
        {mode !== "password" && <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>}
        {mode === "register" && <label>Tên chủ quán<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={30} autoComplete="nickname" /></label>}
        {mode !== "recover" && <label>{mode === "password" ? "Mật khẩu mới" : "Mật khẩu"}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? 1 : 10} /></label>}
        {(mode === "register" || mode === "password") && <><small>Ít nhất 10 ký tự, có chữ và số.</small><label>Xác nhận mật khẩu<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label></>}
        <button className="primary" disabled={busy || !accountConfigured || offline}>{busy ? "Đang xử lý…" : ({ login: "Đăng nhập", register: "Mở tiệm của bạn", recover: "Gửi email khôi phục", password: "Đặt mật khẩu mới" })[mode]}</button>
      </form>
      <button className="account-link" onClick={() => setMode("recover")}>Quên mật khẩu?</button>
    </>}
    {message && <p role="status" className="account-banner">{message}</p>}
    <button className="account-link" onClick={onClose}>Quay về tiệm</button>
  </section>;
}
