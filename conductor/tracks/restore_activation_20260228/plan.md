# Implementation Plan: Restore Application Activation and Launch Functionality

This plan focuses on diagnosing and fixing the regression in application activation and launching.

## Phase 1: Diagnosis and Environment Setup
- [ ] Task: Setup debugging environment (Looking Glass, journalctl)
- [ ] Task: Reproduce the failure and identify the root cause of activation/launch regression
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Diagnosis' (Protocol in workflow.md)

## Phase 2: Restoration and Testing (Focus Logic)
- [ ] Task: Write failing test for focusing an existing window using `gdbus`
- [ ] Task: Implement fix for window focusing logic in `extension.js`
- [ ] Task: Verify focus logic passes tests and commit changes
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Focus Logic' (Protocol in workflow.md)

## Phase 3: Restoration and Testing (Launch Logic)
- [ ] Task: Write failing test for launching a non-running app using `gdbus`
- [ ] Task: Implement fix for application launching logic in `extension.js`
- [ ] Task: Verify launch logic passes tests and commit changes
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Launch Logic' (Protocol in workflow.md)

## Phase 4: Final Validation and Polish
- [ ] Task: Manual verification of all per-app shortcuts on both X11 and Wayland (if possible)
- [ ] Task: Update documentation and `.todo.md` with the resolution
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Validation' (Protocol in workflow.md)
