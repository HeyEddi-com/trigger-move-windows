#!/bin/bash
# demo.sh - Demo script for Trigger Move Windows GNOME Extension
#
# This script helps test the extension functionality by opening test applications
# and demonstrating the window movement capabilities.
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
    echo -e "${BLUE}[DEMO]${NC} $1"
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

# Function to check if extension is installed and enabled
check_extension() {
    print_status "Checking extension status..."

    if ! gnome-extensions list --enabled | grep -q "$EXTENSION_NAME"; then
        print_error "Extension is not enabled. Please install and enable it first:"
        echo "  ./install.sh"
        echo "  gnome-extensions enable $EXTENSION_NAME"
        exit 1
    fi

    print_success "Extension is enabled and ready"
}

# Function to get current shortcut
get_shortcut() {
    local shortcut=$(gsettings get org.gnome.shell.extensions.trigger-move-windows trigger-shortcut 2>/dev/null || echo "['<Super><Shift>m']")
    shortcut=$(echo "$shortcut" | sed "s/\['//g" | sed "s/'\]//g" | sed "s/<Super>/Super+/g" | sed "s/<Shift>/Shift+/g" | sed "s/<Control>/Ctrl+/g" | sed "s/<Alt>/Alt+/g")
    echo "$shortcut"
}

# Function to open test applications
open_test_apps() {
    print_status "Opening test applications..."

    local apps_opened=0

    # Try to open common applications that might be available
    local test_apps=(
        "firefox:Firefox"
        "google-chrome:Chrome"
        "chromium:Chromium"
        "code:VS Code"
        "gnome-text-editor:Text Editor"
        "nautilus:Files"
        "gnome-calculator:Calculator"
        "gnome-terminal:Terminal"
    )

    for app_info in "${test_apps[@]}"; do
        local app_cmd=$(echo "$app_info" | cut -d: -f1)
        local app_name=$(echo "$app_info" | cut -d: -f2)

        if command -v "$app_cmd" >/dev/null 2>&1; then
            print_status "Opening $app_name..."
            "$app_cmd" &
            apps_opened=$((apps_opened + 1))
            sleep 1
        fi

        # Don't open too many apps
        if [ $apps_opened -ge 4 ]; then
            break
        fi
    done

    if [ $apps_opened -eq 0 ]; then
        print_warning "No test applications could be opened. Please open some applications manually."
        print_status "Try opening: Firefox, Chrome, VS Code, Text Editor, or any other apps"
    else
        print_success "Opened $apps_opened test applications"
    fi

    print_status "Waiting 3 seconds for applications to fully load..."
    sleep 3
}

# Function to show current window information
show_window_info() {
    print_status "Current windows that would be affected:"

    # Enable debug logging temporarily to see window info
    local old_debug=$(gsettings get org.gnome.shell.extensions.trigger-move-windows debug-logging)
    gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging true

    print_status "Debug logging enabled. Check journal output for window details:"
    echo "  journalctl -f | grep TriggerMoveWindows &"
    echo "  # Press the trigger shortcut, then Ctrl+C to stop log monitoring"

    # Restore old debug setting after a moment
    sleep 1
    if [ "$old_debug" = "false" ]; then
        gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging false
        print_status "Debug logging restored to previous state"
    fi
}

# Function to demonstrate the extension
demo_extension() {
    local shortcut=$(get_shortcut)

    print_status "Ready to demonstrate the extension!"
    echo
    echo -e "${BLUE}How to test:${NC}"
    echo "  1. Look at your current workspace and note which applications are open"
    echo "  2. Press the keyboard shortcut: ${GREEN}$shortcut${NC}"
    echo "  3. Watch as applications move to their configured workspaces"
    echo "  4. Check other workspaces to see where applications moved"
    echo
    echo -e "${BLUE}Default configurations:${NC}"
    echo "  • Firefox, Chrome → Workspace 2"
    echo "  • VS Code, Text Editor → (not configured by default)"
    echo "  • Calculator, Terminal → (not configured by default)"
    echo
    echo -e "${BLUE}Notifications:${NC}"
    echo "  You should see a desktop notification showing the results"
    echo

    read -p "Press Enter to continue or Ctrl+C to exit..."

    print_status "Extension demo ready. Press $shortcut when ready!"
}

