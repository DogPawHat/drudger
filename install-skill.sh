#!/usr/bin/env bash
set -euo pipefail

OWNER="DogPawHat"
REPO="drudger"
SKILL_NAME="drudger"
REF="${DRUDGER_REF:-main}"
TARGET_SKILLS_DIR="${1:-${DRUDGER_SKILLS_DIR:-$HOME/.agents/skills}}"
TARGET_DIR="$TARGET_SKILLS_DIR/$SKILL_NAME"
SKILL_URL="https://raw.githubusercontent.com/$OWNER/$REPO/$REF/skill/SKILL.md"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

main() {
  require_cmd curl
  require_cmd mkdir

  mkdir -p "$TARGET_DIR"
  curl -fsSL "$SKILL_URL" -o "$TARGET_DIR/SKILL.md"

  echo "Installed skill '$SKILL_NAME' to: $TARGET_DIR"
  echo "Source: $OWNER/$REPO@$REF"
}

main "$@"
