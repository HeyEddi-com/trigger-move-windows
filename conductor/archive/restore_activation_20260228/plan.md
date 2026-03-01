# Implementation Plan: Restore Application Activation and Launch Functionality

This plan focuses on diagnosing and fixing the regression in application activation and launching.

## Phase 1: Diagnosis and Environment Setup
- [x] Task: Setup debugging environment (Looking Glass, journalctl)
- [x] Task: Reproduce the failure and identify the root cause of activation/launch regression
- [~] Task: Conductor - User Manual Verification 'Phase 1: Diagnosis' (Protocol in workflow.md)

## Phase 2: Restoration and Testing (Focus Logic)
- [x] Task: Improve window matching and focusing logic for better reliability
- [x] Task: Fix GSettings schema to include missing app shortcut keys (e.g., thunderbird)
- [~] Task: Conductor - User Manual Verification 'Phase 2: Focus Logic' (Protocol in workflow.md)

## Phase 3: Restoration and Testing (Launch Logic)
- [x] Task: Improve application launch logic to search for installed desktop files
- [x] Task: Verify launch logic works for apps with non-matching IDs (like thunderbird)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Launch Logic' (Protocol in workflow.md)

## Phase 4: Final Validation and Polish
- [x] Task: Manual verification of all per-app shortcuts on both X11 and Wayland (if possible)
- [x] Task: Update documentation and `.todo.md` with the resolution
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Validation' (Protocol in workflow.md)
