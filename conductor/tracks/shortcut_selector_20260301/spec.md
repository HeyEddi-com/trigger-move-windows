# Specification: Interactive Shortcut Selector

## Overview
Replace the current text-based shortcut entry with an interactive "Shortcut Recorder" similar to GNOME's native keyboard settings. This allows users to set shortcuts by pressing the desired key combination instead of typing strings like `<Super><Shift>m`.

## Functional Requirements
- **Inline Recording:** Clicking a shortcut button puts it into a "listening" state.
- **Key Capture:** Capture key combinations including modifiers (Super, Ctrl, Alt, Shift) and a primary key.
- **Validation & Conflict Checking:**
    - Detect if the pressed shortcut is already assigned to another application within the extension.
    - (Optional/Best Effort) Check for conflicts with common GNOME system shortcuts.
- **Visual Feedback:** Apply a "pulsing" effect or distinctive CSS class to the button while in recording mode.
- **Cancellation:** Pressing `Escape` exits recording mode without saving changes.
- **Persistence:** Save the captured shortcut in the standard GTK accelerator format (e.g., `<Super><Shift>a`) to GSettings.

## User Interactions
1. User clicks the "Shortcut" button for an application.
2. The button enters "Recording" mode:
    - Label changes to "New accelerator...".
    - Visual pulsing effect is applied.
3. User presses a key combination:
    - If valid: The combination is saved, recording ends, and the button updates to show the new shortcut.
    - If invalid/conflicting: Show a warning/feedback.
4. User presses `Escape` or clicks away:
    - Recording ends, and the previous shortcut is restored.

## Technical Details
- Use a `Gtk.EventControllerKey` or override the `key-pressed` signal on the widget to capture input.
- Convert `Gdk` keyvals and modifiers to the string format expected by GSettings.
- Update `prefs.js` to replace `_showShortcutDialog` logic with an inline state machine.

## Acceptance Criteria
- [ ] Clicking a shortcut button initiates recording.
- [ ] Key combinations are correctly captured and displayed in standard format (e.g., `Ctrl+Alt+T`).
- [ ] Pressing `Escape` cancels the operation.
- [ ] Conflicts within the extension are identified and reported to the user.
- [ ] The captured shortcut correctly triggers the application focus/launch logic in the main extension process.
