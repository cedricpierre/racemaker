export async function loadTelemetryJson(): Promise<unknown> {
  const file = Bun.file(new URL("../../telemetry.json", import.meta.url));
  return await file.json();
}

