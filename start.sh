#!/usr/bin/env sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: npm is not installed or not available in PATH.' >&2
  exit 1
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "${CLIENT_PID:-}" ] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup INT TERM EXIT

printf '%s\n' 'Starting NexusAI...'
printf '\n'
printf '%s\n' '[1/2] Starting Express server on port 3001...'
(
  cd "$ROOT_DIR/server"
  npm start
) &
SERVER_PID=$!

sleep 2

printf '%s\n' '[2/2] Starting Vite dev server on port 5173...'
(
  cd "$ROOT_DIR/client"
  npm run dev
) &
CLIENT_PID=$!

printf '\n'
printf '%s\n' 'Both servers are starting. Open http://localhost:5173'
printf '%s\n' 'Press Ctrl+C to stop both servers.'

wait "$SERVER_PID" "$CLIENT_PID"