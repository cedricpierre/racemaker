import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { loadTelemetryJson } from "./helpers";

describe("GET /analysis", () => {
  test("detects lap 3 sector 2 tyre_overheat as primary issue", async () => {
    const app = createApp();
    const telemetry = await loadTelemetryJson();

    const ingest = await app.request("/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
    });
    expect(ingest.status).toBe(200);

    const res = await app.request("/analysis");
    expect(res.status).toBe(200);

    const analysis = await res.json();
    expect(analysis.bestLap).toHaveProperty("lapNumber");
    expect(analysis.worstLap).toHaveProperty("lapNumber");

    expect(analysis.worstLap.lapNumber).toBe(3);
    expect(analysis.problemSector).toBe(2);
    expect(analysis.issue).toBe("tyre_overheat");
    expect(typeof analysis.coachingMessage).toBe("string");
    expect(analysis.coachingMessage.length).toBeGreaterThan(10);
  });
});

