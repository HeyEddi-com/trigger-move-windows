#!/bin/sh
# Mechanical checks aligned with common extensions.gnome.org / EGO review feedback.
# Not a full substitute for human review or shexli/ego-lint; catches frequent auto-fails.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

fail() {
  echo "EGO-CHECK FAIL: $*"
  exit 1
}

warn() {
  echo "EGO-CHECK WARN: $*"
}

echo "== EGO-style: metadata.json (required fields for listing) =="
python3 - <<'PY'
import json
from pathlib import Path
m = json.loads(Path("metadata.json").read_text(encoding="utf-8"))
need = ("uuid", "name", "description", "shell-version", "url", "version",
         "settings-schema", "gettext-domain")
for k in need:
    if k not in m or m[k] in (None, "", []):
        raise SystemExit(f"missing or empty metadata key: {k!r}")
uuid = m["uuid"]
if "@" not in uuid or len(uuid) < 5:
    raise SystemExit(f"uuid should look like id@domain, got {uuid!r}")
if not isinstance(m["shell-version"], list) or len(m["shell-version"]) < 1:
    raise SystemExit("shell-version must be a non-empty array")
print("ok metadata:", m["uuid"])
PY

echo "== EGO-style: extension.js must not import Gtk / Gdk / Adw (shell process) =="
for pat in "gi://Gtk" "gi://Gdk" "gi://Adw" "imports.gi.Gtk" "imports.gi.Gdk" "imports.gi.Adw"; do
  if grep -qF "$pat" extension.js 2>/dev/null; then
    fail "forbidden in extension.js: $pat"
  fi
done
echo "ok: no Gtk/Gdk/Adw in extension process file"

echo "== EGO-style: extension.js — avoid synchronous file IO (common EGO-X rules) =="
for pat in "GLib.file_get_contents" "GLib.file_get_contents_utf8" "Gio.File.prototype.load_contents" "Gio._localFilePrototype.load_contents"; do
  if grep -qF "$pat" extension.js 2>/dev/null; then
    fail "synchronous file API in extension.js: $pat"
  fi
done
if grep -nE '\.load_contents\(' extension.js 2>/dev/null | grep -vF 'load_contents_async' | grep -q .; then
  fail "use load_contents_async, not synchronous .load_contents( )"
fi
echo "ok: no obvious sync file read APIs"

echo "== EGO-style: extension.js — avoid blocking spawn APIs =="
for pat in "GLib.spawn_command_line_sync" "GLib.spawn_sync" "Gio.Subprocess.communicate_utf8_sync" "Gio.Subprocess.communicate_sync"; do
  if grep -qF "$pat" extension.js 2>/dev/null; then
    fail "blocking spawn in extension.js: $pat"
  fi
done
echo "ok: no obvious sync spawn APIs"

echo "== EGO-style: extension.js — avoid eval / dynamic code =="
for pat in "eval(" "new Function(" "Function("; do
  if grep -qF "$pat" extension.js 2>/dev/null; then
    fail "dynamic code pattern in extension.js: $pat"
  fi
done
echo "ok: no eval/Function patterns"

echo "== EGO-style: extension.js — ESM extension entry =="
grep -q "export default class" extension.js || fail "expected export default class in extension.js"
grep -q "resource:///org/gnome/shell/extensions/extension.js" extension.js \
  || fail "expected Extension import from resource:///org/gnome/shell/extensions/extension.js"
grep -q "enable()" extension.js || fail "expected enable() in extension.js"
grep -q "disable()" extension.js || fail "expected disable() in extension.js"
echo "ok: ESM Extension shape"

echo "== EGO-style: prefs.js must not pull in Shell Main UI =="
if grep -qF "resource:///org/gnome/shell/ui/main.js" prefs.js 2>/dev/null; then
  fail "prefs.js must not import Shell Main (wrong process / wrong split)"
fi
echo "ok: prefs does not import main.js"

echo "== EGO-style: prefs.js — avoid eval in preferences =="
for pat in "eval(" "new Function("; do
  if grep -qF "$pat" prefs.js 2>/dev/null; then
    fail "dynamic code in prefs.js: $pat"
  fi
done
echo "ok: prefs has no eval"

echo "== EGO-style: zip layout hint (lib/ must ship with extension.js) =="
test -f lib/accelerator-validate.js || fail "missing lib/accelerator-validate.js"
grep -q "lib/accelerator-validate.js" extension.js || fail "extension.js must import ./lib/accelerator-validate.js"
echo "ok: shared lib present and referenced"

echo "== EGO-style: optional network / Soup (informational) =="
if grep -qE '\bfetch\s*\(|imports\.gi\.Soup|gi://Soup' extension.js prefs.js 2>/dev/null; then
  warn "network client APIs detected — ensure use matches review expectations (user intent, no silent phone-home)"
fi

echo "ALL EGO-STYLE CHECKS PASSED"
