import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

Deno.serve(() =>
  jsonResponse(410, {
    ok: false,
    code: "MIGRATION_ENDPOINT_RETIRED",
  })
);
