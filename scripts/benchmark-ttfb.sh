#!/usr/bin/env bash

# Benchmark warm TTFB for key routes against a running production server.
# Usage: ./scripts/benchmark-ttfb.sh [base_url] [cookie_file]

BASE="${1:-http://localhost:3000}"
COOKIE_FILE="${2:-}"
COOKIE_FLAG=""

if [ -n "$COOKIE_FILE" ]; then
  COOKIE_FLAG="-b $COOKIE_FILE"
fi

ROUTES=(
  "/"
  "/dashboard"
  "/client/dashboard"
  "/client/campaigns"
  "/partner/settings/brand"
)

echo "=== TTFB Benchmark ==="
echo "Base: $BASE"
echo ""

for route in "${ROUTES[@]}"; do
  curl -s -o /dev/null $COOKIE_FLAG "$BASE$route" 2>/dev/null

  total=0
  for _ in 1 2 3; do
    ttfb=$(curl -s -o /dev/null -w '%{time_starttransfer}' $COOKIE_FLAG "$BASE$route" 2>/dev/null)
    ms=$(echo "$ttfb * 1000" | bc)
    total=$(echo "$total + $ms" | bc)
  done

  avg=$(echo "scale=0; $total / 3" | bc)
  echo "$route: ${avg}ms (avg of 3 warm requests)"
done
