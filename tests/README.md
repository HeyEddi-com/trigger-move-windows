# Tests

## Unit tests (Node.js, no GNOME session)

Pure logic (e.g. accelerator string validation) runs under Node’s built-in runner:

```bash
make test-unit
# or
npm test
```

Requires **Node 18+** (`node --test`).

## Smoke / black-box (no Shell, no Node)

Checks files, JSON metadata, schema compile, policy greps (e.g. no sync `GLib.file_get_contents`), and **extensions.gnome.org–style mechanical rules** (Gtk/Gdk/Adw in `extension.js`, sync IO/spawn, `eval`, prefs must not import Shell `main.js`, metadata keys, etc.):

```bash
make test-smoke
# or
npm run test:smoke
```

The EGO-style script alone:

```bash
make test-ego
# or
sh tests/smoke/ego-gnome-review.sh
```

Optional: run **shexli** during smoke and fail on findings:

```bash
SHEXLI_STRICT=1 make test-smoke
```

Official human criteria (not fully automatable): [GNOME Shell Extensions review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html). Use that plus shexli before submission; our scripts only catch common mechanical rejections.

## Legacy Gjs tests (Gtk/Gdk typelibs)

```bash
make test-gjs
```

## Everything

```bash
make test
```

## True integration / UI tests

Automating GNOME Shell (keybindings, workspace moves) needs a session or **nested mutter** / **dbus-run-session** setups; that is not wired here. For manual checks, use `make log` while exercising the extension.
