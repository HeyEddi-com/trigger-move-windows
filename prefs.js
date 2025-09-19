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

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TriggerMoveWindowsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings('org.gnome.shell.extensions.trigger-move-windows');

    // Create main page
    const page = new Adw.PreferencesPage({
      title: _('Trigger Move Windows'),
      icon_name: 'preferences-desktop-keyboard-shortcuts',
    });
    window.add(page);

    // Application Management Group
    const appManagementGroup = new Adw.PreferencesGroup({
      title: _('Application Management'),
      description: _('Configure applications and their workspace assignments'),
    });
    page.add(appManagementGroup);

    // Configured applications list - store reference for refreshing
    this._appManagementGroup = appManagementGroup;
    this._createConfiguredAppsList(appManagementGroup, settings, window);

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

    shortcutButton.connect('clicked', () => {
      this._showShortcutDialog(listBox.get_root(), (shortcut) => {
        this._updateAppShortcut(settings, app.app_id, shortcut);
        shortcutButton.label = this._getShortcutLabel([shortcut].filter(Boolean));
      });
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
    log('[TriggerMoveWindows] Opening simplified application dialog...');
    // Use simplified version for now until debugging is complete
    this._showSimpleAddDialog(parent, settings, addCallback);
  }

  _showApplicationBrowser(parent, settings, refreshCallback) {
    const dialog = new Gtk.Dialog({
      title: _('Select Application'),
      transient_for: parent,
      modal: true,
      use_header_bar: 1,
    });

    dialog.set_default_size(500, 600);

    const content = dialog.get_content_area();
    content.set_spacing(12);
    content.set_margin_top(12);
    content.set_margin_bottom(12);
    content.set_margin_start(12);
    content.set_margin_end(12);

    // Search bar
    const searchEntry = new Gtk.SearchEntry({
      placeholder_text: _('Search applications...'),
      hexpand: true,
    });

    // Workspace selection
    const workspaceBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      margin_top: 6,
    });
    workspaceBox.append(new Gtk.Label({
      label: _('Assign to workspace:'),
    }));

    const availableWorkspaces = settings.get_value('available-workspaces').deep_unpack();
    const workspaceSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: Math.min(...availableWorkspaces),
        upper: Math.max(...availableWorkspaces),
        step_increment: 1,
        value: 1,
      }),
    });
    workspaceBox.append(workspaceSpinButton);

    // Scrolled window for applications list
    const scrolledWindow = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      hexpand: true,
      vexpand: true,
    });

    const appListBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.SINGLE,
    });
    appListBox.add_css_class('boxed-list');
    scrolledWindow.set_child(appListBox);

    content.append(searchEntry);
    content.append(workspaceBox);
    content.append(scrolledWindow);

    // Load and populate applications
    log('[TriggerMoveWindows] Scanning installed applications...');
    const installedApps = this._scanInstalledApplications();
    log(`[TriggerMoveWindows] Found ${installedApps.length} applications`);
    let selectedApp = null;

    const populateList = (filter = '') => {
      // Clear existing rows
      let child = appListBox.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        appListBox.remove(child);
        child = next;
      }

      // Filter and add applications
      const filteredApps = installedApps.filter(app =>
        app.name.toLowerCase().includes(filter.toLowerCase()) ||
        app.app_id.toLowerCase().includes(filter.toLowerCase()) ||
        (app.description && app.description.toLowerCase().includes(filter.toLowerCase()))
      );

      filteredApps.forEach(app => {
        const row = new Gtk.ListBoxRow();
        const box = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          spacing: 12,
          margin_top: 8,
          margin_bottom: 8,
          margin_start: 12,
          margin_end: 12,
        });

        // Icon
        const iconImage = new Gtk.Image({
          pixel_size: 32,
          valign: Gtk.Align.CENTER,
        });

        if (app.icon) {
          try {
            iconImage.set_from_icon_name(app.icon);
          } catch (error) {
            iconImage.set_from_icon_name('application-x-executable');
          }
        } else {
          iconImage.set_from_icon_name('application-x-executable');
        }

        // App info
        const infoBox = new Gtk.Box({
          orientation: Gtk.Orientation.VERTICAL,
          hexpand: true,
          valign: Gtk.Align.CENTER,
        });

        const nameLabel = new Gtk.Label({
          label: app.name,
          xalign: 0,
        });
        nameLabel.add_css_class('heading');

        const idLabel = new Gtk.Label({
          label: app.app_id,
          xalign: 0,
        });
        idLabel.add_css_class('dim-label');

        if (app.description) {
          const descLabel = new Gtk.Label({
            label: app.description,
            xalign: 0,
            wrap: true,
            max_width_chars: 50,
          });
          descLabel.add_css_class('caption');
          infoBox.append(nameLabel);
          infoBox.append(idLabel);
          infoBox.append(descLabel);
        } else {
          infoBox.append(nameLabel);
          infoBox.append(idLabel);
        }

        box.append(iconImage);
        box.append(infoBox);
        row.set_child(box);
        row._appData = app;
        appListBox.append(row);
      });
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
    const applications = [];
    const systemAppDirs = ['/usr/share/applications', '/var/lib/flatpak/exports/share/applications'];
    const userAppDir = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'applications']);

    const allDirs = [...systemAppDirs, userAppDir];
    log(`[TriggerMoveWindows] Scanning directories: ${allDirs.join(', ')}`);

    allDirs.forEach(dirPath => {
      try {
        log(`[TriggerMoveWindows] Scanning directory: ${dirPath}`);
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) {
          log(`[TriggerMoveWindows] Directory does not exist: ${dirPath}`);
          return;
        }

        const enumerator = dir.enumerate_children(
          'standard::name,standard::type',
          Gio.FileQueryInfoFlags.NONE,
          null
        );

        let fileInfo;
        let fileCount = 0;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
          const fileName = fileInfo.get_name();
          if (!fileName.endsWith('.desktop')) continue;

          fileCount++;
          const desktopFile = dir.get_child(fileName);
          const app = this._parseDesktopFile(desktopFile.get_path());

          if (app && !app.hidden && !applications.find(existing => existing.app_id === app.app_id)) {
            applications.push(app);
          }
        }
        log(`[TriggerMoveWindows] Found ${fileCount} .desktop files in ${dirPath}`);
      } catch (error) {
        logError(error, `[TriggerMoveWindows] Error scanning ${dirPath}`);
      }
    });

    // Sort applications by name
    return applications.sort((a, b) => a.name.localeCompare(b.name));
  }

  _parseDesktopFile(filePath) {
    try {
      const keyFile = new GLib.KeyFile();
      keyFile.load_from_file(filePath, GLib.KeyFileFlags.NONE);

      const group = 'Desktop Entry';
      if (!keyFile.has_group(group)) return null;

      const type = keyFile.get_string(group, 'Type');
      if (type !== 'Application') return null;

      // Check if hidden or not shown in menus
      if (keyFile.has_key(group, 'Hidden')) {
        const hidden = keyFile.get_boolean(group, 'Hidden');
        if (hidden) return null;
      }

      if (keyFile.has_key(group, 'NoDisplay')) {
        const noDisplay = keyFile.get_boolean(group, 'NoDisplay');
        if (noDisplay) return null;
      }

      const name = keyFile.get_string(group, 'Name');
      const fileName = GLib.path_get_basename(filePath);
      const appId = fileName.replace('.desktop', '');

      let description = '';
      if (keyFile.has_key(group, 'Comment')) {
        description = keyFile.get_string(group, 'Comment');
      }

      let icon = '';
      if (keyFile.has_key(group, 'Icon')) {
        icon = keyFile.get_string(group, 'Icon');
      }

      let exec = '';
      if (keyFile.has_key(group, 'Exec')) {
        exec = keyFile.get_string(group, 'Exec');
      }

      return {
        app_id: appId,
        name: name,
        description: description,
        icon: icon,
        exec: exec,
        hidden: false
      };
    } catch (error) {
      log(`[TriggerMoveWindows] Error parsing desktop file ${filePath}: ${error.message}`);
      return null;
    }
  }

  _addSelectedApp(settings, app, workspace, refreshCallback) {
    this._addConfiguredApp(settings, {
      app_id: app.app_id,
      name: app.name,
      workspace: workspace,
      shortcut: '',
      icon: app.icon
    });
    refreshCallback();
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

    // App ID entry with common examples
    const appIdEntry = new Gtk.Entry({
      placeholder_text: _('App ID: firefox, google-chrome, org.gnome.Terminal'),
      hexpand: true,
    });

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
    content.append(workspaceBox);

    dialog.set_extra_child(content);

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
            const appData = {
              app_id: appId,
              name: name || appId,
              workspace: workspace,
              shortcut: '',
              icon: ''
            };

            log(`[TriggerMoveWindows] Calling _updateAppConfig with: ${JSON.stringify(appData)}`);
            this._updateAppConfig(settings, appId, { name: name || appId, workspace: workspace, shortcut: '' });
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

  _showShortcutDialog(parent, callback) {
    const dialog = new Adw.MessageDialog({
      heading: _('Set Keyboard Shortcut'),
      body: _('Press the key combination you want to use, or press Escape to cancel'),
      transient_for: parent,
    });

    const eventController = new Gtk.EventControllerKey();
    dialog.add_controller(eventController);

    eventController.connect('key-pressed', (controller, keyval, keycode, state) => {
      if (keyval === Gdk.KEY_Escape) {
        dialog.destroy();
        return true;
      }

      const mask = state & Gtk.accelerator_get_default_mod_mask();
      if (mask === 0) {
        return false;
      }

      const shortcut = Gtk.accelerator_name(keyval, mask);
      callback(shortcut);
      dialog.destroy();
      return true;
    });

    dialog.add_response('clear', _('Clear'));
    dialog.add_response('cancel', _('Cancel'));

    dialog.connect('response', (dialog, response) => {
      if (response === 'clear') {
        callback('');
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

  _updateAppShortcut(settings, appId, shortcut) {
    // For now, just log the shortcut - we'll implement this after basic functionality works
    log(`[TriggerMoveWindows] Shortcut for ${appId}: ${shortcut}`);
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
