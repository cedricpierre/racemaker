import { z } from "zod";
import { SectorConfigSchema, TrackLayoutSchema } from "../config/tracks";

export const IngestResponseSchema = z.object({
  laps: z.number().int().min(0),
  frames: z.number().int().min(0),
});
export type IngestResponse = z.infer<typeof IngestResponseSchema>;

export const SectorSummarySchema = z.object({
  sector: SectorConfigSchema,
  time: z.number().min(0),
});
export type SectorSummary = z.infer<typeof SectorSummarySchema>;

export const LapSummarySchema = z.object({
  lapNumber: z.number().int(),
  lapTime: z.number().min(0),
  sectors: z.array(SectorSummarySchema).min(1),
  avgSpeed: z.number().min(0),
  maxSpeed: z.number().min(0),
});
export type LapSummary = z.infer<typeof LapSummarySchema>;

export const AnalysisIssueSchema = z.union([
  z.literal("heavy_braking"),
  z.literal("low_throttle"),
  z.literal("tyre_overheat"),
  z.literal("inconsistency"),
]);
export type AnalysisIssue = z.infer<typeof AnalysisIssueSchema>;

export const AnalysisResultSchema = z.object({
  bestLap: z.object({
    lapNumber: z.number().int(),
    lapTime: z.number().min(0),
  }),
  worstLap: z.object({
    lapNumber: z.number().int(),
    lapTime: z.number().min(0),
    delta: z.number().min(0),
  }),
  problemSector: SectorConfigSchema,
  issue: AnalysisIssueSchema,
  coachingMessage: z.string().min(1),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

