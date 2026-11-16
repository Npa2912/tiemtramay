// Deno/Supabase Edge runtime. The shared reducer is bundled from the application
// source by scripts documented in docs/ACCOUNTS.md; no client snapshot is accepted.
import { initial, reduce, validate } from "../_shared/engine.js";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigin = Deno.env.get("APP_ORIGIN") || "http://localhost:5173";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", Vary: "Origin" };
const types = new Set(["buy", "upgrade", "decor", "open", "close", "next", "cup", "pour", "top", "flavor", "sugar", "ice", "seal", "serve", "trash", "tick", "pause", "sound", "tutorial", "credit", "selectOrder", "eventChoice", "claimQuest", "hire", "train", "staffAssign", "security", "ownerName", "reducedMotion", "repairMachine", "recoverTheft", "dismissIncident"]);
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
async function admin(path: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...init.headers } });
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return respond(null);
  if (request.method !== "POST") return respond({ error: "method" }, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return respond({ error: "origin" }, 403);
  const authorization = request.headers.get("authorization") || "";
  const identity = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
  if (!identity.ok) return respond({ error: "session" }, 401);
  const user = await identity.json();
  try {
    const raw = await request.text();
    if (raw.length > 2048) return respond({ error: "size" }, 413);
    const { action, revision, requestId } = JSON.parse(raw);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return respond({ error: "request_id" }, 400);
    if (action !== null && (!action || !types.has(action.type))) return respond({ error: "action" }, 400);
    const currentResponse = await admin(`game_saves?user_id=eq.${encodeURIComponent(user.id)}&select=state,revision,updated_at`);
    if (!currentResponse.ok) return respond({ error: "database" }, 503);
    const [current] = await currentResponse.json();
    if (current && action === null) return respond({ state: current.state, revision: current.revision });
    if (current) {
      const replay = await admin(`game_requests?user_id=eq.${encodeURIComponent(user.id)}&request_id=eq.${requestId}&select=revision`);
      if (!replay.ok) return respond({ error: "database" }, 503);
      if ((await replay.json()).length) return respond({ state: current.state, revision: current.revision });
    }
    if (current && revision !== current.revision) return respond({ error: "revision_conflict" }, 409);
    let state = current?.state || initial(crypto.getRandomValues(new Uint32Array(1))[0]);
    if (!current) {
      state.money = 1000000; // Granted once, on creation only.
      const profileResponse = await admin(`profiles?id=eq.${encodeURIComponent(user.id)}&select=owner_name`);
      if (!profileResponse.ok) return respond({ error: "profile" }, 503);
      const [profile] = await profileResponse.json();
      if (profile?.owner_name) state = reduce(state, { type: "ownerName", name: profile.owner_name });
    }
    if (current && action) {
      // Reject arbitrary dt supplied by the browser. Accumulate at most real elapsed
      // time since the previous committed command, bounded to avoid offline leaps.
      const elapsed = Math.max(0, Math.min(1, (Date.now() - Date.parse(current.updated_at)) / 1000));
      const safeAction = { ...action };
      if (action.type === "pour" || action.type === "tick") safeAction.dt = elapsed;
      if (action.type !== "tick") state = reduce(state, { type: "tick", dt: elapsed });
      state = reduce(state, safeAction);
    }
    if (!validate(state)) return respond({ error: "state" }, 400);
    const committed = await admin("rpc/commit_may_action", { method: "POST", body: JSON.stringify({ p_user: user.id, p_request: requestId, p_expected: current?.revision ?? null, p_state: state }) });
    if (!committed.ok) {
      const error = await committed.json();
      return respond({ error: error.code === "40001" ? "revision_conflict" : "commit_failed" }, error.code === "40001" ? 409 : 503);
    }
    return respond(await committed.json());
  } catch { return respond({ error: "invalid_request" }, 400); }
});