# Function to show configuration options
show_config() {
    print_status "Current extension configuration:"

    local shortcut=$(get_shortcut)
    local notifications=$(gsettings get org.gnome.shell.extensions.trigger-move-windows show-notifications)
    local skip_correct=$(gsettings get org.gnome.shell.extensions.trigger-move-windows skip-correct-workspace)
    local debug=$(gsettings get org.gnome.shell.extensions.trigger-move-windows debug-logging)
    local app_configs=$(gsettings get org.gnome.shell.extensions.trigger-move-windows app-configs)

    echo "  Shortcut: $shortcut"
    echo "  Show notifications: $notifications"
    echo "  Skip correct workspace: $skip_correct"
    echo "  Debug logging: $debug"
    echo "  App configurations: $app_configs"
    echo
    echo "To modify configuration:"
    echo "  gnome-extensions prefs $EXTENSION_NAME"
}

# Function to test specific scenarios
test_scenarios() {
    print_status "Testing specific scenarios..."

    echo
    echo -e "${BLUE}Scenario 1: Basic Movement${NC}"
    echo "  Open Firefox and Chrome, then press the trigger shortcut"
    echo "  Both should move to workspace 2"
    echo

    echo -e "${BLUE}Scenario 2: Mixed Applications${NC}"
    echo "  Open various applications across different workspaces"
    echo "  Press trigger shortcut to organize them"
    echo

    echo -e "${BLUE}Scenario 3: No Matching Applications${NC}"
    echo "  Close all configured applications"
    echo "  Press trigger shortcut - should show 'No windows found' notification"
    echo

    echo -e "${BLUE}Scenario 4: Already Correct Workspace${NC}"
    echo "  Move Firefox to workspace 2 manually"
    echo "  Press trigger shortcut - should skip it (if skip option enabled)"
    echo
}

# Function to enable debug mode
enable_debug() {
    print_status "Enabling debug mode..."
    gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging true
    print_success "Debug logging enabled"
    print_status "To view logs: journalctl -f | grep TriggerMoveWindows"
}

# Function to disable debug mode
disable_debug() {
    print_status "Disabling debug mode..."
    gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging false
    print_success "Debug logging disabled"
}

# Function to reset settings
reset_settings() {
    print_warning "This will reset all extension settings to defaults"
    read -p "Continue? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gsettings reset-recursively org.gnome.shell.extensions.trigger-move-windows
        print_success "Settings reset to defaults"
    else
        print_status "Reset cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Trigger Move Windows Extension - Demo Script"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  demo        Run interactive demo (default)"
    echo "  test-apps   Open test applications"
    echo "  info        Show window information"
    echo "  config      Show current configuration"
    echo "  scenarios   Show test scenarios"
    echo "  debug-on    Enable debug logging"
    echo "  debug-off   Disable debug logging"
    echo "  reset       Reset settings to defaults"
    echo "  help        Show this help"
    echo
    echo "Examples:"
    echo "  $0          # Run interactive demo"
    echo "  $0 demo     # Run interactive demo"
    echo "  $0 test-apps # Open test applications"
    echo "  $0 debug-on # Enable debug mode"
    echo
}

# Main demo function
main_demo() {
    echo -e "${GREEN}Trigger Move Windows Extension - Demo${NC}"
    echo "============================================"
    echo

    check_extension
    show_config

    local shortcut=$(get_shortcut)
    print_status "Demo will open test applications and guide you through testing"
    print_status "Current trigger shortcut: $shortcut"
    echo

    read -p "Open test applications? [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        open_test_apps
    fi

    demo_extension
}

# Parse command line arguments
case "${1:-demo}" in
    "demo")
        main_demo
        ;;
    "test-apps")
        check_extension
        open_test_apps
        ;;
    "info")
        check_extension
        show_window_info
        ;;
    "config")
        check_extension
        show_config
        ;;
    "scenarios")
        test_scenarios
        ;;
    "debug-on")
        enable_debug
        ;;
    "debug-off")
        disable_debug
        ;;
    "reset")
        reset_settings
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
