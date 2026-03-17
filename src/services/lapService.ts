import type { LapSummary, SectorSummary } from "../schemas/api";
import type { TelemetryFrame } from "../schemas/telemetry";
import type { SectorConfig, TrackLayout } from "../config/tracks";
import { max, mean } from "../utils/stats";

type LapFrames = {
  lapNumber: number;
  frames: TelemetryFrame[];
};

const OUTLAP_START_POS_THRESHOLD = 0.05;
const LAP_MIN_START_POS = 0.02;
const LAP_MIN_END_POS = 0.98;

export function buildLapSummaries(
  allFrames: TelemetryFrame[],
  layout: TrackLayout,
): LapSummary[] {
  const laps = extractLapFrames(allFrames);
  const completed = filterCompletedLaps(laps);
  return completed.map((lap) => summarizeLap(lap.lapNumber, lap.frames, layout));
}

export function countLaps(frames: TelemetryFrame[]): number {
  const laps = extractLapFrames(frames);
  const completed = filterCompletedLaps(laps);
  return completed.length;
}

export function extractLapFrames(allFrames: TelemetryFrame[]): LapFrames[] {
  const byLap = new Map<number, TelemetryFrame[]>();
  for (const f of allFrames) {
    const arr = byLap.get(f.lap);
    if (arr) arr.push(f);
    else byLap.set(f.lap, [f]);
  }

  const lapNumbers = [...byLap.keys()].sort((a, b) => a - b);
  return lapNumbers.map((lapNumber) => {
    const frames = (byLap.get(lapNumber) ?? []).slice().sort((a, b) => a.ts - b.ts);
    return { lapNumber, frames };
  });
}

export function filterCompletedLaps(laps: LapFrames[]): LapFrames[] {
  if (laps.length === 0) return [];

  // Exclude out-lap: first lap starts mid-track (pos significantly > 0).
  const first = laps[0];
  const firstPos = first.frames[0]?.pos ?? 0;
  const withoutOutlap =
    firstPos > OUTLAP_START_POS_THRESHOLD ? laps.slice(1) : laps.slice();

  // Exclude incomplete laps: must include both a near-start and near-end position.
  return withoutOutlap.filter((lap) => {
    if (lap.frames.length < 2) return false;
    const minPos = lap.frames.reduce((m, f) => Math.min(m, f.pos), Infinity);
    const maxPos = lap.frames.reduce((m, f) => Math.max(m, f.pos), -Infinity);
    return minPos <= LAP_MIN_START_POS && maxPos >= LAP_MIN_END_POS;
  });
}

function summarizeLap(
  lapNumber: number,
  frames: TelemetryFrame[],
  layout: TrackLayout,
): LapSummary {
  const t0 = frames[0]!.ts;
  const tEnd = frames[frames.length - 1]!.ts;

  const sectors: SectorSummary[] = layout.sectors.map((s, idx, arr) => {
    const tStart =
      idx === 0
        ? t0
        : findBoundaryCrossingTs(frames, s.startPos) ?? t0;
    const tStop =
      idx === arr.length - 1
        ? tEnd
        : findBoundaryCrossingTs(frames, s.endPos) ?? tEnd;
    return {
      sector: s,
      time: Math.max(0, tStop - tStart),
    };
  });

  const lapTime = Math.max(0, tEnd - t0);

  const speeds = frames.map((f) => f.spd);
  const avgSpeed = mean(speeds);
  const maxSpeed = max(speeds);

  return {
    lapNumber,
    lapTime,
    sectors,
    avgSpeed,
    maxSpeed,
  };
}

function findBoundaryCrossingTs(frames: TelemetryFrame[], boundary: number): number | null {
  // Assumes frames are time-sorted and pos mostly increases within a lap.
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]!;
    const b = frames[i]!;

    if (a.pos === b.pos) continue;
    if (a.pos < boundary && b.pos >= boundary) {
      const t = (boundary - a.pos) / (b.pos - a.pos);
      return a.ts + t * (b.ts - a.ts);
    }
  }
  return null;
}

export function sectorForPos(pos: number, layout: TrackLayout): number {
  const sector =
    layout.sectors.find((s) => pos >= s.startPos && pos < s.endPos) ??
    layout.sectors[layout.sectors.length - 1];
  return sector.id;
}

export function framesInSector(
  frames: TelemetryFrame[],
  sector: SectorConfig,
  layout: TrackLayout,
): TelemetryFrame[] {
  return frames.filter((f) => sectorForPos(f.pos, layout) === sector.id);
}

