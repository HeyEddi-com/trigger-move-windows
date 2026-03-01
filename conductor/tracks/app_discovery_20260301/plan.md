# Implementation Plan: Application Discovery Improvements

## Phase 1: Core Discovery Logic
- [ ] Task: Implement robust `.desktop` file parser in `prefs.js`
- [ ] Task: Create helper to resolve icon names to actual GIcon or file paths
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Discovery Logic' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [ ] Task: Create searchable `Adw.Window` or `Gtk.Dialog` for app selection
- [ ] Task: Implement list view with icons using `Gtk.ListBox` or `Gtk.ListView`
- [ ] Task: Connect selection signal to the main preferences configuration
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Validation and Polish
- [ ] Task: Verify discovery works for both system and user-installed apps
- [ ] Task: Ensure icon rendering doesn't impact UI performance
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)
