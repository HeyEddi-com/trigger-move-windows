# Specification: Restore Application Activation and Launch Functionality

## Overview
This track aims to restore and fix the application activation (focusing running windows) and launching (starting apps if not running) functionality that has recently regressed.

## Goals
- **Focus Running Apps:** Pressing an application-specific shortcut should immediately focus the app's window if it is already running.
- **Launch Non-Running Apps:** Pressing an application-specific shortcut should launch the app if it is not currently running.
- **Reliable Keybindings:** Ensure all configured per-app shortcuts are correctly registered and handled by the extension.

## Acceptance Criteria
- [ ] Pressing a shortcut for a running app (e.g., Firefox) brings its window to the front.
- [ ] Pressing a shortcut for a non-running app (e.g., Calculator) launches the application.
- [ ] Debug logs confirm the correct identification of applications and windows.
- [ ] Automated tests using `gdbus` verify the logic for both focusing and launching.

## Technical Details
- **Window Focusing:** Utilize `metaWindow.activate(global.get_current_time())`.
- **App Launching:** Utilize `Shell.AppSystem.get_default().lookup_app(appId).launch()`.
- **Matching Logic:** Prioritize App ID matching over fuzzy title/class matching for reliable activation.
