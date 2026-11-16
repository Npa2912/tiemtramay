import type { Action, State } from "../engine";
import { validOwnerName } from "../progression";

const url = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
export const accountConfigured = /^https:\/\//.test(url) && key.length > 20;
const sessionKey = "may.auth.session.v1";
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string; user_metadata?: { owner_name?: string } };
}
export interface Profile { owner_name: string; shop_name: string; created_at: string }
export interface CloudSave { state: State; revision: number }
let session: Session | null = null;
try { session = JSON.parse(localStorage.getItem(sessionKey) || "null"); } catch { /* No valid cached session. */ }
export const getSession = () => session;
function remember(value: Session | null) {
  session = value;
  if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
  else localStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event("may-account-change"));
}
export function validName(value: string) {
  return validOwnerName(value.trim()) && !/(lồn|cặc)/iu.test(value);
}
export function validPassword(value: string) {
  return value.length >= 10 && /[a-z]/i.test(value) && /[0-9]/.test(value);
}
async function request(path: string, init: RequestInit = {}, token = session?.access_token) {
  if (!accountConfigured) throw Error("Chưa cấu hình dịch vụ tài khoản. Bạn vẫn có thể chơi trên thiết bị này.");
  if (!navigator.onLine) throw Error("Đang ngoại tuyến. Hãy kết nối mạng để dùng tài khoản.");
  const response = await fetch(`${url}${path}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(15000),
    headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 409) throw Error("Tiến trình đã đổi trên thiết bị khác. Tải lại bản trên máy chủ trước khi tiếp tục.");
    if (response.status === 401 || response.status === 403) throw Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
    const code = data?.error_code || data?.code;
    if (code === "invalid_credentials") throw Error("Email hoặc mật khẩu chưa đúng.");
    if (response.status === 429) throw Error("Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
    throw Error("Chưa thể hoàn tất yêu cầu. Kiểm tra xác minh email, cấu hình dịch vụ và thử lại.");
  }
  return data;
}
function acceptSession(value: Session & { expires_in?: number }) {
  remember({ ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600) });
}
export async function signIn(email: string, password: string) {
  const result = await request("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }, undefined);
  acceptSession(result);
}
export async function signUp(email: string, password: string, name: string) {
  if (!validName(name)) throw Error("Tên cần 2–30 ký tự chữ, số, khoảng trắng hoặc . ' - và nội dung phù hợp.");
  if (!validPassword(password)) throw Error("Mật khẩu cần ít nhất 10 ký tự, có chữ và số.");
  const result = await request("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password, data: { owner_name: name.trim() } }) }, undefined);
  if (result.access_token) acceptSession(result);
  return Boolean(result.access_token);
}
export async function restoreSession() {
  if (!session) return;
  if (session.expires_at > Date.now() / 1000 + 60) {
    await request("/auth/v1/user");
    return;
  }
  try {
    const result = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) }, undefined);
    acceptSession(result);
  } catch (error) { remember(null); throw error; }
}
export async function signOut() {
  try { if (session) await request("/auth/v1/logout", { method: "POST" }); }
  finally { remember(null); }
}
export async function recover(email: string) {
  await request("/auth/v1/recover", { method: "POST", body: JSON.stringify({ email, redirect_to: `${location.origin}/` }) }, undefined);
}
export async function acceptRecoveryLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  const access = params.get("access_token"), refresh = params.get("refresh_token");
  if (!access || !refresh) return false;
  const user = await request("/auth/v1/user", {}, access);
  acceptSession({ access_token: access, refresh_token: refresh, expires_at: Date.now() / 1000 + Number(params.get("expires_in") || 3600), user });
  history.replaceState(null, "", location.pathname + location.search);
  return params.get("type") === "recovery";
}
export async function updatePassword(password: string) {
  if (!validPassword(password)) throw Error("Mật khẩu cần ít nhất 10 ký tự, có chữ và số.");
  await request("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password }) });
}
export async function readProfile(): Promise<Profile> {
  const rows = await request("/rest/v1/profiles?select=owner_name,shop_name,created_at");
  if (!rows?.[0]) throw Error("Chưa tìm thấy hồ sơ. Cần chạy migration Supabase trước.");
  return rows[0];
}
export async function updateProfile(name: string) {
  if (!validName(name)) throw Error("Tên cần 2–30 ký tự phù hợp.");
  if (!session) throw Error("Bạn chưa đăng nhập.");
  await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`, { method: "PATCH", body: JSON.stringify({ owner_name: name.trim() }) });
  window.dispatchEvent(new Event("may-account-change"));
}
export async function cloudAction(action: Action | null, revision: number | null, requestId = crypto.randomUUID()): Promise<CloudSave> {
  await restoreSession();
  return request("/functions/v1/game", { method: "POST", body: JSON.stringify({ action, revision, requestId }) });
}
