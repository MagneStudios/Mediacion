import { assertEquals } from "@std/assert";
import { handleHealthRequest } from "./index.ts";

Deno.test("responds with HTTP 200 and status ok", async () => {
  const response = handleHealthRequest();
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body, { status: "ok" });
});
