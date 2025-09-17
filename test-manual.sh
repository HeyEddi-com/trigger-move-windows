#!/bin/bash
# test-manual.sh - Manual test script for debugging the Trigger Move Windows extension
#
# This script helps manually test the window movement functionality without relying
# on the extension's keyboard shortcut registration working properly.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 2 of the License, or
# (at your option) any later version.

set -e

EXTENSION_NAME="trigger-move-windows@eddi.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check basic requirements
check_requirements() {
    print_status "Checking requirements..."

    # Check if GNOME Shell is running
    if ! pgrep -x "gnome-shell" > /dev/null; then
        print_error "GNOME Shell is not running"
        exit 1
    fi
    print_success "GNOME Shell is running"

    # Check if extension is installed
    if [ ! -d "$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME" ]; then
        print_error "Extension not installed. Run 'make install' first"
        exit 1
    fi
    print_success "Extension is installed"

    # Check if extension is enabled
    if ! gnome-extensions list --enabled | grep -q "$EXTENSION_NAME"; then
        print_warning "Extension is not enabled. Enabling now..."
        gnome-extensions enable "$EXTENSION_NAME"
        sleep 2
    fi
    print_success "Extension is enabled"
}

# Function to check current workspaces
check_workspaces() {
    print_status "Checking current workspaces..."

    local workspace_count=$(gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "global.workspace_manager.get_n_workspaces()" | grep -o '[0-9]*')
    print_status "Current number of workspaces: $workspace_count"

    local current_workspace=$(gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "global.workspace_manager.get_active_workspace_index()" | grep -o '[0-9]*')
    print_status "Currently on workspace: $((current_workspace + 1))"
}

# Function to list current windows
list_windows() {
    print_status "Listing current windows..."

    # Get window list using D-Bus
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "
    let windows = global.get_window_actors().map(w => w.get_meta_window());
    let result = [];
    windows.forEach((w, i) => {
        if (w.get_window_type() === Meta.WindowType.NORMAL) {
            result.push({
                id: i,
                title: w.get_title(),
                wm_class: w.get_wm_class(),
                workspace: w.get_workspace().index(),
                pid: w.get_pid()
            });
        }
    });
    JSON.stringify(result);
    " 2>/dev/null | sed 's/^.*true, "//' | sed 's/")$//' | python3 -m json.tool 2>/dev/null || echo "Could not parse window list"
}

# Function to manually trigger window movement
trigger_manual_movement() {
    print_status "Attempting to manually trigger window movement..."

    # Try to call the extension's trigger function directly
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "
    try {
        // Find the extension
        let extension = imports.misc.extensionUtils.extensions['$EXTENSION_NAME'];
        if (extension && extension.stateObj) {
            log('Extension found, attempting to trigger...');
            extension.stateObj._triggerWindowMovement();
            log('Trigger called successfully');
        } else {
            log('Extension not found or not loaded properly');
        }
    } catch (e) {
        log('Error triggering extension: ' + e.message);
    }
    " 2>/dev/null || print_error "Failed to trigger extension manually"
}

# Function to test keyboard shortcut
test_shortcut() {
    print_status "Testing keyboard shortcut registration..."

    # Check if the shortcut is registered in GNOME Shell
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "
    let wm = global.display.get_keybinding_action('trigger-move-windows');
    log('Keybinding action result: ' + wm);
    wm;
    " 2>/dev/null || print_error "Could not check keybinding registration"
}

# Function to check extension status
check_extension_status() {
    print_status "Checking extension internal status..."

    # Check if extension object exists and has required methods
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "
    try {
        let extension = imports.misc.extensionUtils.extensions['$EXTENSION_NAME'];
        if (extension) {
            log('Extension object exists');
            log('Extension state: ' + extension.state);
            if (extension.stateObj) {
                log('Extension state object exists');
                log('Has _triggerWindowMovement: ' + (typeof extension.stateObj._triggerWindowMovement));
                log('Has _settings: ' + (extension.stateObj._settings ? 'yes' : 'no'));
            } else {
                log('No extension state object');
            }
        } else {
            log('Extension object not found');
        }
    } catch (e) {
        log('Error checking extension: ' + e.message);
    }
    " 2>/dev/null || print_error "Could not check extension status"
}

# Function to check logs
check_logs() {
    print_status "Checking recent GNOME Shell logs..."

    journalctl --user-unit=gnome-shell --since "1 minute ago" -n 20 | grep -i "trigger\|error\|warning" || echo "No relevant logs found"
}

# Function to open test applications
open_test_apps() {
    print_status "Opening test applications..."

    # Open Firefox if available
    if command -v firefox >/dev/null 2>&1; then
        print_status "Opening Firefox..."
        firefox &
        sleep 2
    fi

    # Open a text editor
    if command -v gnome-text-editor >/dev/null 2>&1; then
        print_status "Opening Text Editor..."
        gnome-text-editor &
        sleep 2
    elif command -v gedit >/dev/null 2>&1; then
        print_status "Opening Gedit..."
        gedit &
        sleep 2
    fi

    # Open file manager
    if command -v nautilus >/dev/null 2>&1; then
        print_status "Opening Files..."
        nautilus &
        sleep 2
    fi

    print_status "Waiting for applications to fully load..."
    sleep 3
}

# Function to simulate shortcut press
simulate_shortcut() {
    print_status "Simulating Super+Shift+M keypress..."

    if command -v xdotool >/dev/null 2>&1; then
        xdotool key super+shift+m
        print_status "Shortcut simulated with xdotool"
    else
        print_warning "xdotool not available. Please press Super+Shift+M manually"
        read -p "Press Enter after you've pressed Super+Shift+M..."
    fi
}

# Main test function
run_full_test() {
    echo -e "${GREEN}Trigger Move Windows Extension - Manual Test${NC}"
    echo "=============================================="
    echo

    check_requirements
    echo

    check_workspaces
    echo

    print_status "Opening test applications..."
    open_test_apps
    echo

    print_status "Windows before movement:"
    list_windows
    echo

    check_extension_status
    echo

    test_shortcut
    echo

    print_status "Now testing the trigger..."
    print_status "Method 1: Manual extension trigger"
    trigger_manual_movement
    sleep 2
    echo

    print_status "Method 2: Keyboard shortcut simulation"
    simulate_shortcut
    sleep 2
    echo

    print_status "Windows after movement attempt:"
    list_windows
    echo

    check_logs
    echo

    print_status "Test complete!"
    print_status "Check if any windows moved to different workspaces"
}

# Function to show help
show_help() {
    echo "Manual Test Script for Trigger Move Windows Extension"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  test        Run full test suite (default)"
    echo "  status      Check extension status only"
    echo "  windows     List current windows"
    echo "  trigger     Try to trigger movement manually"
    echo "  shortcut    Test shortcut simulation"
    echo "  logs        Show recent logs"
    echo "  apps        Open test applications"
    echo "  help        Show this help"
    echo
    echo "Examples:"
    echo "  $0          # Run full test"
    echo "  $0 status   # Check extension status"
    echo "  $0 trigger  # Try manual trigger"
    echo
}

# Parse command line arguments
case "${1:-test}" in
    "test")
        run_full_test
        ;;
    "status")
        check_requirements
        check_extension_status
        ;;
    "windows")
        list_windows
        ;;
    "trigger")
        check_requirements
        trigger_manual_movement
        ;;
    "shortcut")
        simulate_shortcut
        ;;
    "logs")
        check_logs
        ;;
    "apps")
        open_test_apps
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac
