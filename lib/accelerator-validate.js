/**
 * Pure GTK-style accelerator shape check (same rules as Mutter/GSettings strings).
 * Shared by extension.js (Shell) and Node unit tests — no Gtk/Gio here.
 *
 * @param {unknown} accel
 * @returns {boolean}
 */
export function isValidTriggerAccelerator(accel) {
  if (typeof accel !== 'string' || accel.trim() === '' || accel === 'disabled')
    return false;
  const s = accel.trim();
  return /^(?:<[^>]+>)*[^<>]+$/.test(s);
}
