import type { TelemetryFrame } from "../schemas/telemetry";

export class TelemetryStore {
  #frames: TelemetryFrame[] = [];

  setFrames(frames: TelemetryFrame[]) {
    // Defensively copy so callers can’t mutate internal state.
    this.#frames = frames.slice();
  }

  getFrames() {
    return this.#frames.slice();
  }

  clear() {
    this.#frames = [];
  }
}

