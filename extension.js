'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ME = 'trigger-move-windows@eddi.local';

export default class TriggerMoveWindows extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._appShortcuts = new Map(); // Track registered app shortcuts
  }

  enable() {
    log(`[${ME}] Enabling extension...`);

    try {
      // Initialize settings
      this._settings = this.getSettings('org.gnome.shell.extensions.trigger-move-windows');
      if (!this._settings) {
        throw new Error('Failed to initialize settings');
      }
      log(`[${ME}] Settings initialized successfully`);

      // Add keybindings
      this._addKeybindings();

      // Add individual app shortcuts
      this._addAppShortcuts();

      // Monitor settings changes to refresh shortcuts
      this._settingsChangedId = this._settings.connect('changed::app-configs', () => {
        log(`[${ME}] App configs changed, refreshing shortcuts...`);
        this._removeAppShortcuts();
        this._addAppShortcuts();
      });

      log(`[${ME}] Extension enabled successfully`);

    } catch (error) {
      logError(`[${ME}] Error during enable:`, error);
      Main.notify('Extension Error', `Failed to enable: ${error.message}`);
    }
  }

  disable() {
    log(`[${ME}] Disabling extension...`);

    try {
      // Remove main keybinding
      Main.wm.removeKeybinding('trigger-shortcut');
      log(`[${ME}] Main keybinding removed`);

      // Remove all app-specific shortcuts
      this._removeAppShortcuts();

      // Disconnect settings monitoring
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }

      // Clean up settings
      this._settings = null;

      log(`[${ME}] Extension disabled successfully`);
    } catch (error) {
      logError(`[${ME}] Error during disable:`, error);
    }
  }

  _addKeybindings() {
    try {
      log(`[${ME}] Adding keybinding...`);

      // Check current shortcut setting
      let currentShortcut = this._settings.get_strv('trigger-shortcut');
      log(`[${ME}] Current shortcut setting: ${JSON.stringify(currentShortcut)}`);

      // Always ensure we have a valid shortcut
      if (!currentShortcut || currentShortcut.length === 0 || currentShortcut[0] === '') {
        log(`[${ME}] No valid shortcut configured, setting default: <Super><Shift>m`);
        const defaultShortcut = ['<Super><Shift>m'];
        this._settings.set_strv('trigger-shortcut', defaultShortcut);
        currentShortcut = defaultShortcut;
        log(`[${ME}] Default shortcut applied: ${JSON.stringify(currentShortcut)}`);
      } else {
        log(`[${ME}] Using configured shortcut: ${JSON.stringify(currentShortcut)}`);
      }

      // Register the keybinding
      Main.wm.addKeybinding(
        'trigger-shortcut',
        this._settings,
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => {
          log(`[${ME}] *** KEYBOARD SHORTCUT PRESSED! ***`);
          this._onShortcutTriggered();
        }
      );

      // Verify final shortcut setting
      const finalShortcut = this._settings.get_strv('trigger-shortcut');
      log(`[${ME}] Keybinding registered successfully with: ${JSON.stringify(finalShortcut)}`);
      log(`[${ME}] Press ${finalShortcut[0]} to trigger window organization`);
    } catch (error) {
      logError(`[${ME}] Failed to add keybinding:`, error);
      throw error;
    }
  }

  _onShortcutTriggered() {
    log(`[${ME}] *** SHORTCUT HANDLER CALLED! ***`);

    try {
      // Show notification using simple Main.notify
      Main.notify('Window Organization', 'Organizing windows to configured workspaces...');
      log(`[${ME}] Notification sent: Window Organization`);

      // Debug: Show available GNOME APIs and running apps
      this._debugGnomeAPIs();

      // Execute window management logic
      this._organizeWindows();

      log(`[${ME}] Shortcut handler completed successfully`);

    } catch (error) {
      logError(`[${ME}] Error in shortcut handler:`, error);
      Main.notify('Error', `Failed to organize windows: ${error.message}`);
    }
  }

  _organizeWindows() {
    log(`[${ME}] Starting window organization...`);

    try {
      // Get configured applications from settings
      const configuredApps = this._getConfiguredApps();
      log(`[${ME}] Found ${Object.keys(configuredApps).length} configured applications`);

      if (Object.keys(configuredApps).length === 0) {
        Main.notify('No Configuration', 'No applications configured for workspace assignment');
        return;
      }

      // Use GNOME Shell's WindowTracker and AppSystem APIs
      const windowTracker = Shell.WindowTracker.get_default();
      const appSystem = Shell.AppSystem.get_default();

      // Get all windows using proper GNOME APIs
      const windows = global.get_window_actors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      log(`[${ME}] Found ${windows.length} normal windows`);

      let movedCount = 0;
      const processedApps = new Set();

      // Process each window with enhanced GNOME APIs
      windows.forEach(metaWindow => {
        const windowInfo = this._getEnhancedWindowInfo(metaWindow, windowTracker);
        log(`[${ME}] Processing window: ${windowInfo.title} (App: ${windowInfo.appId}, WM_CLASS: ${windowInfo.wmClass})`);

        // Find matching app configuration
        const matchingConfig = this._findMatchingAppEnhanced(windowInfo, configuredApps);

        if (matchingConfig) {
          const targetWorkspace = matchingConfig.workspace;
          log(`[${ME}] Found match for ${matchingConfig.appId} -> workspace ${targetWorkspace}`);

          // Move window to target workspace
          if (this._moveWindowToWorkspace(metaWindow, targetWorkspace)) {
            movedCount++;
            processedApps.add(matchingConfig.appId);
          }
        } else {
          log(`[${ME}] No configuration found for ${windowInfo.appId || windowInfo.wmClass}`);
        }
      });

      // Show completion notification
      if (movedCount > 0) {
        const appNames = Array.from(processedApps).join(', ');
        Main.notify('Organization Complete', `Moved ${movedCount} windows (${appNames}) to configured workspaces`);
        log(`[${ME}] Window organization completed: ${movedCount} windows moved for apps: ${appNames}`);
      } else {
        Main.notify('No Matches Found', 'No open windows matched configured applications');
        log(`[${ME}] Window organization completed: no windows moved`);
      }

    } catch (error) {
      logError(`[${ME}] Error organizing windows:`, error);
      throw error;
    }
  }

  _getConfiguredApps() {
    try {
      const configString = this._settings.get_string('app-configs');
      const configs = JSON.parse(configString);

      // Handle backward compatibility: if value is just a number, convert to object
      Object.keys(configs).forEach(appId => {
        if (typeof configs[appId] === 'number') {
          configs[appId] = { workspace: configs[appId], name: appId, shortcut: '' };
        }
      });

      return configs;
    } catch (error) {
      logError(`[${ME}] Error parsing app configs:`, error);
      return {};
    }
  }

  _getEnhancedWindowInfo(metaWindow, windowTracker) {
    const windowInfo = {
      title: metaWindow.get_title() || '',
      wmClass: metaWindow.get_wm_class() || '',
      process: '',
      appId: '',
      appName: '',
      currentWorkspace: metaWindow.get_workspace()?.index() || 0
    };

    // Get app information using WindowTracker
    try {
      const app = windowTracker.get_window_app(metaWindow);
      if (app) {
        windowInfo.appId = app.get_id() || '';
        windowInfo.appName = app.get_name() || '';
        log(`[${ME}] Window tracker found app: ${windowInfo.appId} (${windowInfo.appName})`);
      }
    } catch (error) {
      log(`[${ME}] Could not get app info from WindowTracker: ${error.message}`);
    }

    // Get process name as fallback
    try {
      const pid = metaWindow.get_pid();
      if (pid > 0) {
        windowInfo.process = this._getProcessName(pid);
      }
    } catch (error) {
      log(`[${ME}] Could not get process info: ${error.message}`);
    }

    return windowInfo;
  }

  _getWindowInfo(metaWindow) {
    const windowInfo = {
      title: metaWindow.get_title() || '',
      wmClass: metaWindow.get_wm_class() || '',
      process: '',
      currentWorkspace: metaWindow.get_workspace()?.index() || 0
    };

    // Get process name
    try {
      const pid = metaWindow.get_pid();
      if (pid > 0) {
        windowInfo.process = this._getProcessName(pid);
      }
    } catch (error) {
      log(`[${ME}] Could not get process info: ${error.message}`);
    }

    return windowInfo;
  }

  _getProcessName(pid) {
    try {
      const GLib = imports.gi.GLib;
      const [success, contents] = GLib.file_get_contents(`/proc/${pid}/comm`);
      if (success) {
        return imports.byteArray.toString(contents).trim();
      }
    } catch (error) {
      log(`[${ME}] Error reading process name for PID ${pid}: ${error.message}`);
    }
    return '';
  }

  _findMatchingAppEnhanced(windowInfo, configuredApps) {
    // Enhanced matching strategies using GNOME Shell APIs
    const matchStrategies = [
      { value: windowInfo.appId, priority: 1, type: 'App ID' },
      { value: windowInfo.wmClass, priority: 2, type: 'WM_CLASS' },
      { value: windowInfo.appName, priority: 3, type: 'App Name' },
      { value: windowInfo.process, priority: 4, type: 'Process' },
      { value: windowInfo.title, priority: 5, type: 'Title' }
    ];

    // Sort by priority and filter out empty values
    const validStrategies = matchStrategies
      .filter(strategy => strategy.value && strategy.value.trim())
      .sort((a, b) => a.priority - b.priority);

    for (const [appId, appConfig] of Object.entries(configuredApps)) {
      const appIdLower = appId.toLowerCase();

      // Handle both old format (number) and new format (object)
      const workspace = typeof appConfig === 'object' ? appConfig.workspace : appConfig;

      for (const strategy of validStrategies) {
        const matchValue = strategy.value.toLowerCase();

        // Try exact match first
        if (matchValue === appIdLower) {
          log(`[${ME}] Exact match: ${appId} with ${strategy.type} '${strategy.value}'`);
          return { appId, workspace };
        }

        // Try contains match
        if (matchValue.includes(appIdLower) || appIdLower.includes(matchValue)) {
          log(`[${ME}] Partial match: ${appId} with ${strategy.type} '${strategy.value}'`);
          return { appId, workspace };
        }
      }
    }

    return null;
  }

  _debugGnomeAPIs() {
    log(`[${ME}] === GNOME Shell API Debug Info ===`);

    try {
      // Show WindowTracker info
      const windowTracker = Shell.WindowTracker.get_default();
      log(`[${ME}] WindowTracker available: ${!!windowTracker}`);

      // Show AppSystem info
      const appSystem = Shell.AppSystem.get_default();
      log(`[${ME}] AppSystem available: ${!!appSystem}`);

      // List all running applications
      const runningApps = appSystem.get_running();
      log(`[${ME}] Found ${runningApps.length} running applications:`);

      runningApps.forEach(app => {
        const appId = app.get_id();
        const appName = app.get_name();
        const windows = app.get_windows();
        log(`[${ME}]   - ${appId} (${appName}) - ${windows.length} windows`);
      });

      // List all windows with their app associations
      log(`[${ME}] Window to App associations:`);
      const windows = global.get_window_actors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      windows.forEach(window => {
        const app = windowTracker.get_window_app(window);
        const title = window.get_title() || 'No Title';
        const wmClass = window.get_wm_class() || 'No WM_CLASS';
        const appId = app ? app.get_id() : 'No App';
        const appName = app ? app.get_name() : 'No App Name';

        log(`[${ME}]   Window: "${title}" | WM_CLASS: ${wmClass} | App: ${appId} (${appName})`);
      });

    } catch (error) {
      logError(`[${ME}] Error in GNOME API debug:`, error);
    }

    log(`[${ME}] === End GNOME Shell API Debug ===`);
  }

  _findMatchingApp(windowInfo, configuredApps) {
    // Try multiple matching strategies
    const matchStrategies = [
      windowInfo.wmClass?.toLowerCase(),
      windowInfo.process?.toLowerCase(),
      windowInfo.title?.toLowerCase()
    ];

    for (const [appId, appConfig] of Object.entries(configuredApps)) {
      const appIdLower = appId.toLowerCase();

      // Handle both old format (number) and new format (object)
      const workspace = typeof appConfig === 'object' ? appConfig.workspace : appConfig;

      for (const matchValue of matchStrategies) {
        if (matchValue && (
          matchValue === appIdLower ||
          matchValue.includes(appIdLower) ||
          appIdLower.includes(matchValue)
        )) {
          log(`[${ME}] Matched ${appId} with ${matchValue}`);
          return { appId, workspace };
        }
      }
    }

    return null;
  }

  _moveWindowToWorkspace(metaWindow, targetWorkspaceIndex) {
    try {
      const currentWorkspace = metaWindow.get_workspace();
      const currentIndex = currentWorkspace ? currentWorkspace.index() : 0;

      if (currentIndex === targetWorkspaceIndex - 1) {
        log(`[${ME}] Window already on target workspace ${targetWorkspaceIndex}`);
        return false;
      }

      // Get workspace manager
      const workspaceManager = global.workspace_manager;

      // Ensure target workspace exists
      const numWorkspaces = workspaceManager.get_n_workspaces();
      while (numWorkspaces < targetWorkspaceIndex) {
        workspaceManager.append_new_workspace(false, global.get_current_time());
        log(`[${ME}] Created new workspace ${workspaceManager.get_n_workspaces()}`);
      }

      // Get target workspace (convert from 1-based to 0-based)
      const targetWorkspace = workspaceManager.get_workspace_by_index(targetWorkspaceIndex - 1);

      if (!targetWorkspace) {
        log(`[${ME}] Could not find workspace ${targetWorkspaceIndex}`);
        return false;
      }

      // Move window
      metaWindow.change_workspace(targetWorkspace);
      log(`[${ME}] Moved window '${metaWindow.get_title()}' to workspace ${targetWorkspaceIndex}`);

      return true;

    } catch (error) {
      logError(`[${ME}] Error moving window to workspace ${targetWorkspaceIndex}:`, error);
      return false;
    }
  }

  _addAppShortcuts() {
    try {
      log(`[${ME}] Adding app-specific shortcuts...`);
      const configuredApps = this._getConfiguredApps();
      let shortcutCount = 0;

      Object.entries(configuredApps).forEach(([appId, appConfig]) => {
        const shortcut = typeof appConfig === 'object' ? appConfig.shortcut : '';
        if (shortcut && shortcut.trim()) {
          const shortcutId = `app-shortcut-${appId}`;

          try {
            // Set the shortcut value in GSettings (same pattern as main shortcut)
            this._settings.set_strv(shortcutId, [shortcut]);

            // Register the keybinding using same method as main shortcut
            Main.wm.addKeybinding(
              shortcutId,
              this._settings,
              Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
              Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
              () => {
                log(`[${ME}] *** APP SHORTCUT TRIGGERED for: ${appId} with ${shortcut} ***`);
                this._activateApp(appId);
              }
            );

            this._appShortcuts.set(appId, shortcutId);
            shortcutCount++;
            log(`[${ME}] Registered shortcut ${shortcut} for app: ${appId}`);

          } catch (error) {
            logError(`[${ME}] Failed to register shortcut for ${appId}:`, error);
          }
        }
      });

      log(`[${ME}] Registered ${shortcutCount} app shortcuts`);
    } catch (error) {
      logError(`[${ME}] Error adding app shortcuts:`, error);
    }
  }

  _removeAppShortcuts() {
    try {
      log(`[${ME}] Removing app shortcuts...`);
      let removedCount = 0;

      this._appShortcuts.forEach((shortcutId, appId) => {
        try {
          Main.wm.removeKeybinding(shortcutId);
          removedCount++;
          log(`[${ME}] Removed shortcut for app: ${appId}`);
        } catch (error) {
          logError(`[${ME}] Error removing shortcut for ${appId}:`, error);
        }
      });

      this._appShortcuts.clear();
      log(`[${ME}] Removed ${removedCount} app shortcuts`);
    } catch (error) {
      logError(`[${ME}] Error removing app shortcuts:`, error);
    }
  }

  _activateApp(appId) {
    try {
      log(`[${ME}] Activating app: ${appId}`);

      // Get app configuration
      const configuredApps = this._getConfiguredApps();
      const appConfig = configuredApps[appId];
      const displayName = typeof appConfig === 'object' ? appConfig.name : appId;

      // Find running windows for this app
      const windowTracker = Shell.WindowTracker.get_default();
      const windows = global.get_window_actors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      const matchingWindows = [];

      windows.forEach(metaWindow => {
        const windowInfo = this._getEnhancedWindowInfo(metaWindow, windowTracker);

        // Use same matching logic as window organization
        if (this._appMatches(windowInfo, appId)) {
          matchingWindows.push(metaWindow);
        }
      });

      if (matchingWindows.length > 0) {
        // Focus the most recent window
        const targetWindow = matchingWindows.sort((a, b) => {
          return b.get_user_time() - a.get_user_time();
        })[0];

        this._focusWindow(targetWindow);
        Main.notify('Window Activated', `Focused ${displayName}`);
        log(`[${ME}] Focused window for ${appId}: ${targetWindow.get_title()}`);
      } else {
        // Try to launch the application
        this._launchApp(appId, displayName);
      }

    } catch (error) {
      logError(`[${ME}] Error activating app ${appId}:`, error);
      Main.notify('Activation Error', `Failed to activate ${appId}`);
    }
  }

  _appMatches(windowInfo, appId) {
    const appIdLower = appId.toLowerCase();
    const matchStrategies = [
      { value: windowInfo.appId, priority: 1 },
      { value: windowInfo.wmClass, priority: 2 },
      { value: windowInfo.appName, priority: 3 },
      { value: windowInfo.process, priority: 4 },
      { value: windowInfo.title, priority: 5 }
    ];

    const validStrategies = matchStrategies
      .filter(strategy => strategy.value && strategy.value.trim())
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of validStrategies) {
      const matchValue = strategy.value.toLowerCase();
      if (matchValue === appIdLower ||
        matchValue.includes(appIdLower) ||
        appIdLower.includes(matchValue)) {
        return true;
      }
    }
    return false;
  }

  _focusWindow(metaWindow) {
    try {
      // Switch to the window's workspace
      const workspace = metaWindow.get_workspace();
      if (workspace) {
        workspace.activate(global.get_current_time());
      }

      // Activate and focus the window
      metaWindow.activate(global.get_current_time());
      metaWindow.focus(global.get_current_time());

    } catch (error) {
      logError(`[${ME}] Error focusing window:`, error);
    }
  }

  _launchApp(appId, displayName) {
    try {
      log(`[${ME}] Attempting to launch app: ${appId}`);

      // Try to find the app in the app system
      const appSystem = Shell.AppSystem.get_default();
      const app = appSystem.lookup_app(appId + '.desktop') ||
        appSystem.lookup_app(appId);

      if (app) {
        app.launch(0, -1, Shell.AppLaunchGpu.APP_PREF);
        Main.notify('Application Launched', `Started ${displayName}`);
        log(`[${ME}] Launched app: ${appId}`);
      } else {
        // Try launching via command line as fallback
        const subprocess = new Gio.Subprocess({
          argv: [appId],
          flags: Gio.SubprocessFlags.NONE
        });
        subprocess.init(null);

        Main.notify('Application Started', `Attempted to start ${displayName}`);
        log(`[${ME}] Attempted to launch via command: ${appId}`);
      }

    } catch (error) {
      logError(`[${ME}] Error launching app ${appId}:`, error);
      Main.notify('Launch Failed', `Could not start ${displayName}`);
    }
  }
}
