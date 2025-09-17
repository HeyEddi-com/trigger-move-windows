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

    // Configured applications list
    this._createConfiguredAppsList(appManagementGroup, settings, window);

    // General Settings Group
    const generalGroup = new Adw.PreferencesGroup({
      title: _('General Settings'),
      description: _('Configure extension behavior'),
    });
    page.add(generalGroup);

    // Main trigger shortcut row
    const mainShortcutRow = new Adw.ActionRow({
      title: _('Main Trigger Shortcut'),
      subtitle: _('Legacy shortcut for extension trigger (optional)'),
    });

    const mainShortcutButton = new Gtk.Button({
      label: this._getShortcutLabel(settings.get_strv('trigger-shortcut')),
      valign: Gtk.Align.CENTER,
    });
    mainShortcutButton.connect('clicked', () => {
      this._showShortcutDialog(window, (shortcut) => {
        settings.set_strv('trigger-shortcut', shortcut ? [shortcut] : []);
        mainShortcutButton.label = this._getShortcutLabel(settings.get_strv('trigger-shortcut'));
      });
    });
    mainShortcutRow.add_suffix(mainShortcutButton);
    generalGroup.add(mainShortcutRow);

    // Show notifications switch
    const notificationsRow = new Adw.SwitchRow({
      title: _('Show Notifications'),
      subtitle: _('Display desktop notifications when activating applications'),
    });
    settings.bind('show-notifications', notificationsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(notificationsRow);

    // Debug logging switch
    const debugRow = new Adw.SwitchRow({
      title: _('Debug Logging'),
      subtitle: _('Enable debug output in system logs'),
    });
    settings.bind('debug-logging', debugRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(debugRow);

    // Behavior Settings Group
    const behaviorGroup = new Adw.PreferencesGroup({
      title: _('Application Behavior'),
      description: _('Configure how applications are handled when activated'),
    });
    page.add(behaviorGroup);

    // Launch if not running switch
    const launchRow = new Adw.SwitchRow({
      title: _('Launch if Not Running'),
      subtitle: _('Launch application if it\'s not currently running'),
    });
    settings.bind('launch-if-not-running', launchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    behaviorGroup.add(launchRow);

    // Move to workspace switch
    const moveWorkspaceRow = new Adw.SwitchRow({
      title: _('Move to Configured Workspace'),
      subtitle: _('Move application to its configured workspace when activated'),
    });
    settings.bind('move-to-workspace', moveWorkspaceRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    behaviorGroup.add(moveWorkspaceRow);

    // Focus on activate switch
    const focusRow = new Adw.SwitchRow({
      title: _('Focus Window'),
      subtitle: _('Focus the application window when activated'),
    });
    settings.bind('focus-on-activate', focusRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    behaviorGroup.add(focusRow);

    // Switch to workspace switch
    const switchWorkspaceRow = new Adw.SwitchRow({
      title: _('Switch to Workspace'),
      subtitle: _('Switch to the application\'s workspace when activated'),
    });
    settings.bind('switch-to-workspace', switchWorkspaceRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    behaviorGroup.add(switchWorkspaceRow);

    // Multi-window behavior combo row
    const multiWindowRow = new Adw.ComboRow({
      title: _('Multiple Windows Behavior'),
      subtitle: _('How to handle applications with multiple windows'),
    });

    const multiWindowModel = new Gtk.StringList();
    multiWindowModel.append(_('Focus Any Window'));
    multiWindowModel.append(_('Focus Most Recent'));
    multiWindowModel.append(_('Cycle Through Windows'));

    multiWindowRow.set_model(multiWindowModel);

    const currentBehavior = settings.get_string('multi-window-behavior');
    const behaviorIndex = ['focus-any', 'focus-recent', 'cycle-windows'].indexOf(currentBehavior);
    multiWindowRow.set_selected(behaviorIndex >= 0 ? behaviorIndex : 1);

    multiWindowRow.connect('notify::selected', () => {
      const behaviors = ['focus-any', 'focus-recent', 'cycle-windows'];
      settings.set_string('multi-window-behavior', behaviors[multiWindowRow.get_selected()]);
    });
    behaviorGroup.add(multiWindowRow);

    // Advanced Settings Group
    const advancedGroup = new Adw.PreferencesGroup({
      title: _('Advanced Settings'),
    });
    page.add(advancedGroup);

    // Notification timeout spin row
    const timeoutRow = new Adw.SpinRow({
      title: _('Notification Timeout'),
      subtitle: _('How long to show notifications (seconds)'),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 10,
        step_increment: 1,
        page_increment: 1,
        value: settings.get_int('notification-timeout'),
      }),
    });
    settings.bind('notification-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    advancedGroup.add(timeoutRow);

    // Allow shortcut conflicts switch
    const conflictsRow = new Adw.SwitchRow({
      title: _('Allow Shortcut Conflicts'),
      subtitle: _('Allow multiple applications to have the same keyboard shortcut'),
    });
    settings.bind('allow-shortcut-conflicts', conflictsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    advancedGroup.add(conflictsRow);

    // App cache expiry spin row
    const cacheRow = new Adw.SpinRow({
      title: _('Application Cache Expiry'),
      subtitle: _('Hours to cache discovered applications'),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 168,
        step_increment: 1,
        page_increment: 12,
        value: settings.get_int('app-cache-expiry'),
      }),
    });
    settings.bind('app-cache-expiry', cacheRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    advancedGroup.add(cacheRow);
  }

  _createConfiguredAppsList(group, settings, window) {
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
      this._showAddAppDialog(window, settings, () => {
        // Refresh the list
        this._refreshAppsList(group, settings, window);
      });
    });
    headerRow.add_suffix(addButton);
    group.add(headerRow);

    // Create scrolled area for applications
    const scrolledWindow = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      max_content_height: 400,
      min_content_height: 150,
    });

    const appListBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    appListBox.add_css_class('boxed-list');
    scrolledWindow.set_child(appListBox);

    // Add configured applications to the list
    Object.entries(configuredApps).forEach(([appId, workspace]) => {
      const app = { app_id: appId, name: appId, workspace: workspace, shortcut: '' };
      this._addAppRow(appListBox, settings, app, availableWorkspaces, () => {
        this._refreshAppsList(group, settings, window);
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

  _addAppRow(listBox, settings, app, availableWorkspaces, refreshCallback) {
    const row = new Gtk.ListBoxRow();
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

    const removeButton = new Gtk.Button({
      icon_name: 'edit-delete-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: _('Remove Application'),
    });
    removeButton.add_css_class('destructive-action');
    removeButton.connect('clicked', () => {
      this._removeAppConfig(settings, app.app_id);
      refreshCallback();
    });

    infoBox.append(appLabel);
    infoBox.append(removeButton);

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

  _refreshAppsList(group, settings, window) {
    log('[TriggerMoveWindows] Refreshing apps list...');

    try {
      // Remove all existing children from group
      let child = group.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        group.remove(child);
        child = next;
      }

      // Recreate the entire configured apps list
      this._createConfiguredAppsList(group, settings, window);
      log('[TriggerMoveWindows] Apps list refreshed successfully');
    } catch (error) {
      logError(error, '[TriggerMoveWindows] Error refreshing apps list');
    }
  }

  _showAddAppDialog(parent, settings, refreshCallback) {
    log('[TriggerMoveWindows] Opening simplified application dialog...');
    // Use simplified version for now until debugging is complete
    this._showSimpleAddDialog(parent, settings, refreshCallback);
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

  _showSimpleAddDialog(parent, settings, refreshCallback) {
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
            this._updateAppConfig(settings, appId, workspace);
            log('[TriggerMoveWindows] App added successfully, calling refresh...');
            refreshCallback();
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
      return JSON.parse(configString);
    } catch (error) {
      console.error('Error parsing app configs:', error);
      return {};
    }
  }

  _updateAppConfig(settings, appName, workspace) {
    log(`[TriggerMoveWindows] _updateAppConfig called with: ${appName}, workspace: ${workspace}`);

    try {
      const configs = this._parseAppConfigs(settings);
      log(`[TriggerMoveWindows] Current configs: ${JSON.stringify(configs)}`);

      configs[appName] = workspace;

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
    this._updateAppConfig(settings, appId, workspace);
  }

  _updateAppShortcut(settings, appId, shortcut) {
    // For now, just log the shortcut - we'll implement this after basic functionality works
    log(`[TriggerMoveWindows] Shortcut for ${appId}: ${shortcut}`);
  }
}
