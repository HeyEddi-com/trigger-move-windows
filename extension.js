'use strict';

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ShellConfig from 'resource:///org/gnome/shell/misc/config.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { isValidTriggerAccelerator } from './lib/accelerator-validate.js';

const ME = 'trigger-move-windows@eddi.local';

/** @type {number} Parsed major from {@link ShellConfig.PACKAGE_VERSION} (e.g. 45 … 51). */
const SHELL_MAJOR = (() => {
  const v = ShellConfig.PACKAGE_VERSION || '0';
  const m = parseInt(String(v).split('.')[0], 10);
  return Number.isFinite(m) ? m : 0;
})();

export default class TriggerMoveWindows extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._appShortcuts = new Map(); // Track registered app shortcuts
    this._triggerShortcutChangedId = null;
  }

  enable() {
    console.debug(`[${ME}] Enabling extension...`);

    try {
      // Initialize settings
      this._settings = this.getSettings('org.gnome.shell.extensions.trigger-move-windows');
      if (!this._settings) {
        throw new Error('Failed to initialize settings');
      }
      console.debug(`[${ME}] Settings initialized successfully`);
      console.debug(`[${ME}] GNOME Shell ${ShellConfig.PACKAGE_VERSION} (parsed major ${SHELL_MAJOR})`);

      // Per-app shortcuts first so the global trigger is registered last and wins if the
      // same accelerator was accidentally assigned to an app.
      this._registerAppShortcuts();

      this._syncMainKeybinding();

      this._triggerShortcutChangedId = this._settings.connect('changed::trigger-shortcut', () => {
        console.debug(`[${ME}] trigger-shortcut setting changed, re-syncing main keybinding`);
        this._syncMainKeybinding();
      });

      // Monitor settings changes to refresh shortcuts
      this._settingsChangedId = this._settings.connect('changed::app-configs', () => {
        console.debug(`[${ME}] App configs changed, refreshing shortcuts...`);
        this._removeAppShortcuts();
        this._registerAppShortcuts();
        this._syncMainKeybinding();
      });

      console.debug(`[${ME}] Extension enabled successfully`);

    } catch (error) {
      console.error(error, `[${ME}] Error during enable:`);
      this._showNotification('Extension Error', `Failed to enable: ${error.message}`, 'error');
    }
  }

  disable() {
    console.debug(`[${ME}] Disabling extension...`);

    // Remove all app-specific shortcuts first
    this._removeAppShortcuts();

    if (this._settings) {
      if (this._triggerShortcutChangedId) {
        this._settings.disconnect(this._triggerShortcutChangedId);
        this._triggerShortcutChangedId = null;
      }

      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
    }

    Main.wm.removeKeybinding('trigger-shortcut');
    console.debug(`[${ME}] Main keybinding removed`);

    this._settings = null;

    console.debug(`[${ME}] Extension disabled successfully`);
  }

  // Helper method to show notifications based on settings
  _showNotification(title, message, notificationType = 'general') {
    // Check global notification setting first
    if (!this._settings.get_boolean('show-notifications')) {
      return;
    }

    // Check specific notification type settings
    let shouldShow = false;
    switch (notificationType) {
      case 'window-organization':
        shouldShow = this._settings.get_boolean('notify-window-organization');
        break;
      case 'window-focus':
        shouldShow = this._settings.get_boolean('notify-window-focus');
        break;
      case 'app-launch':
        shouldShow = this._settings.get_boolean('notify-app-launch');
        break;
      case 'error':
        shouldShow = this._settings.get_boolean('notify-errors');
        break;
      default:
        shouldShow = true; // Show general notifications if type not specified
    }

    if (shouldShow) {
      Main.notify(title, message);
      console.debug(`[${ME}] Notification shown: ${title} - ${message}`);
    } else {
      console.debug(`[${ME}] Notification suppressed (${notificationType}): ${title} - ${message}`);
    }
  }

  /**
   * Structural check for GTK-style accelerator strings (shared helper in lib/).
   */
  _isValidTriggerAccelerator(accel) {
    return isValidTriggerAccelerator(accel);
  }

  /** Keybinding modes for the global organizer shortcut (45–51). */
  _mainKeybindingActionModes() {
    if (Shell.ActionMode.ALL !== undefined)
      return Shell.ActionMode.ALL;
    let modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
    if (Shell.ActionMode.POPUP !== undefined)
      modes |= Shell.ActionMode.POPUP;
    return modes;
  }

  /** Keybinding modes for per-app shortcuts (45–51). */
  _appKeybindingActionModes() {
    let modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
    if (Shell.ActionMode.POPUP !== undefined)
      modes |= Shell.ActionMode.POPUP;
    return modes;
  }

  _getWindowActors() {
    try {
      if (typeof global.get_window_actors === 'function')
        return global.get_window_actors();
    } catch (e) {
      console.error(e, `[${ME}] global.get_window_actors failed:`);
    }
    try {
      const comp = global.compositor;
      if (comp && typeof comp.get_window_actors === 'function')
        return comp.get_window_actors();
    } catch (e) {
      console.error(e, `[${ME}] compositor.get_window_actors failed:`);
    }
    return [];
  }

  /**
   * Remove and re-add the main keybinding so reload / prefs updates cannot leave a stale
   * registration (Mutter rejects re-add without remove). Uses ALL action modes so the
   * shortcut is not blocked in uncommon Shell modes.
   */
  _syncMainKeybinding() {
    try {
      console.debug(`[${ME}] Syncing main keybinding...`);

      Main.wm.removeKeybinding('trigger-shortcut');

      // Check current shortcut setting
      let currentShortcut = this._settings.get_strv('trigger-shortcut');
      console.debug(`[${ME}] Current shortcut setting: ${JSON.stringify(currentShortcut)}`);

      const accel =
        currentShortcut && currentShortcut.length > 0 ? currentShortcut[0] : '';

      // Ensure a non-empty, structurally valid shortcut (fixes bad values from prefs or manual dconf edits)
      if (!this._isValidTriggerAccelerator(accel)) {
        console.debug(`[${ME}] Invalid or empty trigger shortcut (${JSON.stringify(accel)}), setting default: <Super><Shift>m`);
        const defaultShortcut = ['<Super><Shift>m'];
        this._settings.set_strv('trigger-shortcut', defaultShortcut);
        currentShortcut = defaultShortcut;
        console.debug(`[${ME}] Default shortcut applied: ${JSON.stringify(currentShortcut)}`);
      } else {
        console.debug(`[${ME}] Using configured shortcut: ${JSON.stringify(currentShortcut)}`);
      }

      const bindingAction = Main.wm.addKeybinding(
        'trigger-shortcut',
        this._settings,
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        this._mainKeybindingActionModes(),
        () => {
          console.debug(`[${ME}] *** KEYBOARD SHORTCUT PRESSED! ***`);
          this._onShortcutTriggered().catch(err => {
            console.error(err, `[${ME}] Shortcut handler promise rejected:`);
            this._showNotification('Error', `Failed to organize windows: ${err.message}`, 'error');
          });
        }
      );

      if (!bindingAction) {
        console.error(`[${ME}] addKeybinding returned NONE — main shortcut is not active (name collision or registration failure)`);
      } else {
        console.debug(`[${ME}] Main keybinding action id: ${bindingAction}`);
      }

      const finalShortcut = this._settings.get_strv('trigger-shortcut');
      console.debug(`[${ME}] Keybinding registered with: ${JSON.stringify(finalShortcut)} — press ${finalShortcut[0]} to organize windows`);
    } catch (error) {
      console.error(error, `[${ME}] Failed to sync main keybinding:`);
      throw error;
    }
  }

  async _onShortcutTriggered() {
    console.debug(`[${ME}] *** SHORTCUT HANDLER CALLED! ***`);

    try {
      // Show notification for window organization
      this._showNotification('Window Organization', 'Organizing windows to configured workspaces...', 'window-organization');

      // Debug: Show available GNOME APIs and running apps
      this._debugGnomeAPIs();

      // Execute window management logic
      await this._organizeWindows();

      console.debug(`[${ME}] Shortcut handler completed successfully`);

    } catch (error) {
      console.error(error, `[${ME}] Error in shortcut handler:`);
      this._showNotification('Error', `Failed to organize windows: ${error.message}`, 'error');
    }
  }

  async _organizeWindows() {
    console.debug(`[${ME}] Starting window organization...`);

    try {
      // Get configured applications from settings
      const configuredApps = this._getConfiguredApps();
      console.debug(`[${ME}] Found ${Object.keys(configuredApps).length} configured applications`);

      if (Object.keys(configuredApps).length === 0) {
        this._showNotification('No Configuration', 'No applications configured for workspace assignment', 'window-organization');
        return;
      }

      // Use GNOME Shell's WindowTracker and AppSystem APIs
      const windowTracker = Shell.WindowTracker.get_default();
      const appSystem = Shell.AppSystem.get_default();

      // Get all windows using proper GNOME APIs
      const windows = this._getWindowActors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      console.debug(`[${ME}] Found ${windows.length} normal windows`);

      let movedCount = 0;
      const processedApps = new Set();

      // Process each window with enhanced GNOME APIs
      for (const metaWindow of windows) {
        const windowInfo = await this._getEnhancedWindowInfo(metaWindow, windowTracker);
        console.debug(`[${ME}] Processing window: ${windowInfo.title} (App: ${windowInfo.appId}, WM_CLASS: ${windowInfo.wmClass})`);

        // Find matching app configuration
        const matchingConfig = this._findMatchingAppEnhanced(windowInfo, configuredApps);

        if (matchingConfig) {
          const targetWorkspace = matchingConfig.workspace;
          console.debug(`[${ME}] Found match for ${matchingConfig.appId} -> workspace ${targetWorkspace}`);

          // Move window to target workspace
          if (this._moveWindowToWorkspace(metaWindow, targetWorkspace)) {
            movedCount++;
            processedApps.add(matchingConfig.appId);
          }
        } else {
          console.debug(`[${ME}] No configuration found for ${windowInfo.appId || windowInfo.wmClass}`);
        }
      }

      // Show completion notification
      if (movedCount > 0) {
        const appNames = Array.from(processedApps).join(', ');
        this._showNotification('Organization Complete', `Moved ${movedCount} windows (${appNames}) to configured workspaces`, 'window-organization');
        console.debug(`[${ME}] Window organization completed: ${movedCount} windows moved for apps: ${appNames}`);
      } else {
        this._showNotification('No Matches Found', 'No open windows matched configured applications', 'window-organization');
        console.debug(`[${ME}] Window organization completed: no windows moved`);
      }

    } catch (error) {
      console.error(error, `[${ME}] Error organizing windows:`);
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
      console.error(error, `[${ME}] Error parsing app configs:`);
      return {};
    }
  }

  async _getEnhancedWindowInfo(metaWindow, windowTracker) {
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
        console.debug(`[${ME}] Window tracker found app: ${windowInfo.appId} (${windowInfo.appName})`);
      }
    } catch (error) {
      console.debug(`[${ME}] Could not get app info from WindowTracker: ${error.message}`);
    }

    // Get process name as fallback (async: avoid blocking the Shell main loop)
    try {
      const pid = metaWindow.get_pid();
      if (pid > 0)
        windowInfo.process = await this._getProcessNameAsync(pid);
    } catch (error) {
      console.debug(`[${ME}] Could not get process info: ${error.message}`);
    }

    return windowInfo;
  }

  async _getWindowInfo(metaWindow) {
    const windowInfo = {
      title: metaWindow.get_title() || '',
      wmClass: metaWindow.get_wm_class() || '',
      process: '',
      currentWorkspace: metaWindow.get_workspace()?.index() || 0
    };

    try {
      const pid = metaWindow.get_pid();
      if (pid > 0)
        windowInfo.process = await this._getProcessNameAsync(pid);
    } catch (error) {
      console.debug(`[${ME}] Could not get process info: ${error.message}`);
    }

    return windowInfo;
  }

  /**
   * Async read of /proc/[pid]/comm so the Shell thread never does synchronous file IO
   * (EGO-X-004; see gjs.guide guides/gio/file-operations).
   */
  _getProcessNameAsync(pid) {
    return new Promise(resolve => {
      if (pid <= 0) {
        resolve('');
        return;
      }

      const path = `/proc/${pid}/comm`;
      const file = Gio.File.new_for_path(path);

      file.load_contents_async(null, (f, res) => {
        try {
          const [ok, contents] = f.load_contents_finish(res);
          if (!ok || !contents) {
            resolve('');
            return;
          }
          const bytes = typeof contents.get_data === 'function' ? contents.get_data() : contents;
          if (bytes instanceof Uint8Array)
            resolve(new TextDecoder().decode(bytes).trim());
          else if (typeof imports !== 'undefined' && imports.byteArray)
            resolve(imports.byteArray.toString(bytes).trim());
          else
            resolve(String(bytes).trim());
        } catch (error) {
          console.debug(`[${ME}] Error reading process name for PID ${pid}: ${error.message}`);
          resolve('');
        }
      });
    });
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
          console.debug(`[${ME}] Exact match: ${appId} with ${strategy.type} '${strategy.value}'`);
          return { appId, workspace };
        }

        // Try contains match
        if (matchValue.includes(appIdLower) || appIdLower.includes(matchValue)) {
          console.debug(`[${ME}] Partial match: ${appId} with ${strategy.type} '${strategy.value}'`);
          return { appId, workspace };
        }
      }
    }

    return null;
  }

  _debugGnomeAPIs() {
    console.debug(`[${ME}] === GNOME Shell API Debug Info ===`);

    try {
      // Show WindowTracker info
      const windowTracker = Shell.WindowTracker.get_default();
      console.debug(`[${ME}] WindowTracker available: ${!!windowTracker}`);

      // Show AppSystem info
      const appSystem = Shell.AppSystem.get_default();
      console.debug(`[${ME}] AppSystem available: ${!!appSystem}`);

      // List all running applications
      const runningApps = appSystem.get_running();
      console.debug(`[${ME}] Found ${runningApps.length} running applications:`);

      runningApps.forEach(app => {
        const appId = app.get_id();
        const appName = app.get_name();
        const windows = app.get_windows();
        console.debug(`[${ME}]   - ${appId} (${appName}) - ${windows.length} windows`);
      });

      // List all windows with their app associations
      console.debug(`[${ME}] Window to App associations:`);
      const windows = this._getWindowActors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      windows.forEach(window => {
        const app = windowTracker.get_window_app(window);
        const title = window.get_title() || 'No Title';
        const wmClass = window.get_wm_class() || 'No WM_CLASS';
        const appId = app ? app.get_id() : 'No App';
        const appName = app ? app.get_name() : 'No App Name';

        console.debug(`[${ME}]   Window: "${title}" | WM_CLASS: ${wmClass} | App: ${appId} (${appName})`);
      });

    } catch (error) {
      console.error(error, `[${ME}] Error in GNOME API debug:`);
    }

    console.debug(`[${ME}] === End GNOME Shell API Debug ===`);
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
          console.debug(`[${ME}] Matched ${appId} with ${matchValue}`);
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
        console.debug(`[${ME}] Window already on target workspace ${targetWorkspaceIndex}`);
        return false;
      }

      // Get workspace manager
      const workspaceManager = global.workspace_manager;

      // Ensure target workspace exists
      while (workspaceManager.get_n_workspaces() < targetWorkspaceIndex) {
        workspaceManager.append_new_workspace(false, global.get_current_time());
        console.debug(`[${ME}] Created new workspace ${workspaceManager.get_n_workspaces()}`);
      }

      // Get target workspace (convert from 1-based to 0-based)
      const targetWorkspace = workspaceManager.get_workspace_by_index(targetWorkspaceIndex - 1);

      if (!targetWorkspace) {
        console.debug(`[${ME}] Could not find workspace ${targetWorkspaceIndex}`);
        return false;
      }

      // Move window
      metaWindow.change_workspace(targetWorkspace);
      console.debug(`[${ME}] Moved window '${metaWindow.get_title()}' to workspace ${targetWorkspaceIndex}`);

      return true;

    } catch (error) {
      console.error(error, `[${ME}] Error moving window to workspace ${targetWorkspaceIndex}:`);
      return false;
    }
  }

  _registerAppShortcuts() {
    try {
      console.debug(`[${ME}] Registering app-specific shortcuts (Dynamic Logic)...`);
      const configuredApps = this._getConfiguredApps();
      let shortcutCount = 0;
      
      // Get list of available keys in the schema
      const availableKeys = this._settings.list_keys();

      Object.entries(configuredApps).forEach(([appId, appConfig]) => {
        const shortcut = typeof appConfig === 'object' ? appConfig.shortcut : '';
        if (shortcut && shortcut.trim()) {
          // Normalize ID for lookup
          const normalizedId = appId.toLowerCase()
            .replace('.desktop', '')
            .replace(/\./g, '-');
            
          let schemaKey = `app-shortcut-${normalizedId}`;
          
          // Check if we have a matching schema key
          if (!availableKeys.includes(schemaKey)) {
            // Fallback to pool if specific key missing
            console.debug(`[${ME}] Schema key ${schemaKey} missing, searching for available pool key...`);
            
            // Look for first available custom-n key not in use
            for (let i = 1; i <= 10; i++) {
              let poolKey = `app-shortcut-custom-${i}`;
              if (!Array.from(this._appShortcuts.values()).includes(poolKey)) {
                schemaKey = poolKey;
                break;
              }
            }
          }

          if (!availableKeys.includes(schemaKey)) {
            console.debug(`[${ME}] Could not find ANY valid schema key for ${appId}`);
            return;
          }

          try {
            console.debug(`[${ME}] Attempting to bind ${shortcut} to ${appId} using ${schemaKey}`);
            
            // Update the setting value first
            this._settings.set_strv(schemaKey, [shortcut]);

            // Register with GNOME Shell
            Main.wm.addKeybinding(
              schemaKey,
              this._settings,
              Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
              this._appKeybindingActionModes(),
              () => {
                console.debug(`[${ME}] *** APP SHORTCUT TRIGGERED: ${appId} ***`);
                this._activateApp(appId).catch(err => {
                  console.error(err, `[${ME}] App shortcut handler rejected:`);
                });
              }
            );

            this._appShortcuts.set(appId, schemaKey);
            shortcutCount++;
            console.debug(`[${ME}] SUCCESSFULLY registered ${appId} on ${schemaKey}`);

          } catch (error) {
            console.error(error, `[${ME}] FAILED to register ${appId}:`);
          }
        }
      });

      console.debug(`[${ME}] Finished: ${shortcutCount} shortcuts registered`);
    } catch (error) {
      console.error(error, `[${ME}] Error in _registerAppShortcuts:`);
    }
  }

  _removeAppShortcuts() {
    try {
      console.debug(`[${ME}] Removing app shortcuts...`);
      let removedCount = 0;

      this._appShortcuts.forEach((shortcutId, appId) => {
        Main.wm.removeKeybinding(shortcutId);
        removedCount++;
        console.debug(`[${ME}] Removed shortcut for app: ${appId}`);
      });

      this._appShortcuts.clear();
      console.debug(`[${ME}] Removed ${removedCount} app shortcuts`);
    } catch (error) {
      console.error(error, `[${ME}] Error removing app shortcuts:`);
    }
  }

  async _activateApp(appId) {
    try {
      console.debug(`[${ME}] Activating app: ${appId}`);

      // Get app configuration
      const configuredApps = this._getConfiguredApps();
      const appConfig = configuredApps[appId];
      const displayName = typeof appConfig === 'object' ? appConfig.name : appId;

      // Find running windows for this app
      const windowTracker = Shell.WindowTracker.get_default();
      const windows = this._getWindowActors()
        .map(actor => actor.get_meta_window())
        .filter(window => window && window.get_window_type() === Meta.WindowType.NORMAL);

      const matchingWindows = [];

      for (const metaWindow of windows) {
        const windowInfo = await this._getEnhancedWindowInfo(metaWindow, windowTracker);

        // Use same matching logic as window organization
        if (this._appMatches(windowInfo, appConfig, appId))
          matchingWindows.push(metaWindow);
      }

      if (matchingWindows.length > 0) {
        // Focus the most recent window
        const targetWindow = matchingWindows.sort((a, b) => {
          return b.get_user_time() - a.get_user_time();
        })[0];

        this._focusWindow(targetWindow);
        this._showNotification('Window Activated', `Focused ${displayName}`, 'window-focus');
        console.debug(`[${ME}] Focused window for ${appId}: ${targetWindow.get_title()}`);
      } else {
        // Try to launch the application
        this._launchApp(appId, displayName);
      }

    } catch (error) {
      console.error(error, `[${ME}] Error activating app ${appId}:`);
      this._showNotification('Activation Error', `Failed to activate ${appId}`, 'error');
    }
  }

  _appMatches(windowInfo, appConfig, appId) {
    // First try verified properties if available
    if (appConfig && appConfig.verified) {
      const verified = appConfig.verified;

      // Check exact matches against verified properties
      if (verified.wmClass && windowInfo.wmClass === verified.wmClass) {
        console.debug(`[${ME}] Verified match by WM_CLASS: ${verified.wmClass}`);
        return true;
      }
      if (verified.appId && windowInfo.appId === verified.appId) {
        console.debug(`[${ME}] Verified match by App ID: ${verified.appId}`);
        return true;
      }
      if (verified.process && windowInfo.process === verified.process) {
        console.debug(`[${ME}] Verified match by Process: ${verified.process}`);
        return true;
      }
      if (verified.appName && windowInfo.appName === verified.appName) {
        console.debug(`[${ME}] Verified match by App Name: ${verified.appName}`);
        return true;
      }

      console.debug(`[${ME}] No verified match found, using fallback matching for ${appId}`);
    }

    // Fallback to fuzzy matching for apps without verified data
    const appIdLower = appId.toLowerCase();
    const matchStrategies = [
      { value: windowInfo.appId, priority: 1, type: 'appId' },
      { value: windowInfo.wmClass, priority: 2, type: 'wmClass' },
      { value: windowInfo.appName, priority: 3, type: 'appName' },
      { value: windowInfo.process, priority: 4, type: 'process' },
      { value: windowInfo.title, priority: 5, type: 'title' }
    ];

    const validStrategies = matchStrategies
      .filter(strategy => strategy.value && strategy.value.trim())
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of validStrategies) {
      const matchValue = strategy.value.toLowerCase();

      // Exact match always wins
      if (matchValue === appIdLower) {
        return true;
      }

      // For high-priority fields (appId, wmClass, appName), be more strict
      if (strategy.priority <= 3) {
        // Only allow contains match if the config is shorter (searching within the window property)
        if (matchValue.includes(appIdLower) && appIdLower.length >= 3) {
          return true;
        }
      }

      // For title matches, allow partial matching both ways
      if (strategy.type === 'title') {
        if (matchValue.includes(appIdLower) || appIdLower.includes(matchValue)) {
          return true;
        }
      }

      // For process names, be very careful with electron apps
      if (strategy.type === 'process') {
        // Avoid generic electron matches unless very specific
        if (appIdLower.includes('electron') && matchValue.includes('electron')) {
          // Only match if we have a specific identifier beyond just 'electron'
          const appParts = appIdLower.split(/[-_]/);
          const processParts = matchValue.split(/[-_]/);

          for (const appPart of appParts) {
            if (appPart !== 'electron' && appPart.length >= 3) {
              for (const processPart of processParts) {
                if (processPart.includes(appPart) || appPart.includes(processPart)) {
                  return true;
                }
              }
            }
          }
        } else {
          // Non-electron process matching
          if (matchValue.includes(appIdLower) && appIdLower.length >= 3) {
            return true;
          }
        }
      }
    }
    return false;
  }

  _focusWindow(metaWindow) {
    try {
      const display = global.display;
      const windowTracker = Shell.WindowTracker.get_default();
      const app = windowTracker.get_window_app(metaWindow);
      const appName = app ? app.get_name() : metaWindow.get_title();

      console.debug(`[${ME}] Focusing window: ${metaWindow.get_title()} for app: ${appName}`);

      // Switch to the window's workspace
      const workspace = metaWindow.get_workspace();
      if (workspace) {
        console.debug(`[${ME}] Switching to workspace ${workspace.index() + 1}`);
        workspace.activate(display.get_current_time());
      }

      // Activate and focus the window
      // Use Meta.display.get_current_time() or 0 for activation
      const timestamp = display.get_current_time() || 0;
      metaWindow.activate(timestamp);
      
      // Ensure it's on the current monitor if multi-monitor
      // metaWindow.move_to_monitor(display.get_current_monitor());

      console.debug(`[${ME}] Window activated successfully`);

    } catch (error) {
      console.error(error, `[${ME}] Error focusing window:`);
    }
  }

  /**
   * `Shell.AppLaunchGpu` exists from GNOME 48 onward; older Shells use the third launch
   * flag as 0 (no GPU preference).
   */
  _launchAppPreferred(app) {
    const timestamp = global.get_current_time();
    const workspace = -1;
    const gpuPref = Shell.AppLaunchGpu?.APP_PREF;
    if (gpuPref !== undefined)
      app.launch(timestamp, workspace, gpuPref);
    else
      app.launch(timestamp, workspace, 0);
  }

  _launchApp(appId, displayName) {
    try {
      console.debug(`[${ME}] Attempting to launch app: ${appId} (DisplayName: ${displayName})`);

      // Try to find the app in the app system
      const appSystem = Shell.AppSystem.get_default();
      let app = appSystem.lookup_app(appId + '.desktop') ||
        appSystem.lookup_app(appId);

      // If exact ID lookup fails, search for an app with a matching name or command
      if (!app) {
        console.debug(`[${ME}] Exact app ID lookup failed for '${appId}', searching installed apps...`);
        const installedApps = appSystem.get_installed();
        
        const appIdLower = appId.toLowerCase();
        const nameLower = displayName.toLowerCase();

        // Search for best match in installed apps
        for (const installedApp of installedApps) {
          const installedId = installedApp.get_id().toLowerCase();
          const installedName = installedApp.get_name().toLowerCase();
          const installedDesc = installedApp.get_description() ? installedApp.get_description().toLowerCase() : '';

          // Look for various matches
          if (installedId.includes(appIdLower) || 
              appIdLower.includes(installedId) ||
              installedName === nameLower ||
              installedName === appIdLower ||
              (nameLower.length >= 3 && installedName.includes(nameLower)) ||
              (appIdLower.length >= 3 && installedName.includes(appIdLower))) {
            
            console.debug(`[${ME}] Found potential match in installed apps: ${installedApp.get_id()} (${installedApp.get_name()})`);
            app = installedApp;
            break;
          }
        }
      }

      if (app) {
        console.debug(`[${ME}] Launching app: ${app.get_id()} (${app.get_name()})`);
        this._launchAppPreferred(app);
        this._showNotification('Application Launched', `Started ${app.get_name() || displayName}`, 'app-launch');
      } else {
        // Try launching via command line as absolute fallback
        console.debug(`[${ME}] Still no app found in system, trying command-line fallback for: ${appId}`);
        const subprocess = new Gio.Subprocess({
          argv: [appId],
          flags: Gio.SubprocessFlags.NONE
        });
        subprocess.init(null);

        this._showNotification('Application Started', `Attempted to start ${displayName}`, 'app-launch');
      }

    } catch (error) {
      console.error(error, `[${ME}] Error launching app ${appId}:`);
      this._showNotification('Launch Failed', `Could not start ${displayName}: ${error.message}`, 'error');
    }
  }
}
