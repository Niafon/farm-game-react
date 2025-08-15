# FarmGame Subgraph

Environment variables for CI/deploy:
- `FARMGAME_ADDRESS`
- `START_BLOCK`
- `GRAPH_ACCESS_TOKEN` (Graph Studio)

Scripts:
```bash
npm run codegen
npm run build
GRAPH_ACCESS_TOKEN=... graph deploy --studio farmgame
```

Notes:
- Handler `handleStateDelta` fetches `getFullState(player)` to persist the latest state snapshot per player.
- For large datasets, consider batching and denormalizing per UI needs. See The Graph best practices.


