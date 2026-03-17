import type { TelemetryFrame } from "../schemas/telemetry";

/**
 * Skip pit-stop/stationary frames:
 * "Frames where speed < 5 and trackPosition doesn't change" => skip them.
 */
export function filterStationaryFrames(frames: TelemetryFrame[]): TelemetryFrame[] {
  const out: TelemetryFrame[] = [];
  let lastKeptPos: number | undefined;

  for (const f of frames) {
    const isStationary = f.spd < 5 && lastKeptPos !== undefined && f.pos === lastKeptPos;
    if (isStationary) continue;
    out.push(f);
    lastKeptPos = f.pos;
  }

  return out;
}

