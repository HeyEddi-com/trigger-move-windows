'use strict';

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ME = 'trigger-move-windows@eddi.local';

export default class TriggerMoveWindows extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
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

      log(`[${ME}] Extension enabled successfully`);

    } catch (error) {
      logError(`[${ME}] Error during enable:`, error);
      Main.notify('Extension Error', `Failed to enable: ${error.message}`);
    }
  }

  disable() {
    log(`[${ME}] Disabling extension...`);

    try {
      // Remove keybinding
      Main.wm.removeKeybinding('trigger-shortcut');
      log(`[${ME}] Keybinding removed`);

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
      Main.notify('Shortcut Triggered!', 'Window organization starting...');
      log(`[${ME}] Notification sent: Shortcut Triggered!`);

      // TODO: Add window management logic here
      log(`[${ME}] Shortcut handler completed successfully`);

    } catch (error) {
      logError(`[${ME}] Error in shortcut handler:`, error);
      Main.notify('Error', `Failed to process shortcut: ${error.message}`);
    }
  }
}
