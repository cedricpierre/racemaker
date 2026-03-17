import { z } from "zod";
import spaJson from "./tracks/spa.json" assert { type: "json" };

export const SectorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  startPos: z.number().min(0).max(1),
  endPos: z.number().min(0).max(1),
});

export const TrackLayoutSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  sectors: z.array(SectorConfigSchema).min(1),
});

export type SectorConfig = z.infer<typeof SectorConfigSchema>;
export type TrackLayout = z.infer<typeof TrackLayoutSchema>;

export const spaLayout: TrackLayout = TrackLayoutSchema.parse(spaJson);

const layouts: Record<string, TrackLayout> = {
  [spaLayout.id.toLowerCase()]: spaLayout,
};

export function getTrackLayout(trackId: string | undefined): TrackLayout {
  if (!trackId) return spaLayout;
  const key = trackId.toLowerCase();
  return layouts[key] ?? spaLayout;
}

