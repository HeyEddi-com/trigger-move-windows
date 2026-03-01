# Language
- **JavaScript (GJS):** The standard language for GNOME Shell extensions, using the GObject Introspection bindings for GNOME's native libraries.

# Frameworks
- **GNOME Shell (GJS):** Direct integration with the Shell's internal APIs (Meta, Clutter).
- **Meta (Mutter):** Window management and workspace handling.
- **Clutter:** Shell's graphics toolkit and actor management.
- **GObject:** Foundation for GNOME's object system and signal handling.
- **Libadwaita:** Standard GNOME library for consistent, adaptive, and modern user interfaces (used for preferences).

# Build System
- **Makefile:** Simple and effective build automation for compiling schemas, installing to the local extensions directory, and creating installation packages.

# Tools
- **GSettings:** Used for storing and retrieving extension configuration and application mappings.
- **GNOME Extensions CLI:** Standard tool for enabling, disabling, and managing extensions.
