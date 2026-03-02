/* prefs.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Pango from 'gi://Pango';


import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Handles recording keyboard shortcuts in the preferences UI
 */
class ShortcutRecorder {
  constructor(button, settings, appId, formatLabelFunc, updateShortcutFunc, checkConflictFunc, statusCallback) {
    this._button = button;
    this._settings = settings;
    this._appId = appId;
    this._formatLabelFunc = formatLabelFunc;
    this._updateShortcutFunc = updateShortcutFunc;
    this._checkConflictFunc = checkConflictFunc;
    this._statusCallback = statusCallback;
    this._state = 'IDLE';
    this._originalLabel = button.label;
    this._originalShortcut = ''; 

    this._controller = new Gtk.EventControllerKey();
    this._button.add_controller(this._controller);

    this._controller.connect('key-pressed', (controller, keyval, keycode, state) => {
      return this._onKeyPressed(keyval, state);
    });
  }

  _onKeyPressed(keyval, state) {
    log(`[TriggerMoveWindows] Key pressed: val=${keyval}, state=${state}`);
    if (this._state !== 'RECORDING') {
      return false;
    }

    // Handle Escape for cancellation
    if (keyval === Gdk.KEY_Escape) {
      this.stop(false);
      return true;
    }

    // Handle BackSpace or Delete to clear
    if (keyval === Gdk.KEY_BackSpace || keyval === Gdk.KEY_Delete) {
      this._newShortcut = '';
      this.stop(true);
      return true;
    }

    // Get modifiers
    const mask = state & Gtk.accelerator_get_default_mod_mask();
    
    // We need at least one modifier or a function key
    const isModifier = (keyval === Gdk.KEY_Control_L || keyval === Gdk.KEY_Control_R ||
                        keyval === Gdk.KEY_Alt_L || keyval === Gdk.KEY_Alt_R ||
                        keyval === Gdk.KEY_Shift_L || keyval === Gdk.KEY_Shift_R ||
                        keyval === Gdk.KEY_Super_L || keyval === Gdk.KEY_Super_R);

    if (isModifier) {
      // Just modifiers pressed, keep recording
      return true;
    }

    // Convert to string
    const shortcut = Gtk.accelerator_name(keyval, mask);
    if (shortcut) {
      // Check for conflicts
      const conflict = this._checkConflictFunc(this._settings, this._appId, shortcut);
      if (conflict) {
        let msg = '';
        if (conflict.type === 'internal') {
          msg = _(`Shortcut already used by: ${conflict.name}`);
        } else {
          msg = _(`Shortcut conflicts with system: ${conflict.name}`);
        }
        
        // Temporarily change label to show conflict
        this._button.label = msg;
        this._button.add_css_class('error');
        
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
          if (this._state === 'RECORDING') {
            this._button.label = _('Recording…');
            this._button.remove_css_class('error');
          }
          return GLib.SOURCE_REMOVE;
        });
        
        return true;
      }

      this._newShortcut = shortcut;
      this.stop(true);
      return true;
    }

    return false;
  }

  start() {
    if (this._state === 'RECORDING') return;

    this._state = 'RECORDING';
    this._button.set_focusable(true);
    this._button.set_can_focus(true);
    this._button.add_css_class('recording');
    this._button.label = _('Recording…');
    this._button.grab_focus();
    
    if (this._statusCallback) {
      this._statusCallback(_('Press any key to set shortcut. BackSpace to clear, Esc to cancel.'));
    }
    
    log(`[TriggerMoveWindows] Started recording shortcut for ${this._appId}`);
  }

  stop(save = true) {
    if (this._state !== 'RECORDING') return;

    this._state = 'IDLE';
    this._button.remove_css_class('recording');
    
    if (this._statusCallback) {
      this._statusCallback(null);
    }

    if (save) {
      log(`[TriggerMoveWindows] Saving shortcut for ${this._appId}: "${this._newShortcut}"`);
      this._updateShortcutFunc(this._settings, this._appId, this._newShortcut);
      this._button.label = this._formatLabelFunc([this._newShortcut]);
    } else {
      log(`[TriggerMoveWindows] Cancelled recording for ${this._appId}`);
      this._button.label = this._originalLabel;
    }
  }
}

