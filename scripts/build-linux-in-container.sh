#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="${CONTAINER_ENGINE:-}"
IMAGE_TAG="${OPENWHISPR_CI_IMAGE:-openwhispr-linux-ci:local}"
BUILD_CMD="${1:-build:linux:appimage}"

if [[ -z "${ENGINE}" ]]; then
  if command -v podman >/dev/null 2>&1; then
    ENGINE="podman"
  elif command -v docker >/dev/null 2>&1; then
    ENGINE="docker"
  else
    echo "No container engine found. Install podman or docker, or set CONTAINER_ENGINE." >&2
    exit 1
  fi
fi

if ! command -v "${ENGINE}" >/dev/null 2>&1; then
  echo "Container engine '${ENGINE}' is not available in PATH." >&2
  exit 1
fi

echo "Building CI image with ${ENGINE}: ${IMAGE_TAG}"
"${ENGINE}" build -f "${ROOT_DIR}/docker/linux-ci.Dockerfile" -t "${IMAGE_TAG}" "${ROOT_DIR}"

RUN_ARGS=(
  --rm
  -e HOME=/tmp/openwhispr-home
  -e npm_config_cache=/tmp/openwhispr-home/.npm
  -e ELECTRON_CACHE=/tmp/openwhispr-home/.cache/electron
  -e ELECTRON_BUILDER_CACHE=/tmp/openwhispr-home/.cache/electron-builder
  -e BUILD_CMD_INNER="${BUILD_CMD}"
  -e GH_TOKEN
  -e GITHUB_TOKEN
  -e GOOGLE_CALENDAR_CLIENT_ID
  -e GOOGLE_CALENDAR_CLIENT_SECRET
  -e VITE_NEON_AUTH_URL
  -e VITE_OPENWHISPR_API_URL
  -e VITE_OPENWHISPR_OAUTH_CALLBACK_URL
  -v "${ROOT_DIR}:/workspace"
  -w /workspace
)

if [[ "${ENGINE}" == "podman" ]]; then
  RUN_ARGS+=(--userns keep-id)
else
  RUN_ARGS+=(--user "$(id -u):$(id -g)")
fi

CONTAINER_SCRIPT=$(cat <<'EOF'
set -euo pipefail
mkdir -p "$HOME"
npm ci
npm install @rollup/rollup-linux-x64-gnu lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu --no-save
node scripts/download-whisper-cpp.js --current
node scripts/download-llama-server.js --current
node scripts/download-sherpa-onnx.js --current
node scripts/download-qdrant.js --current
node scripts/download-meeting-aec-helper.js --current
npm run download:diarization-models -- --output-dir resources/bin/diarization-models
npm run "$BUILD_CMD_INNER"
EOF
)

echo "Running ${BUILD_CMD} in CI-like container"
"${ENGINE}" run "${RUN_ARGS[@]}" "${IMAGE_TAG}" bash -lc "${CONTAINER_SCRIPT}"
