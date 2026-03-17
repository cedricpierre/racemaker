Improvements (racemake.com oriented)

Goal: make telemetry analysis simple, visual, actionable, shareable.

- API / Architecture
  - Monorepo: API + shared types + frontend
  - Stream processed analysis in real time (Server-Sent Events)
    - Progress events: ingest, lap detection, sector extraction, analysis ready
  - Bun runtime is a good fit for fast iteration

- Data quality & robustness
  - Data quality scoring (timestamp monotonicity, gaps, missing channels, pos regressions)
  - Session metadata: sim/game, track id, car id, units, sampling rate


- Analytics depth (no ML required initially)
  - Corner-level segmentation (entry / apex / exit) in addition to sectors
  - Driver inputs & technique features:
    - throttle pickup time, trail braking, brake release rate
    - steering rate, steering smoothness
    - coast time by zone, time-on-throttle, time-on-brake
    - apex min speed + delta to benchmark, entry speed delta
  - Consistency views:
    - lap-to-lap dispersion, “best potential lap” (best of each sector/segment)
    - trend analysis (improving/declining over session/week)

- Social & teams
  - Lap sharing (public/private link), “replay” view for traces
  - Compare with friends/teammates (same track/car filters)
  - Team reports:
    - weekly summary, focus areas per driver, progress tracking

- More data channels (vehicle / track / conditions)
  - Vehicle
    - TC, ABS
    - wheel spin / slip ratio, wheel speeds
    - wheel angle, steering torque
    - gyro / yaw rate / accel
    - aero settings, drag, downforce
    - tyre pressures + temps (core/surface) + wear
    - fuel load / ERS / brake bias
    - opponent distances / traffic context
  - Track
    - grip %, asphalt type, bumps/curbs map, rebuilt parts
  - Conditions
    - ambient temp, track temp, humidity, wind, rain level

- AI coaching (progressive)
  - Start: rule-based + evidence-backed suggestions (explainable)
  - Next: retrieval over user history + “what worked before”
  - Later: custom model fine-tuned on labeled coaching + outcomes (lap delta)
    - Safety rails: never hallucinate sensor values; cite evidence used

- Visualizations
  - 3D visualization (future feature)
  - Advanced overlays: brake points, apex markers, min speed labels, delta bands

Engineering quality

- OpenAPI spec + typed client generation
- Strong test suite (lap detection, sector boundaries, edge cases)
- Benchmarks (ingest + analysis on large sessions)
- Observability (structured logs, metrics, alerts)