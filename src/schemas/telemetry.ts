import { z } from "zod";

export const TyresSchema = z.object({
  fl: z.number(),
  fr: z.number(),
  rl: z.number(),
  rr: z.number(),
});

export const TelemetryFrameSchema = z.object({
  ts: z.number(),
  lap: z.number().int(),
  pos: z.number().min(0).max(1),
  spd: z.number().min(0),
  thr: z.number().min(0).max(1),
  brk: z.number().min(0).max(1),
  str: z.number().min(-1).max(1),
  gear: z.number().int(),
  rpm: z.number().min(0),
  tyres: TyresSchema,
});

export const TelemetryArraySchema = z.array(TelemetryFrameSchema);

export type Tyres = z.infer<typeof TyresSchema>;
export type TelemetryFrame = z.infer<typeof TelemetryFrameSchema>;
