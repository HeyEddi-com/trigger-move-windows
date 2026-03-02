# Implementation Plan: Interactive Shortcut Selector

This track implements an interactive shortcut recording experience in the preferences UI, replacing manual text entry.

## Phase 1: Research and UI Prototyping [checkpoint: 04be46c]
- [x] Task: Research `Gtk.EventControllerKey` and event capturing in GNOME Shell preferences.
- [x] Task: Write failing test for key combination to string conversion logic.
- [x] Task: Implement `_formatKeyComboToString` helper to convert Gdk key events to GTK accelerator format.
- [x] Task: Verify conversion logic passes tests and commit. 6b980f4
- [x] Task: Conductor - User Manual Verification 'Phase 1: Research and Core Logic' (Protocol in workflow.md)

## Phase 2: Recording State and Visual Feedback
- [ ] Task: Write failing tests for recording state management (start, cancel, finish).
- [ ] Task: Implement `ShortcutRecorder` class or state machine in `prefs.js`.
- [ ] Task: Add CSS classes for "pulsing" effect and update `stylesheet.css`.
- [ ] Task: Verify state management and visual transitions and commit.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Recording UI' (Protocol in workflow.md)

## Phase 3: Conflict Checking and Validation
- [ ] Task: Write failing tests for shortcut conflict detection (internal and system).
- [ ] Task: Implement `_checkShortcutConflicts` method to scan existing `app-configs`.
- [ ] Task: Implement basic system shortcut conflict checking (best-effort).
- [ ] Task: Verify conflict detection logic and commit.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)

## Phase 4: Integration and Persistence
- [ ] Task: Integrate `ShortcutRecorder` into the application rows in the main preferences view.
- [ ] Task: Connect key capture to GSettings persistence logic.
- [ ] Task: Perform final integration testing of the entire flow (Record -> Validate -> Save -> Trigger).
- [ ] Task: Update documentation and commit.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Integration' (Protocol in workflow.md)
