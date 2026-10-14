import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { APP_NAME, type HealthResponse } from "@open-assistant/shared";

const app = new Hono();

app.get("/health", (c) => c.json<HealthResponse>({ status: "ok", name: APP_NAME }));

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
