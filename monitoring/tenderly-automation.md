# Tenderly Automation Scripts (outline)

1) Create alert rules via API:
- Revert rate threshold
- Gas anomaly threshold
- Admin events subscription

2) Example curl:
```bash
curl -H "X-Access-Key: $TENDERLY_ACCESS_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"project":"farmgame","rule":"revert-rate","thresholdPct":5}' \
  https://api.tenderly.co/api/v1/alerts
```

3) Simulate critical flows on each PR using Tenderly simulations API to catch regressions.


