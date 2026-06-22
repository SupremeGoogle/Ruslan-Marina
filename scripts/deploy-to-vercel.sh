#!/usr/bin/env bash
# One-shot deploy helper.
#
# Usage:
#   export VERCEL_TOKEN=vcl_xxx     # personal access token from vercel.com/account/tokens
#   ./scripts/deploy-to-vercel.sh
#
# Creates a fresh Vercel project linked to SupremeGoogle/Ruslan-Marina,
# uploads the 4 env vars from .env.local, and triggers a production
# deployment. Idempotent — safe to re-run.

set -euo pipefail

PROJECT_NAME="ruslan-marina"
TEAM_SLUG="leras-projects-aaf09f49"
TEAM_ID="team_XT6yFf6IhZC6E2pwjds86h2Z"
GIT_REPO="SupremeGoogle/Ruslan-Marina"
ENV_FILE="$(dirname "$0")/../.env.local"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: VERCEL_TOKEN env var not set."
  echo "Create a token at https://vercel.com/account/tokens and:"
  echo "  export VERCEL_TOKEN=vcl_xxx"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

API="https://api.vercel.com"
AUTH_HEADER="Authorization: Bearer ${VERCEL_TOKEN}"

echo "==> Checking auth..."
USER_JSON="$(curl -fsS -H "$AUTH_HEADER" "${API}/v2/user")"
echo "    Logged in as: $(echo "$USER_JSON" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["user"]["username"])')"

echo "==> Looking up project $PROJECT_NAME ..."
PROJECT_JSON="$(curl -sS -H "$AUTH_HEADER" "${API}/v9/projects/${PROJECT_NAME}?teamId=${TEAM_ID}")"
PROJECT_ID="$(echo "$PROJECT_JSON" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("id",""))' || true)"

if [[ -z "$PROJECT_ID" ]]; then
  echo "==> Creating new project linked to ${GIT_REPO} ..."
  CREATE_BODY=$(cat <<EOF
{
  "name": "${PROJECT_NAME}",
  "framework": "nextjs",
  "gitRepository": {
    "type": "github",
    "repo": "${GIT_REPO}"
  }
}
EOF
)
  PROJECT_JSON="$(curl -fsS -X POST \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "$CREATE_BODY" \
    "${API}/v11/projects?teamId=${TEAM_ID}")"
  PROJECT_ID="$(echo "$PROJECT_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')"
  echo "    Project created: $PROJECT_ID"
else
  echo "    Project exists: $PROJECT_ID"
fi

echo "==> Uploading env vars from .env.local ..."
while IFS='=' read -r key value; do
  key="$(echo "$key" | xargs)"
  [[ -z "$key" || "$key" == \#* ]] && continue
  value="${value%\"}"; value="${value#\"}"
  echo "    - $key"
  curl -sS -X POST \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'key':sys.argv[1],'value':sys.argv[2],'type':'encrypted','target':['production','preview','development']}))" "$key" "$value")" \
    "${API}/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true" >/dev/null
done < "$ENV_FILE"

echo "==> Triggering production deployment from latest main commit ..."
SHA="$(git -C "$(dirname "$0")/.." rev-parse HEAD)"
DEPLOY_BODY=$(cat <<EOF
{
  "name": "${PROJECT_NAME}",
  "target": "production",
  "gitSource": {
    "type": "github",
    "ref": "main",
    "sha": "${SHA}",
    "repoId": 1276854657
  },
  "projectSettings": {
    "framework": "nextjs"
  }
}
EOF
)
DEPLOY_JSON="$(curl -fsS -X POST \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "$DEPLOY_BODY" \
  "${API}/v13/deployments?teamId=${TEAM_ID}")"

DEPLOY_URL="$(echo "$DEPLOY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')"
echo ""
echo "==> Deployment queued: https://${DEPLOY_URL}"
echo "==> Production alias will be: https://${PROJECT_NAME}.vercel.app"
echo "    (build typically takes ~40s)"
