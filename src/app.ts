import { Hono } from "hono";
import { TelemetryStore } from "./services/telemetryStore";
import { ingestController } from "./controllers/ingestController";
import { lapsController } from "./controllers/lapsController";
import { analysisController } from "./controllers/analysisController";
import { getTrackLayout } from "./config/tracks";

export function createApp() {
  const trackId = (Bun.env.TRACK_ID ?? "spa").toLowerCase();

  console.log(`Using track layout: ${trackId}`);

  const app = new Hono();
  const store = new TelemetryStore();
  const layout = getTrackLayout(trackId);

  app.post("/ingest", (c) => ingestController(c, store, layout));
  app.get("/laps", (c) => lapsController(c, store, layout));
  app.get("/analysis", (c) => analysisController(c, store, layout));

  return app;
}

