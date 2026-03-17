import type { AnalysisIssue, AnalysisResult, LapSummary } from "../schemas/api";
import type { TelemetryFrame } from "../schemas/telemetry";
import type { SectorConfig, TrackLayout } from "../config/tracks";
import { framesInSector } from "./lapService";
import { max, mean, stddev } from "../utils/stats";

type Evidence = {
  label: string;
  value: string;
};

type ScoredIssue = {
  issue: AnalysisIssue;
  score: number;
  evidence: Evidence[];
};

type SectorFeatures = {
  avgThr: number;
  maxTyreTemp: number;
  speedStdDev: number;
  heavyBrakeHighSpeedCount: number;
  heavyBrakeHighSpeedTime: number;
  coastTime: number;
  avgBrake: number;
  maxBrake: number;
  avgSteerAbs: number;
  entrySpeed: number;
  minSpeed: number;
  frames: number;
};

export function buildAnalysis(
  allFrames: TelemetryFrame[],
  laps: LapSummary[],
  layout: TrackLayout,
): AnalysisResult | null {
  if (laps.length < 2) return null;

  const best = laps.reduce((a, b) => (b.lapTime < a.lapTime ? b : a));
  const worst = laps.reduce((a, b) => (b.lapTime > a.lapTime ? b : a));

  const delta = Math.max(0, worst.lapTime - best.lapTime);

  const sectorDeltas = computeSectorDeltas(layout, best, worst);
  const [, worstSector] = worstSectorVsBest(layout, best, worst);
  const worstLapFrames = framesForLap(allFrames, worst.lapNumber);
  const bestLapFrames = framesForLap(allFrames, best.lapNumber);
  const worstSectorFrames = framesInSector(worstLapFrames, worstSector, layout);
  const bestSectorFrames = framesInSector(bestLapFrames, worstSector, layout);

  const worstFeats = computeSectorFeatures(worstSectorFrames);
  const bestFeats = computeSectorFeatures(bestSectorFrames);
  const scored = scoreIssues(worstFeats, bestFeats);
  const chosen = scored.reduce((a, b) => (b.score > a.score ? b : a));

  const sectorDelta = sectorDeltas.find((s) => s.sector.id === worstSector.id);
  const coachingMessage = buildCoachingMessage(worstSector, chosen, delta, sectorDelta);

  return {
    bestLap: { lapNumber: best.lapNumber, lapTime: best.lapTime },
    worstLap: { lapNumber: worst.lapNumber, lapTime: worst.lapTime, delta },
    sectorDeltas,
    problemSector: worstSector,
    issue: chosen.issue,
    coachingMessage,
  };
}

function computeSectorDeltas(
  layout: TrackLayout,
  best: LapSummary,
  worst: LapSummary,
): { sector: SectorConfig; bestTime: number; worstTime: number; delta: number }[] {
  return layout.sectors.flatMap((s) => {
    const bt = best.sectors.find((x) => x.sector.id === s.id)?.time;
    const wt = worst.sectors.find((x) => x.sector.id === s.id)?.time;
    if (bt == null || wt == null) return [];
    return [{ sector: s, bestTime: bt, worstTime: wt, delta: wt - bt }];
  });
}

function worstSectorVsBest(
  layout: TrackLayout,
  best: LapSummary,
  worst: LapSummary,
): [best: SectorConfig, worst: SectorConfig] {
  let bestSector: SectorConfig = layout.sectors[0]!;
  let worstSector: SectorConfig = layout.sectors[0]!;
  let bestDelta = Infinity;
  let worstDelta = -Infinity;

  for (const s of layout.sectors) {
    const bt = best.sectors.find((x) => x.sector.id === s.id)?.time;
    const wt = worst.sectors.find((x) => x.sector.id === s.id)?.time;
    if (bt == null || wt == null) continue;

    const d = wt - bt;
    if (d < bestDelta) {
      bestDelta = d;
      bestSector = s;
    }
    if (d > worstDelta) {
      worstDelta = d;
      worstSector = s;
    }
  }

  return [bestSector, worstSector];
}

function framesForLap(frames: TelemetryFrame[], lapNumber: number): TelemetryFrame[] {
  return frames.filter((f) => f.lap === lapNumber).sort((a, b) => a.ts - b.ts);
}

function computeSectorFeatures(frames: TelemetryFrame[]): SectorFeatures {
  const avgThr = mean(frames.map((f) => f.thr));
  const maxTyreTemp = max(
    frames.flatMap((f) => [f.tyres.fl, f.tyres.fr, f.tyres.rl, f.tyres.rr]),
  );
  const speedStdDev = stddev(frames.map((f) => f.spd));
  const avgBrake = mean(frames.map((f) => f.brk));
  const maxBrake = max(frames.map((f) => f.brk));
  const avgSteerAbs = mean(frames.map((f) => Math.abs(f.str)));

  const entryWindow = Math.max(1, Math.floor(frames.length * 0.1));
  const entrySpeed = mean(frames.slice(0, entryWindow).map((f) => f.spd));
  const minSpeed = Math.min(...frames.map((f) => f.spd));

  let heavyBrakeHighSpeedCount = 0;
  let heavyBrakeHighSpeedTime = 0;
  let coastTime = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const isHeavy = f.brk > 0.8 && f.spd > 200;
    if (isHeavy) heavyBrakeHighSpeedCount++;
    if (isHeavy && i > 0) {
      heavyBrakeHighSpeedTime += Math.max(0, f.ts - frames[i - 1]!.ts);
    }

    const isCoast = f.thr < 0.05 && f.brk < 0.05;
    if (isCoast && i > 0) {
      coastTime += Math.max(0, f.ts - frames[i - 1]!.ts);
    }
  }

  return {
    avgThr,
    maxTyreTemp,
    speedStdDev,
    heavyBrakeHighSpeedCount,
    heavyBrakeHighSpeedTime,
    coastTime,
    avgBrake,
    maxBrake,
    avgSteerAbs,
    entrySpeed,
    minSpeed,
    frames: frames.length,
  };
}

