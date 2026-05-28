#!/usr/bin/env bash
# setup.sh — one-shot bootstrap for fxl-template projects.
#
# What it does (in order):
#   1. Preflight: Node 20+, pnpm 9+, Docker daemon running, git available.
#   2. Mode detection:
#        new-project  →  package.json still has __APP_SLUG__ placeholders
#        new-dev      →  placeholders already replaced (existing project)
#   3. In new-project mode: prompts for slug / name / db (or accepts positional
#      args), then sed-replaces tokens across the tree.
#   4. Scaffolds apps/*/.env from .env.dev.example (or .env.example fallback).
#   5. pnpm install at root.
#   6. pnpm install in apps/mobile (standalone pnpm scope).
#   7. docker compose up db -d  (unless --no-db).
#   8. Prints next steps.
#
# Usage:
#   bash scripts/setup.sh                                  # interactive
#   bash scripts/setup.sh demo "Demo App" demo_app         # non-interactive
#   bash scripts/setup.sh --no-db                          # skip Postgres
#   bash scripts/setup.sh --keep-git                       # keep template .git
#                                                          # (default: wipe + reinit)
#   bash scripts/setup.sh --api-port 3000 --web-port 5173 --site-port 3001

set -euo pipefail

# --- colors ---
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'; RESET='\033[0m'
red()    { printf "${RED}%s${RESET}\n" "$*"; }
green()  { printf "${GREEN}%s${RESET}\n" "$*"; }
yellow() { printf "${YELLOW}%s${RESET}\n" "$*"; }
cyan()   { printf "${CYAN}%s${RESET}\n" "$*"; }

# --- option parsing ---
# Default in new-project mode: wipe template .git and start a fresh history.
# Reason: every new project gets its own repo — you don't want the template's
# 30+ commits showing up in your project's git log. Pass --keep-git to override
# (e.g., when you're testing the template repo itself).
NO_DB=0
KEEP_GIT=0
PROJECT_NUMBER=""
API_PORT=3000
WEB_PORT=5173
SITE_PORT=3001
PG_PORT=5432
API_PORT_OVERRIDDEN=0
WEB_PORT_OVERRIDDEN=0
SITE_PORT_OVERRIDDEN=0
PG_PORT_OVERRIDDEN=0
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-db)            NO_DB=1; shift ;;
    --keep-git)         KEEP_GIT=1; shift ;;
    --git-fresh)        shift ;; # back-compat no-op; fresh git is the default in new-project mode
    -n|--project-number) PROJECT_NUMBER=$2; shift 2 ;;
    --api-port)         API_PORT=$2; API_PORT_OVERRIDDEN=1; shift 2 ;;
    --web-port)         WEB_PORT=$2; WEB_PORT_OVERRIDDEN=1; shift 2 ;;
    --site-port)        SITE_PORT=$2; SITE_PORT_OVERRIDDEN=1; shift 2 ;;
    --pg-port)          PG_PORT=$2; PG_PORT_OVERRIDDEN=1; shift 2 ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*)
      red "Unknown option: $1"; exit 1 ;;
    *)
      POSITIONAL+=("$1"); shift ;;
  esac
done

SLUG=${POSITIONAL[0]:-}
NAME=${POSITIONAL[1]:-}
DB=${POSITIONAL[2]:-}

# --- mode detection ---
MODE="new-dev"
if grep -q '__APP_SLUG__' package.json 2>/dev/null; then
  MODE="new-project"
fi

cyan "=== fxl-template setup — $MODE mode ==="
echo

# --- preflight ---
cyan "==> Preflight"

# Node
if ! command -v node >/dev/null 2>&1; then
  red "  ✗ node not found. Install Node 20+ (https://nodejs.org or \`brew install node\`)."
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
if [[ $NODE_MAJOR -lt 20 ]]; then
  red "  ✗ node $(node -v) found, need >= 20."
  exit 1
fi
green "  ✓ node $(node -v)"

# pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  red "  ✗ pnpm not found. Install with \`npm install -g pnpm\` or \`corepack enable && corepack prepare pnpm@latest --activate\`."
  exit 1
fi
PNPM_MAJOR=$(pnpm -v | cut -d. -f1)
if [[ $PNPM_MAJOR -lt 9 ]]; then
  red "  ✗ pnpm $(pnpm -v) found, need >= 9."
  exit 1
fi
green "  ✓ pnpm $(pnpm -v)"

# git
if ! command -v git >/dev/null 2>&1; then
  red "  ✗ git not found."
  exit 1
fi
green "  ✓ git $(git --version | awk '{print $3}')"