export default class TriggerMoveWindowsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings('org.gnome.shell.extensions.trigger-move-windows');

    // Create main page
    const page = new Adw.PreferencesPage({
      title: _('Trigger Move Windows'),
      icon_name: 'preferences-desktop-keyboard-shortcuts',
    });
    window.add(page);

    // General Settings Group
    const generalGroup = new Adw.PreferencesGroup({
      title: _('General Settings'),
      description: _('Configure global extension behavior'),
    });
    page.add(generalGroup);

    // Global shortcut configuration
    this._createGlobalShortcutRow(generalGroup, settings, window);

    // Application Management Group
    const appManagementGroup = new Adw.PreferencesGroup({
      title: _('Application Management'),
      description: _('Configure applications and their workspace assignments'),
    });
    page.add(appManagementGroup);

    // Configured applications list - store reference for refreshing
    this._appManagementGroup = appManagementGroup;
    this._createConfiguredAppsList(appManagementGroup, settings, window);

    // Notification Settings Group
    const notificationGroup = new Adw.PreferencesGroup({
      title: _('Notification Settings'),
      description: _('Configure when to show desktop notifications'),
    });
    page.add(notificationGroup);

    // Master notification toggle
    const showNotificationsRow = new Adw.SwitchRow({
      title: _('Enable Notifications'),
      subtitle: _('Show desktop notifications for extension activities'),
    });
    settings.bind('show-notifications', showNotificationsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    notificationGroup.add(showNotificationsRow);

    // Window organization notifications
    const windowOrgRow = new Adw.SwitchRow({
      title: _('Window Organization'),
      subtitle: _('Show notifications when organizing windows to workspaces'),
    });
    settings.bind('notify-window-organization', windowOrgRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    notificationGroup.add(windowOrgRow);

    // Window focus notifications
    const windowFocusRow = new Adw.SwitchRow({
      title: _('Window Focus'),
      subtitle: _('Show notifications when focusing/activating windows'),
    });
    settings.bind('notify-window-focus', windowFocusRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    notificationGroup.add(windowFocusRow);

    // Application launch notifications
    const appLaunchRow = new Adw.SwitchRow({
      title: _('Application Launch'),
      subtitle: _('Show notifications when starting applications'),
    });
    settings.bind('notify-app-launch', appLaunchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    notificationGroup.add(appLaunchRow);

    // Error notifications
    const errorRow = new Adw.SwitchRow({
      title: _('Error Messages'),
      subtitle: _('Show notifications for errors and failures'),
    });
    settings.bind('notify-errors', errorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    notificationGroup.add(errorRow);

    // Bind notification rows to master toggle for sensitivity
    settings.bind('show-notifications', windowOrgRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('show-notifications', windowFocusRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('show-notifications', appLaunchRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('show-notifications', errorRow, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

  }

  _createConfiguredAppsList(group, settings, window) {
    // Store references for refreshing
    this._settings = settings;
    this._window = window;
    const configuredApps = this._parseAppConfigs(settings);
    const availableWorkspaces = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Create header row with add button
    const headerRow = new Adw.ActionRow({
      title: _('Configured Applications'),
      subtitle: _('Applications with assigned workspaces and shortcuts'),
    });

    const addButton = new Gtk.Button({
      icon_name: 'list-add-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Add Application'),
    });
    addButton.add_css_class('suggested-action');
    addButton.connect('clicked', () => {
      this._showAddAppDialog(window, settings, (appId, workspace) => {
        // Add new app row directly to existing list
        this._addNewAppRow(appId, workspace);
      });
    });
    headerRow.add_suffix(addButton);
    group.add(headerRow);

    // Create scrolled area for applications
    const scrolledWindow = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      max_content_height: 1200,
      min_content_height: 800,
    });

    const appListBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    appListBox.add_css_class('boxed-list');
    scrolledWindow.set_child(appListBox);

    // Store reference to app list box for direct updates
    this._appListBox = appListBox;

    // Add configured applications to the list
    Object.entries(configuredApps).forEach(([appId, appConfig]) => {
      const app = {
        app_id: appId,
        name: appConfig.name || appId,
        workspace: appConfig.workspace || appConfig,
        shortcut: appConfig.shortcut || ''
      };
      this._addAppRow(appListBox, settings, app, availableWorkspaces, (appToRemove) => {
        // Remove specific app row directly
        this._removeAppRow(appToRemove);
      });
    });

    // Create container row
    const containerRow = new Adw.PreferencesRow();
    const containerBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 6,
      margin_bottom: 6,
      margin_start: 12,
      margin_end: 12,
    });
    containerBox.append(scrolledWindow);
    containerRow.set_child(containerBox);
    group.add(containerRow);
  }

  _addAppRow(listBox, settings, app, availableWorkspaces, removeCallback) {
    const row = new Gtk.ListBoxRow();
    // Store app info on the row for easy identification
    row._appInfo = { appId: app.app_id, workspace: app.workspace };

    const mainBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      margin_top: 8,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });

    // App info row
    const infoBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    });

    const appLabel = new Gtk.Label({
      label: app.name || app.app_id,
      hexpand: true,
      xalign: 0,
    });
    appLabel.add_css_class('heading');

    const buttonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });

    const editButton = new Gtk.Button({
      icon_name: 'document-edit-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Edit Application'),
    });
    editButton.connect('clicked', () => {
      // Get current configuration from storage to show latest values
      const currentConfigs = this._parseAppConfigs(settings);
      const currentConfig = currentConfigs[app.app_id] || app;
      const currentApp = {
        app_id: app.app_id,
        name: currentConfig.name || app.app_id,
        workspace: currentConfig.workspace || app.workspace,
        shortcut: currentConfig.shortcut || app.shortcut || ''
      };

      this._showEditAppDialog(listBox.get_root(), settings, currentApp, (newAppId, newName) => {
        // If app ID changed, we need to remove old config and add new one
        if (newAppId !== app.app_id) {
          this._removeAppConfig(settings, app.app_id);
          removeCallback(app.app_id);
          // Add new app with new ID
          const configs = this._parseAppConfigs(settings);
          configs[newAppId] = { name: newName, workspace: app.workspace, shortcut: app.shortcut || '' };
          settings.set_string('app-configs', JSON.stringify(configs));
          // Add new row
          this._addNewAppRow(newAppId, app.workspace);
        } else {
          // Just update display name
          appLabel.set_label(newName);
          this._updateAppDisplayName(settings, app.app_id, newName);
        }
      });
    });

    const removeButton = new Gtk.Button({
      icon_name: 'edit-delete-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Remove Application'),
    });
    removeButton.add_css_class('destructive-action');
    removeButton.connect('clicked', () => {
      this._removeAppConfig(settings, app.app_id);
      removeCallback(app.app_id);
    });

    buttonBox.append(editButton);
    buttonBox.append(removeButton);

    infoBox.append(appLabel);
    infoBox.append(buttonBox);

    // Settings row
    const settingsBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    });

    // Workspace selection
    const workspaceLabel = new Gtk.Label({
      label: _('Workspace:'),
      xalign: 0,
    });

    const workspaceSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: Math.min(...availableWorkspaces),
        upper: Math.max(...availableWorkspaces),
        step_increment: 1,
        value: app.workspace || 1,
      }),
      valign: Gtk.Align.CENTER,
    });

    workspaceSpinButton.connect('value-changed', () => {
      this._updateAppWorkspace(settings, app.app_id, workspaceSpinButton.get_value_as_int());
    });

    // Shortcut button
    const shortcutLabel = new Gtk.Label({
      label: _('Shortcut:'),
      xalign: 0,
    });

    const shortcutButton = new Gtk.Button({
      label: this._getShortcutLabel([app.shortcut].filter(Boolean)),
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Click to set keyboard shortcut'),
    });

    // Initialize the interactive recorder
    const recorder = new ShortcutRecorder(
      shortcutButton,
      settings,
      app.app_id,
      this._getShortcutLabel.bind(this),
      this._updateAppShortcut.bind(this),
      this._checkShortcutConflicts.bind(this),
      (msg) => {
        if (msg) {
          this._appManagementGroup.description = msg;
        } else {
          this._appManagementGroup.description = _('Configure applications and their workspace assignments');
        }
      }
    );

    shortcutButton.connect('clicked', () => {
      recorder.start();
    });

    settingsBox.append(workspaceLabel);
    settingsBox.append(workspaceSpinButton);
    settingsBox.append(shortcutLabel);
    settingsBox.append(shortcutButton);

    mainBox.append(infoBox);
    mainBox.append(settingsBox);
    row.set_child(mainBox);
    listBox.append(row);
  }

  _addNewAppRow(appId, workspace) {
    if (!this._appListBox) {
      return;
    }

    // Get the stored configuration to retrieve the display name
    const configs = this._parseAppConfigs(this._settings);
    const storedConfig = configs[appId] || {};

    const app = {
      app_id: appId,
      name: storedConfig.name || appId,
      workspace: workspace,
      shortcut: storedConfig.shortcut || ''
    };
    const availableWorkspaces = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    this._addAppRow(this._appListBox, this._settings, app, availableWorkspaces, (appToRemove) => {
      this._removeAppRow(appToRemove);
    });
  }

  _removeAppRow(appId) {
    if (!this._appListBox) {
      return;
    }

    // Find and remove the row with matching app ID
    let child = this._appListBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      if (child._appInfo && child._appInfo.appId === appId) {
        this._appListBox.remove(child);
        break;
      }
      child = next;
    }
  }



  _showAddAppDialog(parent, settings, addCallback) {
    log('[TriggerMoveWindows] Opening application browser dialog...');
    this._showApplicationBrowser(parent, settings, () => {
      // Refresh logic if needed, but addCallback is called inside _showApplicationBrowser
    });
  }

  _showApplicationBrowser(parent, settings, refreshCallback) {
    const dialog = new Gtk.Dialog({
      title: _('Select Application'),
      transient_for: parent,
      modal: true,
      use_header_bar: 1,
    });

    dialog.set_default_size(550, 700);

    const content = dialog.get_content_area();
    content.set_spacing(12);
    content.set_margin_top(12);
    content.set_margin_bottom(12);
    content.set_margin_start(12);
    content.set_margin_end(12);

    // Search bar with clear button
    const searchEntry = new Gtk.SearchEntry({
      placeholder_text: _('Search applications by name or ID...'),
      hexpand: true,
    });

    // Workspace selection with label and spin button
    const workspaceGroup = new Adw.PreferencesGroup({
      title: _('Workspace Assignment'),
    });
    
    const workspaceRow = new Adw.ActionRow({
      title: _('Target Workspace'),
      subtitle: _('New application will be assigned to this workspace'),
    });
    
    const workspaceSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 10,
        step_increment: 1,
        value: 1,
      }),
      valign: Gtk.Align.CENTER,
    });
    workspaceRow.add_suffix(workspaceSpinButton);
    workspaceGroup.add(workspaceRow);

    // Scrolled window for applications list
    const scrolledWindow = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      hexpand: true,
      vexpand: true,
      propagate_natural_height: true,
      min_content_height: 400,
    });
    scrolledWindow.add_css_class('view');

    const appListBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.SINGLE,
    });
    appListBox.add_css_class('boxed-list');
    scrolledWindow.set_child(appListBox);

    content.append(searchEntry);
    content.append(workspaceGroup);
    content.append(scrolledWindow);

    // Load and populate applications
    log('[TriggerMoveWindows] Scanning installed applications...');
    const installedApps = this._scanInstalledApplications();
    log(`[TriggerMoveWindows] Found ${installedApps.length} applications`);
    let selectedApp = null;

    const populateList = (filter = '') => {
      const startTime = Date.now();
      // Clear existing rows
      let child = appListBox.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        appListBox.remove(child);
        child = next;
      }

      const filterLower = filter.toLowerCase();
      // Filter and add applications
      const filteredApps = installedApps.filter(app =>
        app.name.toLowerCase().includes(filterLower) ||
        app.app_id.toLowerCase().includes(filterLower) ||
        (app.description && app.description.toLowerCase().includes(filterLower))
      );

      filteredApps.forEach(app => {
        const row = new Gtk.ListBoxRow();
        const box = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          spacing: 16,
          margin_top: 10,
          margin_bottom: 10,
          margin_start: 16,
          margin_end: 16,
        });

        // Icon
        const iconImage = new Gtk.Image({
          pixel_size: 32,
          valign: Gtk.Align.CENTER,
        });
        this._setIconOnImage(iconImage, app.icon);

        // App info
        const infoBox = new Gtk.Box({
          orientation: Gtk.Orientation.VERTICAL,
          hexpand: true,
          valign: Gtk.Align.CENTER,
        });

        const nameLabel = new Gtk.Label({
          label: app.name,
          xalign: 0,
          ellipsize: Pango.EllipsizeMode.END,
        });
        nameLabel.add_css_class('heading');

        const idLabel = new Gtk.Label({
          label: app.app_id,
          xalign: 0,
        });
        idLabel.add_css_class('dim-label');
        idLabel.add_css_class('caption');

        infoBox.append(nameLabel);
        infoBox.append(idLabel);

        if (app.description) {
          const descLabel = new Gtk.Label({
            label: app.description,
            xalign: 0,
            wrap: true,
            max_width_chars: 40,
            lines: 1,
            ellipsize: Pango.EllipsizeMode.END,
          });
          descLabel.add_css_class('caption');
          infoBox.append(descLabel);
        }

        box.append(iconImage);
        box.append(infoBox);
        row.set_child(box);
        row._appData = app;
        appListBox.append(row);
      });
      
      const duration = Date.now() - startTime;
      log(`[TriggerMoveWindows] Populated list with ${filteredApps.length} apps in ${duration}ms`);
    };

    // Initial population
    populateList();

    // Search functionality
    searchEntry.connect('search-changed', () => {
      populateList(searchEntry.get_text());
    });

    // Selection handling
    appListBox.connect('row-selected', (listbox, row) => {
      selectedApp = row ? row._appData : null;
    });

    // Double-click to add
    appListBox.connect('row-activated', (listbox, row) => {
      if (row && row._appData) {
        this._addSelectedApp(settings, row._appData, workspaceSpinButton.get_value_as_int(), refreshCallback);
        dialog.destroy();
      }
    });

    // Dialog buttons
    dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
    const addButton = dialog.add_button(_('Add Application'), Gtk.ResponseType.OK);
    addButton.add_css_class('suggested-action');

    dialog.connect('response', (dialog, response) => {
      if (response === Gtk.ResponseType.OK && selectedApp) {
        this._addSelectedApp(settings, selectedApp, workspaceSpinButton.get_value_as_int(), refreshCallback);
      }
      dialog.destroy();
    });

    dialog.show();
  }

  _scanInstalledApplications() {
    const appsById = new Map();
    
    // Use Gio.AppInfo to get all installed applications - much more robust
    const appInfos = Gio.AppInfo.get_all();
    log(`[TriggerMoveWindows] Gio found ${appInfos.length} total applications`);

    appInfos.forEach(appInfo => {
      try {
        // Only interested in desktop apps
        if (!(appInfo instanceof Gio.DesktopAppInfo)) return;
        
        // Skip hidden/no-display apps
        if (appInfo.get_nodisplay() || appInfo.should_show() === false) return;

        const appId = appInfo.get_id();
        const name = appInfo.get_name();
        
        // Get icon - can be a name or a path
        let icon = '';
        const gicon = appInfo.get_icon();
        if (gicon) {
          icon = gicon.to_string();
        }

        const app = {
          app_id: appId.toLowerCase().replace('.desktop', ''),
          name: name,
          description: appInfo.get_description() || '',
          icon: icon,
          hidden: false
        };

        // Deduplicate by app_id
        if (!appsById.has(app.app_id)) {
          appsById.set(app.app_id, app);
        }
      } catch (error) {
        logError(error, `[TriggerMoveWindows] Error processing app info`);
      }
    });

    // Deduplicate by Name to handle multiple desktop files for the same app
    const appsByName = new Map();
    for (const app of appsById.values()) {
      const existing = appsByName.get(app.name);
      // Prefer the one with the "standard" looking ID if there's a duplicate name
      if (!existing || app.app_id.length < existing.app_id.length) {
        appsByName.set(app.name, app);
      }
    }

    const result = Array.from(appsByName.values());
    log(`[TriggerMoveWindows] Found ${result.length} unique applications after Gio scan`);
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  _setIconOnImage(image, iconNameOrPath) {
    image.set_pixel_size(32);
    
    if (!iconNameOrPath) {
      image.set_from_icon_name('application-x-executable');
      return;
    }

    try {
      if (iconNameOrPath.startsWith('/')) {
        const file = Gio.File.new_for_path(iconNameOrPath);
        if (file.query_exists(null)) {
          const icon = new Gio.FileIcon({ file });
          image.set_from_gicon(icon);
        } else {
          image.set_from_icon_name('application-x-executable');
        }
      } else {
        // iconNameOrPath might be a serialized GIcon string from to_string()
        try {
          const gicon = Gio.Icon.new_for_string(iconNameOrPath);
          image.set_from_gicon(gicon);
        } catch (e) {
          // Fallback to simple name
          image.set_from_icon_name(iconNameOrPath);
        }
      }
    } catch (error) {
      image.set_from_icon_name('application-x-executable');
    }
  }

  _addSelectedApp(settings, app, workspace, refreshCallback) {
    const appConfig = {
      name: app.name,
      workspace: workspace,
      shortcut: '',
      icon: app.icon
    };
    
    log(`[TriggerMoveWindows] Adding selected app ${app.app_id}: ${JSON.stringify(appConfig)}`);
    this._updateAppConfig(settings, app.app_id, appConfig);
    
    // Call the parent callback to refresh the UI
    if (this._addNewAppRow) {
      this._addNewAppRow(app.app_id, workspace);
    }
  }

  _detectRunningWindows() {
    // Window detection not available in preferences context
    // Meta and Shell APIs are only available in main extension process
    log(`[TriggerMoveWindows] Window detection not available in preferences context`);
    return [];
  }

  _findBestWindowMatch(userInput, detectedApps) {
    const inputLower = userInput.toLowerCase();
    let bestMatches = [];

    detectedApps.forEach(app => {
      let score = 0;
      let matchType = '';

      // Exact matches get highest score
      if (app.appId === userInput) {
        score = 100;
        matchType = 'App ID (exact)';
      } else if (app.wmClass.toLowerCase() === inputLower) {
        score = 90;
        matchType = 'WM Class (exact)';
      } else if (app.process === userInput) {
        score = 85;
        matchType = 'Process (exact)';
      } else if (app.appName.toLowerCase() === inputLower) {
        score = 80;
        matchType = 'App Name (exact)';
      }
      // Partial matches
      else if (app.appId.toLowerCase().includes(inputLower)) {
        score = 70;
        matchType = 'App ID (partial)';
      } else if (app.wmClass.toLowerCase().includes(inputLower)) {
        score = 60;
        matchType = 'WM Class (partial)';
      } else if (app.appName.toLowerCase().includes(inputLower)) {
        score = 50;
        matchType = 'App Name (partial)';
      } else if (app.process.toLowerCase().includes(inputLower)) {
        score = 40;
        matchType = 'Process (partial)';
      } else if (app.title.toLowerCase().includes(inputLower)) {
        score = 30;
        matchType = 'Title (partial)';
      }

      if (score > 0) {
        bestMatches.push({
          ...app,
          matchScore: score,
          matchType: matchType
        });
      }
    });

    // Sort by score, highest first
    bestMatches.sort((a, b) => b.matchScore - a.matchScore);
    return bestMatches;
  }

  _showSimpleAddDialog(parent, settings, addCallback) {
    log('[TriggerMoveWindows] Creating simple add dialog...');

    const dialog = new Adw.MessageDialog({
      heading: _('Add Application'),
      body: _('Enter application details'),
      transient_for: parent,
    });

    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 12,
      margin_end: 12,
    });

    // App ID entry with detect button
    const appIdBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      hexpand: true,
    });

    const appIdEntry = new Gtk.Entry({
      placeholder_text: _('App ID: firefox, google-chrome, org.gnome.Terminal'),
      hexpand: true,
    });

    const detectButton = new Gtk.Button({
      icon_name: 'search-symbolic',
      tooltip_text: _('Detect Running Application'),
    });
    detectButton.add_css_class('suggested-action');

    appIdBox.append(appIdEntry);
    appIdBox.append(detectButton);

    // Display name entry
    const nameEntry = new Gtk.Entry({
      placeholder_text: _('Display name (optional)'),
      hexpand: true,
    });

    // Workspace selection
    const workspaceBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      halign: Gtk.Align.START,
    });

    const workspaceLabel = new Gtk.Label({
      label: _('Workspace:'),
    });

    const workspaceSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 10,
        step_increment: 1,
        value: 1,
      }),
      valign: Gtk.Align.CENTER,
    });

    workspaceBox.append(workspaceLabel);
    workspaceBox.append(workspaceSpinButton);

    // Add some example text
    // Verification status area (initially hidden)
    const verificationBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      visible: false,
    });

    const verificationLabel = new Gtk.Label({
      label: _('🔍 Window Detection Results'),
      xalign: 0,
    });
    verificationLabel.add_css_class('heading');

    const verificationDetails = new Gtk.Label({
      label: '',
      xalign: 0,
      wrap: true,
    });
    verificationDetails.add_css_class('caption');

    verificationBox.append(verificationLabel);
    verificationBox.append(verificationDetails);
    content.append(verificationBox);

    const exampleLabel = new Gtk.Label({
      label: _('Examples: firefox, google-chrome, code, org.gnome.Terminal\nTip: Run the app first, then click the detect button!'),
      xalign: 0,
      wrap: true,
    });
    exampleLabel.add_css_class('caption');
    content.append(exampleLabel);

    content.append(new Gtk.Label({
      label: _('Application ID'),
      xalign: 0,
    }));
    content.append(appIdBox);
    content.append(exampleLabel);
    content.append(new Gtk.Label({
      label: _('Display Name:'),
      xalign: 0,
    }));
    content.append(nameEntry);
    content.append(workspaceBox);

    dialog.set_extra_child(content);

    // Store detected app data
    let detectedAppData = null;

    // Detect button handler (disabled for now - needs different approach)
    detectButton.connect('clicked', () => {
      verificationDetails.set_text(
        '⚠️ Window detection temporarily disabled.\n' +
        'Meta/Shell APIs not available in preferences context.\n' +
        'For now, please enter the app ID manually:\n' +
        '• notion-electron (for Notion)\n' +
        '• slack (for Slack)\n' +
        '• legcord (for Legcord)\n' +
        '• firefox (for Firefox)'
      );
      verificationBox.set_visible(true);
      detectedAppData = null;
    });

    // Add buttons
    dialog.add_response('cancel', _('Cancel'));
    dialog.add_response('add', _('Add'));
    dialog.set_response_appearance('add', Adw.ResponseAppearance.SUGGESTED);

    dialog.connect('response', (dialog, response) => {
      log(`[TriggerMoveWindows] Dialog response: ${response}`);
      if (response === 'add') {
        const appId = appIdEntry.get_text().trim();
        const name = nameEntry.get_text().trim();
        const workspace = workspaceSpinButton.get_value_as_int();

        log(`[TriggerMoveWindows] Adding app: ID=${appId}, Name=${name}, Workspace=${workspace}`);

        if (appId) {
          try {
            // Create app config with verified data if available
            const appConfig = {
              name: name || appId,
              workspace: workspace,
              shortcut: ''
            };

            // Add verified window properties if detection was successful
            if (detectedAppData) {
              appConfig.verified = {
                wmClass: detectedAppData.wmClass,
                appId: detectedAppData.appId,
                appName: detectedAppData.appName,
                process: detectedAppData.process,
                title: detectedAppData.title,
                detectedAt: new Date().toISOString()
              };
              log(`[TriggerMoveWindows] Including verified data: ${JSON.stringify(appConfig.verified)}`);
            }

            log(`[TriggerMoveWindows] Calling _updateAppConfig with: ${JSON.stringify(appConfig)}`);
            this._updateAppConfig(settings, appId, appConfig);
            addCallback(appId, workspace);
          } catch (error) {
            logError(error, '[TriggerMoveWindows] Error adding app');
          }
        } else {
          log('[TriggerMoveWindows] No app ID entered');
        }
      }
      dialog.destroy();
    });

    dialog.show();
  }

  _getShortcutLabel(shortcuts) {
    if (!shortcuts || shortcuts.length === 0 || !shortcuts[0]) {
      return _('Not set');
    }
    return shortcuts[0]
      .replace('<Super>', 'Super+')
      .replace('<Shift>', 'Shift+')
      .replace('<Control>', 'Ctrl+')
      .replace('<Alt>', 'Alt+')
      .replace(/<|>/g, '');
  }

  _formatKeyComboToString(keyval, mask) {
    // Standard GTK accelerator name (e.g., <Shift><Control>m)
    return Gtk.accelerator_name(keyval, mask);
  }

  _checkShortcutConflicts(settings, appId, shortcut) {
    // 1. Check internal conflicts (other apps in this extension)
    const internalConflict = this._checkInternalConflicts(settings, appId, shortcut);
    if (internalConflict) {
      return { type: 'internal', name: internalConflict };
    }

    // 2. Check system conflicts (basic best-effort)
    const systemConflict = this._checkSystemConflicts(shortcut);
    if (systemConflict) {
      return { type: 'system', name: systemConflict };
    }

    return null;
  }

  _checkInternalConflicts(settings, appId, shortcut) {
    const configs = this._parseAppConfigs(settings);
    for (const [id, config] of Object.entries(configs)) {
      if (id === appId) continue;
      
      const appShortcut = typeof config === 'object' ? config.shortcut : '';
      if (appShortcut === shortcut) {
        return config.name || id;
      }
    }
    return null;
  }

  _checkSystemConflicts(shortcut) {
    const systemSchemas = [
      'org.gnome.desktop.wm.keybindings',
      'org.gnome.shell.keybindings',
      'org.gnome.mutter.keybindings',
      'org.gnome.settings-daemon.plugins.media-keys'
    ];

    for (const schemaId of systemSchemas) {
      try {
        const source = Gio.SettingsSchemaSource.get_default();
        const schema = source.lookup(schemaId, true);
        if (!schema) continue;

        const settings = new Gio.Settings({ schema_id: schemaId });
        const keys = schema.list_keys();

        for (const key of keys) {
          const value = settings.get_value(key);
          const type = value.get_type_string();

          // Shortcuts are either 's' (string) or 'as' (array of strings)
          if (type === 's') {
            if (value.deep_unpack() === shortcut) return `${schemaId}:${key}`;
          } else if (type === 'as') {
            const arr = value.deep_unpack();
            if (arr.includes(shortcut)) return `${schemaId}:${key}`;
          }
        }
      } catch (e) {
        // Silently skip schemas that don't exist or fail
      }
    }

    return null;
  }

  _parseAppConfigs(settings) {
    const configString = settings.get_string('app-configs');
    try {
      const configs = JSON.parse(configString);
      // Handle backward compatibility: if value is just a number, convert to object
      Object.keys(configs).forEach(appId => {
        if (typeof configs[appId] === 'number') {
          configs[appId] = { workspace: configs[appId], name: appId, shortcut: '' };
        }
      });
      return configs;
    } catch (error) {
      console.error('Error parsing app configs:', error);
      return {};
    }
  }

  _updateAppConfig(settings, appName, appConfig) {
    log(`[TriggerMoveWindows] _updateAppConfig called with: ${appName}, config: ${JSON.stringify(appConfig)}`);

    try {
      const configs = this._parseAppConfigs(settings);
      log(`[TriggerMoveWindows] Current configs: ${JSON.stringify(configs)}`);

      // If appConfig is just a number (workspace), convert to object for backward compatibility
      if (typeof appConfig === 'number') {
        configs[appName] = { workspace: appConfig, name: appName, shortcut: '' };
      } else {
        configs[appName] = appConfig;
      }

      const jsonString = JSON.stringify(configs);
      log(`[TriggerMoveWindows] Setting app-configs to: ${jsonString}`);

      settings.set_string('app-configs', jsonString);

      log('[TriggerMoveWindows] App configuration saved successfully');
    } catch (error) {
      logError(error, '[TriggerMoveWindows] Error in _updateAppConfig');
    }
  }

  _removeAppConfig(settings, appName) {
    const configs = this._parseAppConfigs(settings);
    delete configs[appName];
    settings.set_string('app-configs', JSON.stringify(configs));
  }

  _updateAppWorkspace(settings, appId, workspace) {
    const configs = this._parseAppConfigs(settings);
    const currentConfig = configs[appId] || { name: appId, shortcut: '' };
    currentConfig.workspace = workspace;
    this._updateAppConfig(settings, appId, currentConfig);
  }

  _createGlobalShortcutRow(group, settings, window) {
    const row = new Adw.ActionRow({
      title: _('Global Window Organization Shortcut'),
      subtitle: _('Keyboard shortcut to organize all windows to their configured workspaces'),
    });

    // Get current global shortcut
    const currentShortcut = settings.get_strv('trigger-shortcut')[0] || '<Super><Shift>m>';

    const shortcutButton = new Gtk.Button({
      label: this._getShortcutLabel([currentShortcut]),
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Click to change global shortcut'),
    });
    shortcutButton.add_css_class('pill');

    // Initialize the interactive recorder for global shortcut
    const recorder = new ShortcutRecorder(
      shortcutButton,
      settings,
      'trigger-shortcut',
      this._getShortcutLabel.bind(this),
      (settings, id, shortcut) => {
        settings.set_strv('trigger-shortcut', [shortcut]);
        log(`[TriggerMoveWindows] Global shortcut updated to: ${shortcut}`);
      },
      this._checkShortcutConflicts.bind(this),
      (msg) => {
        if (msg) {
          group.description = msg;
        } else {
          group.description = _('Configure global extension behavior');
        }
      }
    );

    shortcutButton.connect('clicked', () => {
      recorder.start();
    });

    row.add_suffix(shortcutButton);
    group.add(row);
  }

  _updateAppShortcut(settings, appId, shortcut) {
    log(`[TriggerMoveWindows] Shortcut for ${appId}: ${shortcut}`);
    const configs = this._parseAppConfigs(settings); ``
    const currentConfig = configs[appId] || { name: appId, workspace: 1 };
    currentConfig.shortcut = shortcut;
    this._updateAppConfig(settings, appId, currentConfig);
    // Extension automatically refreshes shortcuts via settings monitoring
  }

  _updateAppDisplayName(settings, appId, newName) {
    log(`[TriggerMoveWindows] Updating display name for ${appId} to: ${newName}`);
    const configs = this._parseAppConfigs(settings);
    const currentConfig = configs[appId] || { workspace: 1, shortcut: '' };
    currentConfig.name = newName;
    this._updateAppConfig(settings, appId, currentConfig);
  }

  _showEditAppDialog(parent, settings, app, callback) {
    const dialog = new Adw.MessageDialog({
      heading: _('Edit Application'),
      body: _('Modify application ID and display name'),
      transient_for: parent,
    });

    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 12,
      margin_end: 12,
    });

    // Application ID entry
    const appIdEntry = new Gtk.Entry({
      text: app.app_id,
      placeholder_text: _('Application ID'),
      hexpand: true,
      editable: true,
      can_focus: true,
    });

    // Display name entry
    const nameEntry = new Gtk.Entry({
      text: app.name || app.app_id,
      placeholder_text: _('Display name'),
      hexpand: true,
      editable: true,
      can_focus: true,
    });

    // Example text
    const exampleLabel = new Gtk.Label({
      label: _('Examples: firefox, google-chrome, code, org.gnome.Terminal'),
      xalign: 0,
    });
    exampleLabel.add_css_class('caption');

    content.append(new Gtk.Label({
      label: _('Application ID:'),
      xalign: 0,
    }));
    content.append(appIdEntry);
    content.append(exampleLabel);
    content.append(new Gtk.Label({
      label: _('Display Name:'),
      xalign: 0,
    }));
    content.append(nameEntry);

    dialog.set_extra_child(content);

    dialog.add_response('cancel', _('Cancel'));
    dialog.add_response('save', _('Save'));
    dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);

    dialog.connect('response', (dialog, response) => {
      if (response === 'save') {
        const newAppId = appIdEntry.get_text().trim();
        const newName = nameEntry.get_text().trim();
        if (newAppId && newName) {
          callback(newAppId, newName);
        }
      }
      dialog.destroy();
    });

    dialog.show();
  }
}