function scoreIssues(worst: SectorFeatures, best: SectorFeatures): ScoredIssue[] {
  const tyreOver = scoreTyreOverheat(worst, best);
  const heavyBrk = scoreHeavyBraking(worst, best);
  const lowThr = scoreLowThrottle(worst, best);
  const incons = scoreInconsistency(worst, best);
  return [tyreOver, heavyBrk, lowThr, incons];
}

function scoreTyreOverheat(worst: SectorFeatures, best: SectorFeatures): ScoredIssue {
  const over = Math.max(0, worst.maxTyreTemp - 110);
  const vsBest = worst.maxTyreTemp - best.maxTyreTemp;
  return {
    issue: "tyre_overheat",
    score: over * 10,
    evidence: [
      { label: "maxTyreTemp", value: `${worst.maxTyreTemp.toFixed(0)}°C` },
      { label: "vsBest", value: `${vsBest >= 0 ? "+" : ""}${vsBest.toFixed(0)}°C` },
      { label: "avgSteerAbs", value: worst.avgSteerAbs.toFixed(2) },
    ],
  };
}

function scoreHeavyBraking(worst: SectorFeatures, best: SectorFeatures): ScoredIssue {
  const base = worst.heavyBrakeHighSpeedCount > 0 ? 1 : 0;
  const score = base * 80 + worst.heavyBrakeHighSpeedTime * 40;
  const entryDelta = worst.entrySpeed - best.entrySpeed;
  return {
    issue: "heavy_braking",
    score,
    evidence: [
      {
        label: "heavyBrake@>200",
        value: `${worst.heavyBrakeHighSpeedCount} frames`,
      },
      {
        label: "heavyBrakeTime",
        value: `${worst.heavyBrakeHighSpeedTime.toFixed(2)}s`,
      },
      {
        label: "entrySpeedVsBest",
        value: `${entryDelta >= 0 ? "+" : ""}${entryDelta.toFixed(1)} km/h`,
      },
    ],
  };
}

function scoreLowThrottle(worst: SectorFeatures, best: SectorFeatures): ScoredIssue {
  const deficit = Math.max(0, 0.6 - worst.avgThr);
  const thrDelta = worst.avgThr - best.avgThr;
  const coastDelta = worst.coastTime - best.coastTime;
  return {
    issue: "low_throttle",
    score: deficit * 100,
    evidence: [
      { label: "avgThrottle", value: worst.avgThr.toFixed(2) },
      { label: "avgThrottleVsBest", value: `${thrDelta >= 0 ? "+" : ""}${thrDelta.toFixed(2)}` },
      { label: "coastTimeVsBest", value: `${coastDelta >= 0 ? "+" : ""}${coastDelta.toFixed(2)}s` },
    ],
  };
}

function scoreInconsistency(worst: SectorFeatures, best: SectorFeatures): ScoredIssue {
  const excess = Math.max(0, worst.speedStdDev - 40);
  const stdDelta = worst.speedStdDev - best.speedStdDev;
  return {
    issue: "inconsistency",
    score: excess * 5,
    evidence: [
      { label: "speedStdDev", value: worst.speedStdDev.toFixed(1) },
      { label: "speedStdDevVsBest", value: `${stdDelta >= 0 ? "+" : ""}${stdDelta.toFixed(1)}` },
      { label: "minSpeed", value: `${worst.minSpeed.toFixed(1)} km/h` },
    ],
  };
}

function buildCoachingMessage(
  sector: TrackLayout["sectors"][number],
  chosen: ScoredIssue,
  delta: number,
  sectorDelta?: { bestTime: number; worstTime: number; delta: number },
): string {
  const s = `Sector ${sector.id}`;
  const loss = delta > 0 ? ` You're down ${delta.toFixed(2)}s.` : "";
  const sectorLoss =
    sectorDelta && Number.isFinite(sectorDelta.delta)
      ? ` Sector delta: ${sectorDelta.delta >= 0 ? "+" : ""}${sectorDelta.delta.toFixed(2)}s (best ${sectorDelta.bestTime.toFixed(2)}s vs worst ${sectorDelta.worstTime.toFixed(2)}s).`
      : "";

  const topEvidence = chosen.evidence
    .slice(0, 2)
    .map((e) => `${e.label} is ${e.value}`)
    .join(", ");

  switch (chosen.issue) {
    case "tyre_overheat":
      return `${s} is killing your lap.${loss}${sectorLoss} Tyres are cooking. ${topEvidence}. Likely too much slip mid-corner. Back the entry off and reduce steering spikes.`;
    case "heavy_braking":
      return `${s} is where you're losing it.${loss}${sectorLoss} Late/heavy braking on entry. ${topEvidence}. Move braking earlier, then trail off smoothly to avoid ABS/lock and carry min speed.`;
    case "low_throttle":
      return `${s} is soft.${loss}${sectorLoss} You're giving up time on throttle. ${topEvidence}. Reduce coasting: either commit earlier on entry or get back to throttle earlier after apex.`;
    case "inconsistency":
      return `${s} is messy.${loss}${sectorLoss} Your speed profile varies a lot. ${topEvidence}. Use one brake marker + one turn-in marker and aim for the same min speed each lap.`;
  }
}