# docker (only when we'll start the db)
if [[ $NO_DB -eq 0 ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    red "  ✗ docker not found. Install Docker Desktop (https://docker.com/products/docker-desktop)"
    red "    Or re-run with --no-db to skip starting Postgres."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    red "  ✗ Docker daemon isn't running. Open Docker Desktop and wait for the whale icon."
    red "    Or re-run with --no-db to skip starting Postgres."
    exit 1
  fi
  green "  ✓ docker $(docker --version | awk '{print $3}' | tr -d ',')"
else
  yellow "  ⊘ docker check skipped (--no-db)"
fi
echo

# --- new-project: gather identity + rename ---
if [[ $MODE == "new-project" ]]; then
  cyan "==> Project identity"

  DEFAULT_SLUG=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-*//;s/-*$//')

  if [[ -z $SLUG ]]; then
    read -r -p "  Slug (kebab-case)        [$DEFAULT_SLUG]: " SLUG
    SLUG=${SLUG:-$DEFAULT_SLUG}
  fi
  if [[ ! $SLUG =~ ^[a-z][a-z0-9-]*$ ]]; then
    red "  ✗ slug must be lowercase kebab-case starting with a letter (got: $SLUG)"
    exit 1
  fi

  DEFAULT_NAME=$(printf '%s' "$SLUG" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));} 1')
  if [[ -z $NAME ]]; then
    read -r -p "  Display name             [$DEFAULT_NAME]: " NAME
    NAME=${NAME:-$DEFAULT_NAME}
  fi

  DEFAULT_DB=$(printf '%s' "$SLUG" | tr '-' '_')
  if [[ -z $DB ]]; then
    read -r -p "  Postgres database name   [$DEFAULT_DB]: " DB
    DB=${DB:-$DEFAULT_DB}
  fi
  if [[ ! $DB =~ ^[a-z][a-z0-9_]*$ ]]; then
    red "  ✗ db must be lowercase snake_case starting with a letter (got: $DB)"
    exit 1
  fi

  # --- Project number → derived ports ---
  # FXL convention: every project is numbered (0–99). Ports are derived so
  # multiple projects can run their stacks simultaneously without collision:
  #   API   = 3000 + N
  #   Web   = 8000 + N
  #   Site  = 4000 + N
  #   DB    = 5000 + N
  # Default parsed from the cwd dirname leading digit (e.g. "3-gps-comercial" → 3).
  # Press Enter on the prompt to keep stock defaults (3000 / 5173 / 3001 / 5432).
  NUM_FROM_DIRNAME=$(basename "$PWD" | grep -oE '^[0-9]+' || true)

  if [[ -z $PROJECT_NUMBER ]]; then
    if [[ -n $NUM_FROM_DIRNAME ]]; then
      read -r -p "  Project number (0–99)    [$NUM_FROM_DIRNAME]: " PROJECT_NUMBER
      PROJECT_NUMBER=${PROJECT_NUMBER:-$NUM_FROM_DIRNAME}
    else
      read -r -p "  Project number (0–99, blank = stock defaults): " PROJECT_NUMBER
    fi
  fi

  if [[ -n $PROJECT_NUMBER ]]; then
    if [[ ! $PROJECT_NUMBER =~ ^[0-9]{1,2}$ ]] || [[ $PROJECT_NUMBER -gt 99 ]]; then
      red "  ✗ project number must be 0–99 (got: $PROJECT_NUMBER)"
      exit 1
    fi
    # Strip any leading zeros for arithmetic (08 → 8)
    N=$((10#$PROJECT_NUMBER))
    [[ $API_PORT_OVERRIDDEN  -eq 0 ]] && API_PORT=$((3000 + N))
    [[ $WEB_PORT_OVERRIDDEN  -eq 0 ]] && WEB_PORT=$((8000 + N))
    [[ $SITE_PORT_OVERRIDDEN -eq 0 ]] && SITE_PORT=$((4000 + N))
    [[ $PG_PORT_OVERRIDDEN   -eq 0 ]] && PG_PORT=$((5000 + N))
  fi

  echo
  echo "  slug:           $SLUG"
  echo "  name:           $NAME"
  echo "  db:             $DB"
  [[ -n $PROJECT_NUMBER ]] && echo "  project number: $PROJECT_NUMBER (ports auto-derived)"
  echo "  api port:       $API_PORT"
  echo "  web port:       $WEB_PORT"
  echo "  site port:      $SITE_PORT"
  echo "  db port (host): $PG_PORT"
  echo

  CREATED_AT=$(date -u +"%Y-%m-%d")

  cyan "==> Replacing placeholders"
  sed_inplace() {
    if sed --version >/dev/null 2>&1; then
      sed -i "$1" "$2"
    else
      sed -i '' "$1" "$2"
    fi
  }

  # File enumeration: skip node_modules, dist, .git, mobile native dirs, binaries
  while IFS= read -r f; do
    if grep -qE '__APP_(SLUG|NAME|PG_DB|PORT_API|PORT_WEB|PORT_SITE|PORT_DB|CREATED_AT)__' "$f"; then
      sed_inplace "s|__APP_SLUG__|$SLUG|g" "$f"
      sed_inplace "s|__APP_NAME__|$NAME|g" "$f"
      sed_inplace "s|__APP_PG_DB__|$DB|g" "$f"
      sed_inplace "s|__APP_PORT_API__|$API_PORT|g" "$f"
      sed_inplace "s|__APP_PORT_WEB__|$WEB_PORT|g" "$f"
      sed_inplace "s|__APP_PORT_SITE__|$SITE_PORT|g" "$f"
      sed_inplace "s|__APP_PORT_DB__|$PG_PORT|g" "$f"
      sed_inplace "s|__APP_CREATED_AT__|$CREATED_AT|g" "$f"
    fi
  # scripts/ is excluded: setup.sh references __APP_SLUG__ in its own
  # mode-detection grep. Rewriting the script's own literals on first run
  # would make subsequent runs falsely detect new-project mode.
  done < <(find . -type f \
    -not -path './node_modules/*' \
    -not -path './*/node_modules/*' \
    -not -path './apps/*/node_modules/*' \
    -not -path './packages/*/node_modules/*' \
    -not -path './apps/*/dist/*' \
    -not -path './packages/*/dist/*' \
    -not -path './.git/*' \
    -not -path './scripts/*' \
    -not -path './apps/mobile/ios/*' \
    -not -path './apps/mobile/android/*' \
    -not -name 'pnpm-lock.yaml' \
    -not -name '*.png' \
    -not -name '*.jpg' \
    -not -name '*.jpeg' \
    -not -name '*.ico' \
    -not -name '*.woff*' \
    -not -name '*.ttf' \
    -not -name '*.lock')
  green "  ✓ placeholders replaced"

  if [[ $KEEP_GIT -eq 1 ]]; then
    yellow "  ⊘ keeping existing .git (you passed --keep-git)"
  else
    cyan "==> Starting fresh git history"
    rm -rf .git
    git init -q
    green "  ✓ fresh .git initialized — make your first commit when ready"
  fi
  echo
fi

# --- scaffold .env files ---
cyan "==> Scaffolding .env files"
for app in apps/api apps/web apps/site apps/mobile; do
  if [[ -f "$app/.env.dev.example" ]]; then
    example="$app/.env.dev.example"
  elif [[ -f "$app/.env.example" ]]; then
    example="$app/.env.example"
  else
    continue
  fi

  target="$app/.env"
  if [[ -f $target ]]; then
    yellow "  $target  exists, skipping"
  else
    cp "$example" "$target"
    green "  $target  ← $(basename "$example")"
  fi
done

# Warn about FXL Local Sandbox placeholders
if grep -rl 'FXL_LOCAL_SANDBOX_REPLACE_ME' apps/*/.env 2>/dev/null | head -1 > /dev/null; then
  echo
  yellow "  ⚠ Clerk keys are still placeholders (FXL_LOCAL_SANDBOX_REPLACE_ME)."
  yellow "    Get the FXL Local Sandbox keys from your CTO, or wire your own Clerk dev app."
  yellow "    See README → § Getting API keys."
fi
echo

# --- pnpm install (root) ---
cyan "==> pnpm install (root workspace)"
pnpm install
echo

# --- pnpm install (apps/mobile, standalone scope) ---
if [[ -f apps/mobile/package.json ]]; then
  cyan "==> pnpm install (apps/mobile — standalone pnpm scope)"
  (cd apps/mobile && pnpm install)
  echo
fi

# --- start Postgres ---
if [[ $NO_DB -eq 0 ]]; then
  cyan "==> Starting local Postgres"
  docker compose up db -d
  echo
fi

# --- done ---
green "=== Setup complete ==="
echo
echo "Next steps:"
if grep -rl 'FXL_LOCAL_SANDBOX_REPLACE_ME' apps/*/.env 2>/dev/null | head -1 > /dev/null; then
  echo "  1. Wire the FXL Local Sandbox Clerk keys (see warning above)."
  echo "  2. make migrate      # once you have a Drizzle schema"
  echo "  3. make              # interactive app selector"
else
  echo "  1. make migrate      # once you have a Drizzle schema"
  echo "  2. make              # interactive app selector"
fi
echo "  +  make doctor       # full FXL health check"
