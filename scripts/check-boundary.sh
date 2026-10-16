#!/bin/sh
# Verify the spec-driven feature and the rest of the app stay separable.
#
# The two are worked on from different machines and merged by replacing
# src/features/spec/ wholesale from a zip, so a crossing here is not a style
# question: it is a merge that silently loses work or breaks the build.
#
# Run from the repo root, on either machine:   sh scripts/check-boundary.sh
# Exit 0 = separable. Exit 1 = a crossing, printed.

FEAT="src/features/spec"
fail=0

say() { printf '%s\n' "$1"; }
bad() { say "FAIL  $1"; fail=1; }

[ -d "$FEAT" ] || { say "FAIL  $FEAT is missing."; exit 1; }

# 1. Nothing outside the feature may reach inside it. Two barrels are the
#    contract: `index` for the app (React + CSS) and `engine` for the CLI
#    (headless). Only a real import statement counts, so a comment naming the
#    README is fine.
hits=$(grep -rnE "(from|import\()[[:space:]]*'[^']*features/spec/" --include='*.ts' --include='*.tsx' src cli 2>/dev/null \
  | grep -v "^$FEAT/" \
  | grep -vE "features/spec/(index|engine)'" || true)
if [ -n "$hits" ]; then
  bad "the app or CLI imports a file inside the feature instead of a barrel"
  say "      (allowed: features/spec, features/spec/index, features/spec/engine)"
  printf '%s\n' "$hits"
fi

# 2. The feature may import only from its own folder and this allow-list.
#    Each entry is a frozen, read-only contract — see the README.
ALLOWED='react|react-dom|zustand|pdfjs-dist|jszip|\.\./\.\./flags'
hits=$(grep -rn "from '" "$FEAT" --include='*.ts' --include='*.tsx' \
  | grep -v "from '\./" | grep -vE "from '($ALLOWED)" || true)
if [ -n "$hits" ]; then
  bad "the feature imports something outside its allow-list:"
  printf '%s\n' "$hits"
fi

# 3. Feature-owned CSS must not appear in the shared stylesheet, and the shared
#    classes the feature only reads must not be redefined inside it.
hits=$(grep -nE '^\s*\.(sp-|spec-|target-|remap-note)' src/styles.css || true)
if [ -n "$hits" ]; then
  bad "spec-owned selectors are defined in the shared stylesheet:"
  printf '%s\n' "$hits"
fi
hits=$(grep -nE '^\s*\.(card|btn|slot|tabs|chip|empty-state|upload-row|spinner)\s*\{' "$FEAT/spec.css" || true)
if [ -n "$hits" ]; then
  bad "the feature redefines a shared component class (read-only contract):"
  printf '%s\n' "$hits"
fi

# 4. No file may live in both halves. A spec file left behind in the old
#    locations is the shape a bad zip merge takes.
for stray in src/types/spec.ts src/services/specCheck.ts src/services/specExport.ts \
             src/services/sheetRead.ts src/services/sheetSpec.ts src/store/specStore.ts \
             src/components/spec; do
  [ -e "$stray" ] && bad "$stray is back outside the feature; the folder move was undone."
done

if [ "$fail" -eq 0 ]; then
  say "OK  the spec feature and the app are separable."
  say "    feature: $(find "$FEAT" -type f | wc -l | tr -d ' ') files"
fi
exit $fail
