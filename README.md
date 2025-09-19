# Trigger Move Windows - GNOME Shell Extension

Automatically organize application windows across workspaces with a single keyboard shortcut.

## 🚀 Features

- **One-Key Organization**: Press `Super+Shift+M` to instantly move all configured applications to their designated workspaces
- **Smart Window Matching**: Matches windows using WM_CLASS, window title, process name, and app ID
- **Wayland & X11 Support**: Works with both native Wayland applications and XWayland/X11 apps
- **Electron App Friendly**: Properly handles Electron applications like ClickUp, Beeper, and Mailspring
- **Customizable Configurations**: Easy-to-use preferences UI for manalging app-workspace mappings
- **Visual Feedback**: Desktop notifications show results of window movement operations
- **Performance Optimized**: Efficient window scanning that doesn't block the UI

## 📦 Installation

### Method 1: GNOME Extensions Website (Recommended)

1. **Visit the extension page**: [extensions.gnome.org](https://extensions.gnome.org/extension/XXXX/trigger-move-windows/) *(pending approval)*
2. **Click the toggle switch** to install and enable
3. **Configure settings** by clicking the gear icon or using the Extensions app

### Method 2: Manual Installation from Release

1. **Download the latest release**:
   - Visit the [GitHub Releases page](https://github.com/eddimon/trigger-move-windows/releases)
   - Download `trigger-move-windows@eddi.local.shell-extension.zip`

2. **Install via Extensions app**:
   ```bash
   # Open Extensions app and click "Install Shell Extension"
   # Or install via command line:
   gnome-extensions install trigger-move-windows@eddi.local.shell-extension.zip
   ```

3. **Enable the extension**:
   ```bash
   gnome-extensions enable trigger-move-windows@eddi.local
   ```

### Method 3: Development Installation

1. **Clone or download this extension**:
   ```bash
   git clone https://github.com/eddimon/trigger-move-windows.git ~/.local/share/gnome-shell/extensions/trigger-move-windows@eddi.local
   ```

2. **Compile GSettings schema**:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/trigger-move-windows@eddi.local
   glib-compile-schemas schemas/
   ```

3. **Restart GNOME Shell**:
   - **X11**: Press `Alt+F2`, type `r`, press Enter
   - **Wayland**: Log out and log back in

4. **Enable the extension**:
   ```bash
   gnome-extensions enable trigger-move-windows@eddi.local
   ```
   Or use GNOME Extensions app.

### Installation Verification

After installation, verify the extension is working:
```bash
# Check if extension is enabled
gnome-extensions list --enabled | grep trigger-move-windows

# Test the default keyboard shortcut
# Press Super+Shift+M to trigger window organization
```

## ⚙️ Configuration

### Default Application Mappings

The extension comes pre-configured with these application-workspace mappings:

| Applications | Target Workspace |
|-------------|------------------|
| Thunderbird, Mailspring, Beeper/BeeperTexts, ClickUp | Workspace 1 |
| Chrome, Firefox, Slack, Discord, Notion | Workspace 2 |
| Zen Browser | Workspace 3 |
| Spotify | Workspace 8 |

### Customizing Settings

1. **Open Extension Preferences**:
   - Via Extensions app: Click the gear icon next to "Trigger Move Windows"
   - Via command line: `gnome-extensions prefs trigger-move-windows@eddi.local`

2. **Available Settings**:
   - **Keyboard Shortcut**: Change the trigger key combination
   - **Show Notifications**: Toggle desktop notifications
   - **Skip Correctly Placed Windows**: Don't move windows already on target workspace
   - **Debug Logging**: Enable detailed logging for troubleshooting
   - **Window Matching Options**: Configure how windows are identified
   - **Application Configurations**: Add, edit, or remove app-workspace mappings

### Adding New Applications

1. Open extension preferences
2. Scroll to "Application Configurations" section
3. Click "Add Application"
4. Enter the application name (e.g., `firefox`, `code`, `gimp`)
5. Select the target workspace (1-10)
6. Click "Add"

## 🎯 Usage

### Basic Usage

1. **Open your applications** normally across any workspaces
2. **Press the keyboard shortcut** (default: `Super+Shift+M`)
3. **Watch the magic** - all configured applications automatically move to their designated workspaces
4. **See the results** - desktop notification shows how many windows were moved

### Window Matching Logic

The extension identifies windows using multiple criteria (in order of priority):

1. **Exact WM_CLASS match**: `firefox` matches Firefox windows
2. **Exact App ID match**: `org.gnome.TextEditor` matches Text Editor
3. **Exact process name match**: `code` matches VS Code
4. **Partial title match**: `ClickUp` in window title matches ClickUp app
5. **Partial WM_CLASS match**: `google-chrome` matches Chrome variants

### Supported Application Examples

| Application | Matching Names | Notes |
|------------|---------------|-------|
| Firefox | `firefox`, `Firefox` | Standard Firefox |
| Chrome | `chrome`, `google-chrome`, `Google-chrome` | All Chrome variants |
| ClickUp | `clickup`, `ClickUp` | Electron app via XWayland |
| Beeper | `beeper`, `beepertexts` | Multiple process names |
| VS Code | `code`, `Code` | Electron app |
| Spotify | `spotify`, `Spotify` | Native or Snap |
| Zen Browser | `zen`, `zen-browser` | Wayland native |

## 🔧 Troubleshooting

### Extension Not Loading

```bash
# Check if extension is enabled
gnome-extensions list --enabled | grep trigger-move-windows

# Check for errors
journalctl -f -o cat /usr/bin/gnome-shell

# Reinstall schema
cd ~/.local/share/gnome-shell/extensions/trigger-move-windows@eddi.local
glib-compile-schemas schemas/
```

### Windows Not Moving

1. **Enable debug logging** in preferences
2. **Trigger the shortcut** and check logs:
   ```bash
   journalctl -f | grep TriggerMoveWindows
   ```
3. **Check window information**:
   ```bash
   # For X11/XWayland apps
   xprop | grep -E "(WM_CLASS|WM_NAME)"

   # For all windows (requires extension debug mode)
   journalctl -f | grep "Found.*windows"
   ```

### Common Issues

- **Wayland applications**: Some may require different matching names
- **Electron apps**: May have multiple processes - try both app name and process name
- **Snap applications**: May have different WM_CLASS values
- **Workspace limits**: Ensure target workspaces don't exceed your system limit

### Keyboard Shortcut Conflicts

If `Super+Shift+M` conflicts with other shortcuts:

1. Open extension preferences
2. Click the shortcut button in "General Settings"
3. Press your desired key combination
4. Click "OK"

## 🏗️ Development

### Project Structure

```
trigger-move-windows@eddi.local/
├── extension.js          # Main extension logic
├── prefs.js             # Preferences UI
├── metadata.json        # Extension metadata
├── stylesheet.css       # Optional styling
├── schemas/             # GSettings schema
│   └── org.gnome.shell.extensions.trigger-move-windows.gschema.xml
└── README.md           # This file
```

### Key Components

- **Window Detection**: Uses `global.get_window_actors()` to find all windows
- **Window Matching**: Multi-criteria matching system for robust app identification
- **Workspace Management**: Uses `Meta.WorkspaceManager` for workspace operations
- **Window Movement**: Uses `metaWindow.change_workspace()` for reliable movement
- **Notifications**: Uses `MessageTray.Notification` for user feedback

### Building from Source

```bash
# Clone repository
git clone <repo-url>
cd trigger-move-windows-extension

# Install to local extensions directory
make install

# Or manually copy
cp -r . ~/.local/share/gnome-shell/extensions/trigger-move-windows@eddi.local/
```

### Testing

```bash
# Enable debug logging
gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging true

# Watch logs
journalctl -f | grep TriggerMoveWindows

# Test window detection
dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'global.get_window_actors().length'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on both X11 and Wayland
5. Submit a pull request

### Development Guidelines

- Follow GNOME Shell extension best practices
- Test with both native Wayland and XWayland applications
- Ensure compatibility with GNOME Shell 45+
- Add appropriate error handling and logging
- Update documentation for new features

## 📋 System Requirements

- **GNOME Shell**: 45, 46, or 47
- **Linux Distribution**: Any with modern GNOME
- **Session Types**: Both X11 and Wayland supported
- **Architecture**: x86_64, ARM64

### Tested Environments

- **Arch Linux**: GNOME Shell 45+
- **Ubuntu**: 22.04+ with GNOME Shell 45+
- **Fedora**: 38+ with GNOME Shell 45+
- **Pop!_OS**: 22.04+ with COSMIC/GNOME Shell

## 📄 License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 2 of the License, or (at your option) any later version.

## 🐛 Bug Reports & Feature Requests

Please report issues and feature requests through the project's issue tracker. Include:

- GNOME Shell version
- Linux distribution and version
- Session type (X11/Wayland)
- Steps to reproduce
- Relevant log output (with debug logging enabled)

## 🙏 Acknowledgments

- GNOME Shell development team for the extension APIs
- Community contributors who helped test and improve the extension
- Users who provided feedback and feature requests
