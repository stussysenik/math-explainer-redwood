#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting Python sidecar..."
cd "$PROJECT_DIR/sidecar"
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi
python -m uvicorn math_sidecar.main:app --port 8100 --reload &
SIDECAR_PID=$!

cleanup() {
  echo "Stopping sidecar (PID $SIDECAR_PID)..."
  kill $SIDECAR_PID 2>/dev/null
  wait $SIDECAR_PID 2>/dev/null
}
trap cleanup EXIT

# Wait for sidecar to be ready
echo "Waiting for sidecar..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
    echo "Sidecar ready!"
    break
  fi
  sleep 1
done

echo "Starting Redwood dev server..."
cd "$PROJECT_DIR"
PATH="/opt/homebrew/opt/node@20/bin:$PATH" yarn rw dev
