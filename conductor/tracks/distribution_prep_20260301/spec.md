# Specification: Packaging for Distribution

## Overview
Prepare the extension for official release on the GNOME Extensions website (extensions.gnome.org).

## Goals
- **Metadata Validation:** Ensure `metadata.json` has all required fields and correct versioning.
- **Asset Review:** Ensure `stylesheet.css` and icons are optimized and compliant.
- **Package Automation:** Update `Makefile` to generate a clean, compliant `.zip` package.
- **Documentation:** Ensure `README.md` is ready for public consumption.

## Acceptance Criteria
- [ ] `metadata.json` passes validation for GNOME Shell 45-49.
- [ ] `make package` generates a zip file containing only necessary files (no `.git`, `.todo.md`, etc.).
- [ ] Extension can be installed and enabled cleanly from the generated zip file.
- [ ] All code follows GNOME's Review Guidelines (no forbidden imports, proper cleanup).
