#!/bin/sh
# Black-box / smoke checks that do not load GNOME Shell.
# Run from repo root: sh tests/smoke/blackbox.sh   or   npm run test:smoke
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

echo "== Smoke: required files =="
for f in extension.js prefs.js metadata.json stylesheet.css schemas/org.gnome.shell.extensions.trigger-move-windows.gschema.xml lib/accelerator-validate.js; do
  test -f "$f" || { echo "missing: $f"; exit 1; }
  echo "ok: $f"
done

echo "== Smoke: metadata.json is valid JSON =="
python3 -m json.tool metadata.json >/dev/null

echo "== Smoke: shell-version lists 45, 50, and 51 =="
python3 - <<'PY'
import json
from pathlib import Path
m = json.loads(Path("metadata.json").read_text())
sv = m.get("shell-version") or []
for v in ("45", "50", "51"):
    assert v in sv, f"shell-version should include {v}, got {sv!r}"
print("ok:", ", ".join(sv))
PY

echo "== Smoke: schema compiles =="
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/schemas"
cp schemas/org.gnome.shell.extensions.trigger-move-windows.gschema.xml "$tmpdir/schemas/"
glib-compile-schemas "$tmpdir/schemas"

echo "== Smoke: extension must not use sync GLib.file_get_contents (EGO-X-004) =="
if grep -q 'GLib\.file_get_contents' extension.js; then
  echo "FAIL: synchronous GLib.file_get_contents found in extension.js"
  exit 1
fi
echo "ok: no GLib.file_get_contents"

echo "== Smoke: extension should use async load for /proc comm =="
grep -q 'load_contents_async' extension.js || {
  echo "WARN: expected load_contents_async for async /proc reads"
}

echo "== Smoke: extension imports shared accelerator validate =="
grep -q "lib/accelerator-validate.js" extension.js || {
  echo "FAIL: extension.js should import lib/accelerator-validate.js"
  exit 1
}

if [ "${SHEXLI_STRICT:-}" = 1 ] && command -v shexli >/dev/null 2>&1; then
  echo "== Smoke: shexli (SHEXLI_STRICT=1) =="
  shexli .
elif command -v shexli >/dev/null 2>&1; then
  echo "== Smoke: shexli not strict (set SHEXLI_STRICT=1 to fail build on findings) =="
else
  echo "== Smoke: shexli not in PATH (skip) =="
fi

echo "== Smoke: extensions.gnome.org / EGO-style mechanical review =="
sh tests/smoke/ego-gnome-review.sh

echo "ALL SMOKE CHECKS PASSED"
