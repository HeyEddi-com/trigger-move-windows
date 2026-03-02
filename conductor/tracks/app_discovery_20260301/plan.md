# Implementation Plan: Application Discovery Improvements

## Phase 1: Core Discovery Logic [checkpoint: bd1a376]
- [x] Task: Implement robust `.desktop` file parser in `prefs.js`
- [x] Task: Create helper to resolve icon names to actual GIcon or file paths
- [x] Task: Conductor - User Manual Verification 'Phase 1: Discovery Logic' (Protocol in workflow.md)

## Phase 2: UI Implementation [checkpoint: 6b3cb16]
- [x] Task: Create searchable `Adw.Window` or `Gtk.Dialog` for app selection
- [x] Task: Implement list view with icons using `Gtk.ListBox` or `Gtk.ListView`
- [x] Task: Connect selection signal to the main preferences configuration
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Validation and Polish
- [ ] Task: Verify discovery works for both system and user-installed apps
- [ ] Task: Ensure icon rendering doesn't impact UI performance
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)
