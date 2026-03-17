import type { Context } from "hono";
import { TelemetryArraySchema } from "../schemas/telemetry";
import { IngestResponse, IngestResponseSchema } from "../schemas/api";
import { filterStationaryFrames } from "../utils/telemetry";
import { countLaps } from "../services/lapService";
import type { TelemetryStore } from "../services/telemetryStore";
import type { TrackLayout } from "../config/tracks";

export async function ingestController(
  c: Context,
  store: TelemetryStore,
  layout: TrackLayout,
) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Validate the telemetry payload.
  const parsed = TelemetryArraySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid telemetry payload", details: parsed.error.message },
      400,
    );
  }

  // Filter out stationary frames.
  const frames = filterStationaryFrames(parsed.data);
  store.setFrames(frames);

  // Count the laps.
  const laps = countLaps(frames);

  const response: IngestResponse = { laps: laps, frames: frames.length };

  // Validate the response.
  const validated = IngestResponseSchema.safeParse(response);
  if (!validated.success) {
    return c.json({ error: "Internal response validation failed" }, 500);
  }

  return c.json(response);
}

