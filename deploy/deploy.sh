#!/usr/bin/env bash
# Deploy the latest commit to the Hostinger VPS.
# Run as the `yoshi` user from /srv/yoshitaka/app.
set -euo pipefail

cd "$(dirname "$0")/.."          # repo root, regardless of CWD
REPO_ROOT="$PWD"
echo "▶ deploying from $REPO_ROOT"

# 1. Pull latest code
git fetch --all --prune
git reset --hard origin/main     # if you deploy from a different branch, change here

# 2. Backend — install only if requirements.txt changed since last deploy
cd backend
source .venv/bin/activate
if ! git diff --quiet HEAD@{1} HEAD -- requirements.txt 2>/dev/null; then
    echo "▶ requirements.txt changed — reinstalling deps"
    pip install -r requirements.txt
fi
deactivate
cd "$REPO_ROOT"

# 3. Restart API (zero-downtime-ish — gunicorn handles in-flight requests)
sudo systemctl restart yoshitaka-api
sleep 1
sudo systemctl --no-pager status yoshitaka-api | head -n 6
curl -fsS http://127.0.0.1:8001/api/health >/dev/null && echo "▶ API healthy"

# 4. Frontend — only rebuild if /frontend changed since last deploy
if ! git diff --quiet HEAD@{1} HEAD -- frontend 2>/dev/null; then
    echo "▶ frontend changed — rebuilding"
    cd frontend
    if ! git diff --quiet HEAD@{1} HEAD -- yarn.lock package.json 2>/dev/null; then
        yarn install --frozen-lockfile
    fi
    yarn build
    cd "$REPO_ROOT"
    sudo systemctl reload nginx
else
    echo "▶ frontend unchanged — skipping rebuild"
fi

echo "✅ deploy complete · $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
