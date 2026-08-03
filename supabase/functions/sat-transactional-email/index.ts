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

const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isEmail = (value: string): boolean =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !publishableKey) return jsonResponse(503, { ok: false, code: "BACKEND_NOT_CONFIGURED" });

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, code: "INVALID_JSON" });
  }

  const to = String(body.to ?? "").trim().toLowerCase();
  const subject = String(body.subject ?? "").trim();
  const html = typeof body.html === "string" ? body.html : "";
  const plainText = typeof body.text === "string" ? body.text : "";
  const messageKind = String(body.kind ?? "transactional").trim().toLowerCase();
  if (!isEmail(to) || !subject || subject.length > 200 || (!html && !plainText)
      || html.length > 100_000 || plainText.length > 50_000
      || !/^[a-z][a-z0-9_-]{0,39}$/.test(messageKind)) {
    return jsonResponse(400, { ok: false, code: "INVALID_EMAIL_PAYLOAD" });
  }

  const requestId = crypto.randomUUID();
  const recipientDigest = await digest(to);
  const { data: allowed, error: authorizationError } = await client.rpc("sat_begin_email_dispatch", {
    target_request_id: requestId,
    target_recipient_digest: recipientDigest,
    target_message_kind: messageKind,
  });
  if (authorizationError || allowed !== true) {
    return jsonResponse(403, { ok: false, code: "EMAIL_NOT_AUTHORIZED" });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const senderEmail = Deno.env.get("SAT_EMAIL_SENDER") ?? "";
  const senderName = Deno.env.get("SAT_EMAIL_SENDER_NAME") ?? "SAT Mobile";
  if ((!resendApiKey && !brevoApiKey) || !isEmail(senderEmail)) {
    await client.rpc("sat_finish_email_dispatch", { target_request_id: requestId, target_status: "failed" });
    return jsonResponse(503, { ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
  }

  try {
    const providerResponse = resendApiKey
      ? await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [to],
          subject,
          ...(html ? { html } : {}),
          ...(plainText ? { text: plainText } : {}),
        }),
      })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoApiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          ...(html ? { htmlContent: html } : {}),
          ...(plainText ? { textContent: plainText } : {}),
        }),
      });
    await client.rpc("sat_finish_email_dispatch", {
      target_request_id: requestId,
      target_status: providerResponse.ok ? "sent" : "failed",
    });
    if (!providerResponse.ok) return jsonResponse(502, { ok: false, code: "EMAIL_PROVIDER_REJECTED" });
    return jsonResponse(200, { ok: true, requestId });
  } catch {
    await client.rpc("sat_finish_email_dispatch", { target_request_id: requestId, target_status: "failed" });
    return jsonResponse(502, { ok: false, code: "EMAIL_PROVIDER_UNAVAILABLE" });
  }
});
