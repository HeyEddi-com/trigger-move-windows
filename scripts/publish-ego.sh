#!/usr/bin/env bash
# Submit a packed extension zip to extensions.gnome.org for review.
# Requires GNOME_USERNAME and GNOME_PASSWORD (never pass them on the command line).
# Sending the upload asserts shell_license_compliant and tos_compliant.
set -euo pipefail

ZIP=${1:-}
if [[ -z "$ZIP" || ! -f "$ZIP" ]]; then
  echo "Usage: GNOME_USERNAME=... GNOME_PASSWORD=... $0 <extension.zip>" >&2
  exit 2
fi
if [[ -z "${GNOME_USERNAME:-}" || -z "${GNOME_PASSWORD:-}" ]]; then
  echo "Set GNOME_USERNAME and GNOME_PASSWORD." >&2
  exit 2
fi

LOGIN_URL="https://extensions.gnome.org/api/v1/accounts/login/"
UPLOAD_URL="https://extensions.gnome.org/api/v1/extensions"
login_body=$(mktemp)
upload_body=$(mktemp)
trap 'rm -f "$login_body" "$upload_body"' EXIT

login_code=$(curl -sS -o "$login_body" -w "%{http_code}" \
  -H "Accept: application/json" \
  --data-urlencode "login=${GNOME_USERNAME}" \
  --data-urlencode "password=${GNOME_PASSWORD}" \
  "$LOGIN_URL")

token=$(python3 - "$login_body" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
tok = data.get("token")
if isinstance(tok, dict):
    tok = tok.get("token")
if not tok:
    detail = data.get("detail") or data.get("error") or data
    raise SystemExit(f"login failed: {detail}")
print(tok)
PY
) || {
  echo "extensions.gnome.org login failed (HTTP ${login_code})." >&2
  exit 1
}

if [[ "$login_code" != "200" && "$login_code" != "201" ]]; then
  echo "extensions.gnome.org login failed (HTTP ${login_code})." >&2
  exit 1
fi

echo "Authenticated. Uploading ${ZIP} for review..."
upload_code=$(curl -sS -o "$upload_body" -w "%{http_code}" \
  -H "Authorization: Token ${token}" \
  -F "source=@${ZIP}" \
  -F "shell_license_compliant=true" \
  -F "tos_compliant=true" \
  "$UPLOAD_URL")

if [[ "$upload_code" != "201" ]]; then
  echo "Upload failed (HTTP ${upload_code}):" >&2
  python3 - "$upload_body" <<'PY' >&2
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
try:
    print(json.dumps(json.loads(raw), indent=2))
except json.JSONDecodeError:
    print(raw)
PY
  exit 1
fi

python3 - "$upload_body" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
pk = data.get("pk") or data.get("id")
print(f"Submitted for review (HTTP 201). version id: {pk}")
PY
