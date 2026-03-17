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
  frames: number;
};

export function buildAnalysis(
  allFrames: TelemetryFrame[],
  laps: LapSummary[],
  layout: TrackLayout,
): AnalysisResult | null {
  if (laps.length < 2) return null;

  console.log(laps)
  const best = laps.reduce((a, b) => (b.lapTime < a.lapTime ? b : a));
  const worst = laps.reduce((a, b) => (b.lapTime > a.lapTime ? b : a));

  const delta = Math.max(0, worst.lapTime - best.lapTime);

  const worstSector = worstSectorVsBest(layout, best, worst);
  const worstLapFrames = framesForLap(allFrames, worst.lapNumber);
  const sectorFrames = framesInSector(worstLapFrames, worstSector, layout);

  const feats = computeSectorFeatures(sectorFrames);
  const scored = scoreIssues(feats);
  const chosen = scored.reduce((a, b) => (b.score > a.score ? b : a));

  const coachingMessage = buildCoachingMessage(worstSector, chosen, delta);

  return {
    bestLap: { lapNumber: best.lapNumber, lapTime: best.lapTime },
    worstLap: { lapNumber: worst.lapNumber, lapTime: worst.lapTime, delta },
    problemSector: worstSector,
    issue: chosen.issue,
    coachingMessage,
  };
}

function worstSectorVsBest(layout: TrackLayout, best: LapSummary, worst: LapSummary): SectorConfig {
  let bestSector: SectorConfig = layout.sectors[0]!;
  let bestDelta = -Infinity;

  for (const s of layout.sectors) {
    const bt = best.sectors.find((x) => x.sector.id === s.id)!.time;
    const wt = worst.sectors.find((x) => x.sector.id === s.id)!.time;
    const d = wt - bt;
    if (d > bestDelta) {
      bestDelta = d;
      bestSector = s;
    }
  }
  return bestSector;
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

  let heavyBrakeHighSpeedCount = 0;
  let heavyBrakeHighSpeedTime = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const isHeavy = f.brk > 0.8 && f.spd > 200;
    if (isHeavy) heavyBrakeHighSpeedCount++;
    if (isHeavy && i > 0) {
      heavyBrakeHighSpeedTime += Math.max(0, f.ts - frames[i - 1]!.ts);
    }
  }

  return {
    avgThr,
    maxTyreTemp,
    speedStdDev,
    heavyBrakeHighSpeedCount,
    heavyBrakeHighSpeedTime,
    frames: frames.length,
  };
}

function scoreIssues(f: SectorFeatures): ScoredIssue[] {
  const tyreOver = scoreTyreOverheat(f);
  const heavyBrk = scoreHeavyBraking(f);
  const lowThr = scoreLowThrottle(f);
  const incons = scoreInconsistency(f);
  return [tyreOver, heavyBrk, lowThr, incons];
}

function scoreTyreOverheat(f: SectorFeatures): ScoredIssue {
  const over = Math.max(0, f.maxTyreTemp - 110);
  return {
    issue: "tyre_overheat",
    score: over * 10,
    evidence:
      over > 0
        ? [{ label: "maxTyreTemp", value: `${f.maxTyreTemp.toFixed(0)}°C` }]
        : [{ label: "maxTyreTemp", value: `${f.maxTyreTemp.toFixed(0)}°C` }],
  };
}

function scoreHeavyBraking(f: SectorFeatures): ScoredIssue {
  const base = f.heavyBrakeHighSpeedCount > 0 ? 1 : 0;
  const score = base * 80 + f.heavyBrakeHighSpeedTime * 40;
  return {
    issue: "heavy_braking",
    score,
    evidence: [
      {
        label: "heavyBrake@>200",
        value: `${f.heavyBrakeHighSpeedCount} frames`,
      },
    ],
  };
}

function scoreLowThrottle(f: SectorFeatures): ScoredIssue {
  const deficit = Math.max(0, 0.6 - f.avgThr);
  return {
    issue: "low_throttle",
    score: deficit * 100,
    evidence: [{ label: "avgThrottle", value: f.avgThr.toFixed(2) }],
  };
}

function scoreInconsistency(f: SectorFeatures): ScoredIssue {
  const excess = Math.max(0, f.speedStdDev - 40);
  return {
    issue: "inconsistency",
    score: excess * 5,
    evidence: [{ label: "speedStdDev", value: f.speedStdDev.toFixed(1) }],
  };
}

function buildCoachingMessage(sector: TrackLayout["sectors"][number], chosen: ScoredIssue, delta: number): string {
  const s = `Sector ${sector.name}`;
  const loss = delta > 0 ? ` You're down ${delta.toFixed(2)}s.` : "";

  const topEvidence = chosen.evidence
    .slice(0, 2)
    .map((e) => `${e.label}=${e.value}`)
    .join(", ");

  switch (chosen.issue) {
    case "tyre_overheat":
      return `${s} is killing your lap.${loss} Tyres are cooking. ${topEvidence}. Back the entry off. Smooth the wheel.`;
    case "heavy_braking":
      return `${s} is where you're losing it.${loss} You're on big brake too late. ${topEvidence}. Brake earlier. Release cleaner.`;
    case "low_throttle":
      return `${s} is soft.${loss} Throttle trace is low. ${topEvidence}. Commit earlier. No coasting.`;
    case "inconsistency":
      return `${s} is messy.${loss} Speed is all over the place. ${topEvidence}. Pick a marker. Repeat the inputs.`;
  }
}

