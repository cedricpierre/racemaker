import type { Context } from "hono";
import { buildLapSummaries } from "../services/lapService";
import { buildAnalysis } from "../services/analysisService";
import type { TelemetryStore } from "../services/telemetryStore";
import type { TrackLayout } from "../config/tracks";

export function analysisController(
  c: Context,
  store: TelemetryStore,
  layout: TrackLayout,
) {
  const frames = store.getFrames();
  const laps = buildLapSummaries(frames, layout);

  const analysis = buildAnalysis(frames, laps, layout);
  if (!analysis) {
    return c.json({ error: "Not enough completed laps to analyze" }, 400);
  }

  return c.json(analysis);
}

