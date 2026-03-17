import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { loadTelemetryJson } from "./helpers";

describe("GET /laps", () => {
  test("returns only completed laps (1-3) and sector summaries", async () => {
    const app = createApp();
    const telemetry = await loadTelemetryJson();

    const ingest = await app.request("/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
    });
    expect(ingest.status).toBe(200);

    const res = await app.request("/laps");
    expect(res.status).toBe(200);
    const laps = await res.json();

    expect(Array.isArray(laps)).toBe(true);
    expect(laps.length).toBe(3);
    expect(laps.map((l: any) => l.lapNumber)).toEqual([1, 2, 3]);

    for (const lap of laps) {
      expect(lap).toHaveProperty("lapTime");
      expect(lap).toHaveProperty("sectors");
      expect(lap.sectors.length).toBe(3);
      expect(lap.sectors.map((s: any) => s.sector)).toEqual([1, 2, 3]);
    }
  });
});

