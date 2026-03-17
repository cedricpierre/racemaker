import type { Context } from "hono";
import { buildLapSummaries } from "../services/lapService";
import type { TelemetryStore } from "../services/telemetryStore";
import type { TrackLayout } from "../config/tracks";

export function lapsController(
  c: Context,
  store: TelemetryStore,
  layout: TrackLayout,
) {
  const frames = store.getFrames();
  const laps = buildLapSummaries(frames, layout);
  return c.json(laps);
}

