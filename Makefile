# Makefile for Trigger Move Windows GNOME Shell Extension
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 2 of the License, or
# (at your option) any later version.

EXTENSION_NAME = trigger-move-windows@eddi.local
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(EXTENSION_NAME)
SCHEMA_DIR = $(EXTENSION_DIR)/schemas
SCHEMA_FILE = org.gnome.shell.extensions.trigger-move-windows.gschema.xml

# Files to install
EXTENSION_FILES = \
	extension.js \
	prefs.js \
	metadata.json \
	stylesheet.css \
	README.md

SCHEMA_FILES = \
	schemas/$(SCHEMA_FILE)

.PHONY: all install uninstall enable disable restart-shell compile-schemas clean help

all: help

help:
	@echo "Trigger Move Windows Extension - Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  install        Install extension to user directory"
	@echo "  uninstall      Remove extension from user directory"
	@echo "  enable         Enable the extension"
	@echo "  disable        Disable the extension"
	@echo "  restart-shell  Restart GNOME Shell (X11 only)"
	@echo "  compile-schemas Compile GSettings schemas"
	@echo "  clean          Clean build artifacts"
	@echo "  package        Create installable package"
	@echo "  dev-install    Install for development (with symlinks)"
	@echo "  test           Run basic tests"
	@echo ""
	@echo "Usage:"
	@echo "  make install && make enable    # Install and enable extension"
	@echo "  make uninstall                 # Remove extension"

install: compile-schemas
	@echo "Installing Trigger Move Windows extension..."
	@mkdir -p $(EXTENSION_DIR)
	@mkdir -p $(SCHEMA_DIR)
	@cp -r $(EXTENSION_FILES) $(EXTENSION_DIR)/
	@cp -r schemas/* $(SCHEMA_DIR)/
	@echo "Extension installed to: $(EXTENSION_DIR)"
	@echo "Run 'make enable' to enable the extension"

dev-install:
	@echo "Installing for development with symlinks..."
	@mkdir -p $(EXTENSION_DIR)
	@ln -sf $(PWD)/extension.js $(EXTENSION_DIR)/
	@ln -sf $(PWD)/prefs.js $(EXTENSION_DIR)/
	@ln -sf $(PWD)/metadata.json $(EXTENSION_DIR)/
	@ln -sf $(PWD)/stylesheet.css $(EXTENSION_DIR)/
	@ln -sf $(PWD)/README.md $(EXTENSION_DIR)/
	@mkdir -p $(SCHEMA_DIR)
	@ln -sf $(PWD)/schemas/$(SCHEMA_FILE) $(SCHEMA_DIR)/
	@$(MAKE) compile-schemas
	@echo "Development installation complete"

uninstall: disable
	@echo "Uninstalling Trigger Move Windows extension..."
	@rm -rf $(EXTENSION_DIR)
	@echo "Extension uninstalled"

enable:
	@echo "Enabling Trigger Move Windows extension..."
	@gnome-extensions enable $(EXTENSION_NAME)
	@echo "Extension enabled"

disable:
	@echo "Disabling Trigger Move Windows extension..."
	@gnome-extensions disable $(EXTENSION_NAME) || true
	@echo "Extension disabled"

restart-shell:
	@echo "Restarting GNOME Shell..."
	@if [ "$$XDG_SESSION_TYPE" = "x11" ]; then \
		busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'global.relaunch_shell()'; \
	else \
		echo "Cannot restart shell on Wayland. Please log out and log back in."; \
	fi

compile-schemas:
	@echo "Compiling GSettings schemas..."
	@mkdir -p $(SCHEMA_DIR)
	@glib-compile-schemas $(SCHEMA_DIR)
	@echo "Schemas compiled"

package: clean
	@echo "Creating installation package (zip)..."
	@mkdir -p dist
	@zip -jr dist/$(EXTENSION_NAME).zip $(EXTENSION_FILES)
	@mkdir -p dist/schemas
	@cp schemas/$(SCHEMA_FILE) dist/schemas/
	@cd dist && zip -r $(EXTENSION_NAME).zip schemas/$(SCHEMA_FILE)
	@rm -rf dist/schemas
	@echo "Package created: dist/$(EXTENSION_NAME).zip"
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@rm -f schemas/*.compiled
	@echo "Clean complete"

test:
	@echo "Running basic tests..."
	@echo "Checking extension files..."
	@for file in $(EXTENSION_FILES); do \
		if [ ! -f "$$file" ]; then \
			echo "ERROR: Missing file: $$file"; \
			exit 1; \
		fi; \
		echo "✓ $$file"; \
	done
	@echo "Checking schema file..."
	@if [ ! -f "schemas/$(SCHEMA_FILE)" ]; then \
		echo "ERROR: Missing schema file"; \
		exit 1; \
	fi
	@echo "✓ Schema file found"
	@echo "Validating metadata.json..."
	@python3 -m json.tool metadata.json > /dev/null && echo "✓ Valid JSON" || (echo "ERROR: Invalid JSON" && exit 1)
	@echo "All tests passed!"

status:
	@echo "Extension Status:"
	@echo "  Installed: $$(test -d $(EXTENSION_DIR) && echo 'Yes' || echo 'No')"
	@echo "  Enabled: $$(gnome-extensions list --enabled | grep -q $(EXTENSION_NAME) && echo 'Yes' || echo 'No')"
	@echo "  Extension Directory: $(EXTENSION_DIR)"

log:
	@echo "Showing extension logs (press Ctrl+C to stop)..."
	@journalctl -f | grep -i "trigger.*move.*windows\|$(EXTENSION_NAME)" --color=always

debug: enable
	@echo "Enabling debug mode and showing logs..."
	@gsettings set org.gnome.shell.extensions.trigger-move-windows debug-logging true
	@echo "Debug logging enabled. Press Ctrl+C to stop log monitoring..."
	@$(MAKE) log

# Development helpers
dev: dev-install enable debug

reset:
	@echo "Resetting extension settings..."
	@gsettings reset-recursively org.gnome.shell.extensions.trigger-move-windows || true
	@echo "Settings reset to defaults"

# System integration
system-install: compile-schemas
	@echo "Installing system-wide (requires sudo)..."
	@sudo mkdir -p /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)
	@sudo cp -r $(EXTENSION_FILES) /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)/
	@sudo mkdir -p /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)/schemas
	@sudo cp -r schemas/* /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)/schemas/
	@sudo glib-compile-schemas /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)/schemas/
	@echo "System-wide installation complete"

system-uninstall:
	@echo "Removing system-wide installation (requires sudo)..."
	@sudo rm -rf /usr/share/gnome-shell/extensions/$(EXTENSION_NAME)
	@echo "System-wide removal complete"
