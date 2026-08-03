import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "no-store" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, code: "INVALID_JSON" });
  }
  const targetUid = String(payload.uid ?? "").trim();
  const active = payload.active;
  if (!targetUid || targetUid.length > 128 || typeof active !== "boolean") {
    return jsonResponse(400, { ok: false, code: "INVALID_STATUS_PAYLOAD" });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !publishableKey || !serviceRoleKey) {
    return jsonResponse(503, { ok: false, code: "BACKEND_NOT_CONFIGURED" });
  }

  const callerClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: nativeUserId, error: resolveError } = await callerClient.rpc(
    "sat_resolve_admin_target_identity",
    { target_uid: targetUid },
  );
  if (resolveError || typeof nativeUserId !== "string") {
    return jsonResponse(403, { ok: false, code: "STATUS_CHANGE_NOT_AUTHORIZED" });
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(nativeUserId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (authError) return jsonResponse(502, { ok: false, code: "AUTH_STATUS_UPDATE_FAILED" });

  const { data: profileUpdated, error: profileError } = await callerClient.rpc("sat_apply_admin_user_status", {
    target_uid: targetUid,
    target_active: active,
  });
  if (profileError || profileUpdated !== true) {
    // Best-effort rollback keeps Auth and the SAT profile consistent.
    await adminClient.auth.admin.updateUserById(nativeUserId, {
      ban_duration: active ? "876000h" : "none",
    });
    return jsonResponse(502, { ok: false, code: "PROFILE_STATUS_UPDATE_FAILED" });
  }

  return jsonResponse(200, { ok: true });
});
