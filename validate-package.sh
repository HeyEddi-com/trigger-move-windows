#!/bin/bash
# validate-package.sh - Validate GNOME Shell extension zip package

set -e

ZIP_FILE=$1

if [ -z "$ZIP_FILE" ]; then
    echo "Usage: $0 <package.zip>"
    exit 1
fi

if [ ! -f "$ZIP_FILE" ]; then
    echo "ERROR: File not found: $ZIP_FILE"
    exit 1
fi

echo "Validating package: $ZIP_FILE"

# List contents
CONTENTS=$(unzip -l "$ZIP_FILE")

# Required files at root
REQUIRED_ROOT=(
    "extension.js"
    "prefs.js"
    "metadata.json"
    "stylesheet.css"
)

for file in "${REQUIRED_ROOT[@]}"; do
    if echo "$CONTENTS" | grep -q "  $file$"; then
        echo "✓ Found $file"
    else
        echo "ERROR: Missing required file at root: $file"
        exit 1
    fi
done

# Required schema
if echo "$CONTENTS" | grep -q "  schemas/org.gnome.shell.extensions.trigger-move-windows.gschema.xml$"; then
    echo "✓ Found schema source"
else
    echo "ERROR: Missing schema source in schemas/ directory"
    exit 1
fi

# Forbidden files
FORBIDDEN=(
    ".git"
    "conductor"
    ".todo.md"
    "Makefile"
    "test-"
    ".compiled"
)

for pattern in "${FORBIDDEN[@]}"; do
    if echo "$CONTENTS" | grep -q "$pattern"; then
        echo "ERROR: Forbidden pattern found in zip: $pattern"
        exit 1
    fi
done

echo "✓ No forbidden files found"
echo "PACKAGE VALIDATION SUCCESSFUL"
