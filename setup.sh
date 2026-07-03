#!/usr/bin/env sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

printf '%s\n' '=================================='
printf '%s\n' ' NexusAI - Setup Script'
printf '%s\n' '=================================='
printf '\n'

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: npm is not installed or not available in PATH.' >&2
  exit 1
fi

printf '%s\n' '[1/2] Installing server dependencies...'
cd "$ROOT_DIR/server"
npm install

printf '%s\n' '[2/2] Installing client dependencies...'
cd "$ROOT_DIR/client"
npm install

printf '\n'
printf '%s\n' '=================================='
printf '%s\n' ' Setup Complete!'
printf '%s\n' '=================================='
printf '\n'
printf '%s\n' 'To start the application:'
printf '%s\n' '  1. Terminal #1: ./start.sh'
printf '%s\n' '  2. Or manually: cd server && npm start, then cd client && npm run dev'
printf '\n'
printf '%s\n' 'Then open http://localhost:5173 in your browser.'