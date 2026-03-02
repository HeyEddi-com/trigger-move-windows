# Initial Concept
Automatically organize application windows across workspaces with a single keyboard shortcut.

# Product Vision
Trigger Move Windows is a productivity-focused GNOME Shell extension that empowers users to maintain a clean and organized workspace with zero manual effort. By mapping applications to specific workspaces and triggering organization with a single hotkey, users can instantly recover their ideal window layout, reducing context-switching friction and mental load.

# Target Users
- **Productivity Power Users:** Individuals who manage many applications simultaneously and require consistent window layouts.
- **Multitaskers:** Users who frequently switch between different sets of tools (e.g., development, communication, research).
- **GNOME Enthusiasts:** Users looking for native-feeling enhancements to the GNOME Shell experience.

# Key Features
- **One-Key Organization:** Instant movement of all configured applications to their designated workspaces via a global shortcut (default `Super+Shift+M`).
- **Flexible Window Matching:** Robust matching logic using `WM_CLASS`, window title, process name, and App ID to support standard, Electron, and Wayland/X11 applications.
- **Intelligent App Launching:** Automatically searches for matching installed applications even if their desktop file IDs don't perfectly match the configured ID.
- **Scalable Shortcut Management:** Support for a pool of custom shortcuts, allowing users to assign hotkeys to any application without extension-specific updates.
- **Customizable Preferences:** A user-friendly preferences UI to manage application-to-workspace mappings and toggle features like notifications and debug logging.
- **Interactive Application Browser:** Easily browse and search through all installed applications with icons to quickly add them to your configuration.
- **Visual Feedback:** Desktop notifications to confirm the results of window movement operations.
- **Wayland & X11 Support:** Full compatibility with modern Linux display servers.

# Functional Goals
- Provide a reliable and consistent window organization experience.
- Ensure easy configuration for new applications.
- Minimize manual window management overhead.

# Non-functional Goals
- **Performance:** Efficient window scanning that does not block the Shell's UI thread.
- **Reliability:** Graceful handling of edge cases (e.g., multiple windows of the same app, apps on already-correct workspaces).
- **Native Feel:** Adhere to GNOME design patterns and integration standards.

# Constraints
- Requires GNOME Shell 45 or newer (ESM support).
- Dependent on GNOME Shell APIs (Meta, Clutter, GJS).
