export function handleHealthRequest(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

if (import.meta.main) {
  Deno.serve(handleHealthRequest);
}
