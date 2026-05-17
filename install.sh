#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="all"
LINK_SKILLS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target|--agent)
      TARGET="$2"
      shift 2
      ;;
    --link-skills)
      LINK_SKILLS="--link-skills"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./install.sh [--target all|claude|codex] [--link-skills]"
      exit 1
      ;;
  esac
done

echo "=== cbrain install ==="

# Check for Bun
if ! command -v bun &>/dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "Bun: $(bun --version)"

# Install dependencies
cd "$REPO_DIR"
bun install --frozen-lockfile 2>/dev/null || bun install

# Link globally
bun link
echo "cbrain CLI linked: $(which cbrain 2>/dev/null || echo 'run: export PATH=$HOME/.bun/bin:$PATH')"

cbrain init --agent "$TARGET" $LINK_SKILLS -y

echo ""
echo "=== Installation complete ==="
echo "Installed for: $TARGET"
