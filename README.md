# Racemaker telemetry API (Bun + Hono)

Implements the “RACEMAKE Product Engineer Challenge — Hard”.

## Run

```bash
bun install
bun run challenge-hard.ts
```

## Test

```bash
bun test
```

## Curl

```bash
curl -X POST http://localhost:3000/ingest -H "Content-Type: application/json" -d @telemetry.json
```

```bash
curl http://localhost:3000/laps
```

```bash
curl http://localhost:3000/analysis
```

