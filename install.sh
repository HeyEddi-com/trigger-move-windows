#!/bin/bash
# install.sh - Installation script for Trigger Move Windows GNOME Extension
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 2 of the License, or
# (at your option) any later version.

set -e  # Exit on any error

EXTENSION_NAME="trigger-move-windows@eddi.local"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"
SCHEMA_DIR="$EXTENSION_DIR/schemas"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if GNOME Shell is running
    if ! pgrep -x "gnome-shell" > /dev/null; then
        print_error "GNOME Shell is not running. This extension requires GNOME Shell."
        exit 1
    fi

    # Check GNOME Shell version
    local gnome_version=$(gnome-shell --version | grep -oP '\d+\.\d+' | head -1)
    local major_version=$(echo $gnome_version | cut -d. -f1)

    if [ "$major_version" -lt 45 ]; then
        print_error "GNOME Shell version $gnome_version is not supported. Minimum required: 45.0"
        exit 1
    fi

    print_success "GNOME Shell version $gnome_version detected"

    # Check for required commands
    local required_commands=("glib-compile-schemas" "gnome-extensions")
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            print_error "Required command '$cmd' not found. Please install the necessary packages."
            exit 1
        fi
    done

    print_success "All prerequisites met"
}

# Function to install extension files
install_extension() {
    print_status "Installing Trigger Move Windows extension..."

    # Create directories
    mkdir -p "$EXTENSION_DIR"
    mkdir -p "$SCHEMA_DIR"

    # Copy extension files
    local files=("extension.js" "prefs.js" "metadata.json" "stylesheet.css" "README.md")
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$EXTENSION_DIR/"
            print_status "Copied $file"
        else
            print_warning "File $file not found, skipping"
        fi
    done

    # Copy schema files
    if [ -d "schemas" ]; then
        cp schemas/* "$SCHEMA_DIR/"
        print_status "Copied schema files"
    else
        print_error "Schema directory not found"
        exit 1
    fi

    print_success "Extension files installed to $EXTENSION_DIR"
}

# Function to compile schemas
compile_schemas() {
    print_status "Compiling GSettings schemas..."

    if ! glib-compile-schemas "$SCHEMA_DIR"; then
        print_error "Failed to compile schemas"
        exit 1
    fi

    print_success "Schemas compiled successfully"
}

# Function to enable extension
enable_extension() {
    print_status "Enabling extension..."

    if gnome-extensions enable "$EXTENSION_NAME" 2>/dev/null; then
        print_success "Extension enabled successfully"
    else
        print_warning "Could not enable extension automatically"
        print_status "You can enable it manually using: gnome-extensions enable $EXTENSION_NAME"
        print_status "Or use the GNOME Extensions app"
    fi
}

# Function to restart GNOME Shell if needed
restart_shell() {
    if [ "$XDG_SESSION_TYPE" = "x11" ]; then
        print_status "Restarting GNOME Shell..."
        if busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'global.relaunch_shell()' 2>/dev/null; then
            print_success "GNOME Shell restarted"
        else
            print_warning "Could not restart GNOME Shell automatically"
            print_status "Please restart GNOME Shell manually: Alt+F2, type 'r', press Enter"
        fi
    else
        print_warning "Running on Wayland - cannot restart shell automatically"
        print_status "Please log out and log back in to complete installation"
    fi
}

# Function to show post-installation information
show_info() {
    echo
    print_success "Installation completed successfully!"
    echo
    echo -e "${BLUE}Extension Information:${NC}"
    echo "  Name: Trigger Move Windows"
    echo "  ID: $EXTENSION_NAME"
    echo "  Location: $EXTENSION_DIR"
    echo
    echo -e "${BLUE}Usage:${NC}"
    echo "  Default shortcut: Super+Shift+M"
    echo "  Configure: gnome-extensions prefs $EXTENSION_NAME"
    echo "  Or use the GNOME Extensions app"
    echo
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "  View logs: journalctl -f | grep TriggerMoveWindows"
    echo "  Enable debug: gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging true"
    echo "  Reset settings: gsettings reset-recursively org.gnome.shell.extensions.trigger-move-windows"
    echo
}

# Function to uninstall extension
uninstall_extension() {
    print_status "Uninstalling Trigger Move Windows extension..."

    # Disable extension first
    if gnome-extensions list --enabled | grep -q "$EXTENSION_NAME"; then
        print_status "Disabling extension..."
        gnome-extensions disable "$EXTENSION_NAME" || true
    fi

    # Remove extension directory
    if [ -d "$EXTENSION_DIR" ]; then
        rm -rf "$EXTENSION_DIR"
        print_success "Extension files removed"
    else
        print_warning "Extension directory not found"
    fi

    print_success "Uninstallation completed"
}

# Function to show help
show_help() {
    echo "Trigger Move Windows - GNOME Shell Extension Installer"
    echo
    echo "Usage: $0 [OPTION]"
    echo
    echo "Options:"
    echo "  install     Install the extension (default)"
    echo "  uninstall   Remove the extension"
    echo "  reinstall   Uninstall and install again"
    echo "  status      Show installation status"
    echo "  help        Show this help message"
    echo
    echo "Examples:"
    echo "  $0              # Install extension"
    echo "  $0 install      # Install extension"
    echo "  $0 uninstall    # Remove extension"
    echo "  $0 reinstall    # Reinstall extension"
    echo
}

# Function to show status
show_status() {
    echo -e "${BLUE}Trigger Move Windows Extension Status:${NC}"

    if [ -d "$EXTENSION_DIR" ]; then
        echo -e "  Installed: ${GREEN}Yes${NC}"
        echo "  Location: $EXTENSION_DIR"
    else
        echo -e "  Installed: ${RED}No${NC}"
    fi

    if gnome-extensions list --enabled | grep -q "$EXTENSION_NAME"; then
        echo -e "  Enabled: ${GREEN}Yes${NC}"
    elif gnome-extensions list --disabled | grep -q "$EXTENSION_NAME"; then
        echo -e "  Enabled: ${YELLOW}No${NC} (disabled)"
    else
        echo -e "  Enabled: ${RED}No${NC} (not found)"
    fi

    # Check GNOME Shell version
    local gnome_version=$(gnome-shell --version 2>/dev/null || echo "Unknown")
    echo "  GNOME Shell: $gnome_version"

    # Check session type
    echo "  Session Type: ${XDG_SESSION_TYPE:-Unknown}"
}

# Main installation function
main_install() {
    echo -e "${GREEN}Trigger Move Windows - GNOME Shell Extension Installer${NC}"
    echo "============================================================"
    echo

    check_prerequisites
    install_extension
    compile_schemas

    echo
    print_status "Installation phase completed. Attempting to enable extension..."

    enable_extension

    # Only restart shell on X11 and if user confirms
    if [ "$XDG_SESSION_TYPE" = "x11" ]; then
        echo
        read -p "Restart GNOME Shell now? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            restart_shell
        else
            print_status "Skipping shell restart. Please restart manually: Alt+F2, type 'r', press Enter"
        fi
    fi

    show_info
}

# Parse command line arguments
case "${1:-install}" in
    "install")
        main_install
        ;;
    "uninstall")
        uninstall_extension
        ;;
    "reinstall")
        uninstall_extension
        echo
        main_install
        ;;
    "status")
        show_status
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        echo
        show_help
        exit 1
        ;;
esac
