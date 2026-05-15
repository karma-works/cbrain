#!/usr/bin/env bash
set -e

CBRAIN_DIR="$HOME/.cbrain"
SKILLS_DIR="$HOME/.claude/skills"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Install skills
mkdir -p "$SKILLS_DIR"
for skill in cbrain-gather-requirements cbrain-session-load cbrain-decision-log cbrain-session-capture cbrain-resolver; do
  src="$REPO_DIR/skills/$skill"
  if [ -d "$src" ]; then
    cp -r "$src" "$SKILLS_DIR/"
    echo "Installed skill: $skill"
  fi
done

echo ""
echo "=== Installation complete ==="
echo "Run: cbrain init"
