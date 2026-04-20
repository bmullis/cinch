#!/usr/bin/env bash
# Add (or refresh) a `cinch` shell alias in the user's rc file so `cinch ...`
# runs `bun run <repo>/src/cli/index.ts ...`. No compiled binary, no wrapper.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
MARKER_BEGIN="# >>> cinch alias >>>"
MARKER_END="# <<< cinch alias <<<"

case "${SHELL:-}" in
  */zsh) RC="${ZDOTDIR:-$HOME}/.zshrc" ;;
  */bash) RC="$HOME/.bashrc" ;;
  *) RC="$HOME/.zshrc" ;;
esac

touch "$RC"

# Strip any previous cinch block, then append the fresh one.
if grep -q "$MARKER_BEGIN" "$RC"; then
  tmp="$(mktemp)"
  awk -v b="$MARKER_BEGIN" -v e="$MARKER_END" '
    $0==b {skip=1; next}
    $0==e {skip=0; next}
    !skip
  ' "$RC" > "$tmp"
  mv "$tmp" "$RC"
fi

{
  echo "$MARKER_BEGIN"
  echo "alias cinch='bun run \"$REPO/src/cli/index.ts\"'"
  echo "$MARKER_END"
} >> "$RC"

echo "added alias to $RC:"
echo "  alias cinch='bun run \"$REPO/src/cli/index.ts\"'"
echo ""
echo "Reload your shell to pick it up:"
echo "  exec \$SHELL"
echo ""
echo "Then try: cinch add \"hello world\""
