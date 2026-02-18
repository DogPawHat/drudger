#!/usr/bin/env bash
set -euo pipefail

OWNER="DogPawHat"
REPO="drudger"
BINARY_NAME="drudger"
INSTALL_DIR="${DRUDGER_INSTALL_DIR:-$HOME/.local/bin}"
REQUESTED_VERSION="${DRUDGER_VERSION:-latest}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

detect_os() {
  case "$(uname -s)" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    *)
      echo "Error: unsupported operating system: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)
      echo "Error: unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

resolve_tag() {
  if [ "$REQUESTED_VERSION" != "latest" ]; then
    echo "$REQUESTED_VERSION"
    return
  fi

  local api_url="https://api.github.com/repos/$OWNER/$REPO/releases/latest"
  local release_json
  release_json="$(curl -fsSL "$api_url")"

  local tag
  tag="$(printf '%s\n' "$release_json" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

  if [ -z "$tag" ]; then
    echo "Error: failed to resolve latest release tag." >&2
    exit 1
  fi

  echo "$tag"
}

verify_checksum() {
  local file_path="$1"
  local checksums_path="$2"
  local asset_name
  asset_name="$(basename "$file_path")"

  local expected
  expected="$(grep "  $asset_name$" "$checksums_path" | awk '{print $1}')"

  if [ -z "$expected" ]; then
    expected="$(grep " $asset_name$" "$checksums_path" | awk '{print $1}')"
  fi

  if [ -z "$expected" ]; then
    echo "Error: checksum entry for $asset_name not found." >&2
    exit 1
  fi

  local actual
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file_path" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file_path" | awk '{print $1}')"
  else
    echo "Error: neither sha256sum nor shasum is installed." >&2
    exit 1
  fi

  if [ "$expected" != "$actual" ]; then
    echo "Error: checksum mismatch for $asset_name" >&2
    exit 1
  fi
}

main() {
  require_cmd curl

  local os
  os="$(detect_os)"
  local arch
  arch="$(detect_arch)"

  local asset_name="$BINARY_NAME-$os-$arch"
  local tag
  tag="$(resolve_tag)"
  local download_base="https://github.com/$OWNER/$REPO/releases/download/$tag"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  local binary_path="$tmp_dir/$asset_name"
  local checksums_path="$tmp_dir/sha256sums.txt"

  echo "Downloading $asset_name from $tag..."
  curl -fsSL "$download_base/$asset_name" -o "$binary_path"
  curl -fsSL "$download_base/sha256sums.txt" -o "$checksums_path"

  echo "Verifying checksum..."
  verify_checksum "$binary_path" "$checksums_path"

  mkdir -p "$INSTALL_DIR"
  install -m 0755 "$binary_path" "$INSTALL_DIR/$BINARY_NAME"

  echo "Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"

  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
      echo "Add $INSTALL_DIR to your PATH to run '$BINARY_NAME' directly."
      ;;
  esac

  echo "Run: $BINARY_NAME --help"
}

main "$@"
