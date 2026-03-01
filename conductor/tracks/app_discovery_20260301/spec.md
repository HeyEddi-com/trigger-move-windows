# Specification: Application Discovery Improvements

## Overview
Enhance the preferences UI to allow users to easily browse and select from all installed applications on their system, including correct IDs and icons.

## Goals
- **System Scan:** Reliably scan `/usr/share/applications` and `~/.local/share/applications` for `.desktop` files.
- **Icon Support:** Display the correct application icons in the selection list.
- **Searchable List:** Provide a filtered/searchable interface for finding apps quickly.
- **Auto-populate IDs:** Automatically use the correct `.desktop` filename as the `appId` to ensure the launch logic works out of the box.

## Acceptance Criteria
- [ ] Users can open an "Add Application" dialog that lists all installed apps.
- [ ] Applications in the list show their proper name and icon.
- [ ] Selecting an app automatically fills the configuration with the correct system ID.
- [ ] Search functionality works within the app selection dialog.
