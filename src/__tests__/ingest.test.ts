import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { loadTelemetryJson } from "./helpers";

describe("POST /ingest", () => {
  test("rejects invalid payload with safeParse", async () => {
    const app = createApp();
    const res = await app.request("/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("accepts telemetry.json and returns counts", async () => {
    const app = createApp();
    const telemetry = await loadTelemetryJson();

    const res = await app.request("/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ laps: 3 });

    // Stationary frames at the end should be filtered out, so frames < input length.
    expect(typeof json.frames).toBe("number");
    expect(json.frames).toBeGreaterThan(0);
    if (Array.isArray(telemetry)) {
      expect(json.frames).toBeLessThan(telemetry.length);
    }
  });
});

