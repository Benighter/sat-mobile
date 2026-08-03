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

const validPassword = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, code: "INVALID_JSON" });
  }
  if (!validPassword(body.password)) {
    return jsonResponse(400, { ok: false, code: "PASSWORD_POLICY" });
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

  const { data: enrollment, error: enrollmentError } = await callerClient.rpc(
    "sat_begin_native_auth_enrollment",
  );
  const firebaseUid = typeof enrollment?.firebaseUid === "string" ? enrollment.firebaseUid : "";
  const email = typeof enrollment?.email === "string" ? enrollment.email : "";
  const emailVerified = enrollment?.emailVerified === true;
  const sourceProviderIds = Array.isArray(enrollment?.sourceProviderIds)
    ? enrollment.sourceProviderIds.filter((value: unknown) => typeof value === "string")
    : [];
  if (enrollmentError || !firebaseUid || !email) {
    return jsonResponse(403, { ok: false, code: "ENROLLMENT_NOT_AUTHORIZED" });
  }

  const { data: linkedUserId, error: linkedError } = await adminClient.rpc(
    "sat_get_native_auth_link",
    { target_firebase_uid: firebaseUid },
  );
  if (linkedError) return jsonResponse(502, { ok: false, code: "LINK_LOOKUP_FAILED" });

  let nativeUserId = typeof linkedUserId === "string" ? linkedUserId : "";
  let createdNow = false;

  if (!nativeUserId) {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: emailVerified,
      user_metadata: { migration_source: "firebase" },
    });
    if (!createError && created.user) {
      nativeUserId = created.user.id;
      createdNow = true;
    } else {
      // An interrupted earlier attempt can leave an unlinked Auth user. Find
      // only the exact normalized email in a bounded page and reconcile it.
      const { data: listed, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listed?.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (listError || !existing) {
        return jsonResponse(409, { ok: false, code: "NATIVE_ACCOUNT_CREATE_FAILED" });
      }
      nativeUserId = existing.id;
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(nativeUserId, {
        password: body.password,
        ...(emailVerified ? { email_confirm: true } : {}),
      });
      if (passwordError) return jsonResponse(502, { ok: false, code: "NATIVE_PASSWORD_UPDATE_FAILED" });
    }
  } else {
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(nativeUserId, {
      password: body.password,
      ...(emailVerified ? { email_confirm: true } : {}),
    });
    if (passwordError) return jsonResponse(502, { ok: false, code: "NATIVE_PASSWORD_UPDATE_FAILED" });
  }

  const { data: linked, error: linkError } = await adminClient.rpc("sat_complete_native_auth_link", {
    target_firebase_uid: firebaseUid,
    target_supabase_user_id: nativeUserId,
    target_source_provider_ids: sourceProviderIds,
  });
  if (linkError || linked !== true) {
    if (createdNow) {
      await adminClient.auth.admin.updateUserById(nativeUserId, { ban_duration: "876000h" });
    }
    return jsonResponse(502, { ok: false, code: "NATIVE_IDENTITY_LINK_FAILED" });
  }

  return jsonResponse(200, { ok: true, linked: true });
});
