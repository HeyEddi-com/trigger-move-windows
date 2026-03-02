
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

// This will be our helper function
function formatKeyComboToString(keyval, mask) {
    // Standard GTK accelerator name
    let name = Gtk.accelerator_name(keyval, mask);
    
    // Normalize: GNOME settings usually uses <Control> instead of <Primary>
    // and sometimes we need to cleanup the string
    return name;
}

function test() {
    const tests = [
        { keyval: Gdk.KEY_m, mask: Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.SHIFT_MASK, expected: "<Shift><Control>m" },
        { keyval: Gdk.KEY_a, mask: Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.SHIFT_MASK, expected: "<Shift><Super>a" },
        { keyval: Gdk.KEY_Escape, mask: 0, expected: "Escape" }
    ];

    let passed = 0;
    tests.forEach((t, i) => {
        const result = formatKeyComboToString(t.keyval, t.mask);
        if (result === t.expected) {
            print(`Test ${i + 1} PASSED`);
            passed++;
        } else {
            print(`Test ${i + 1} FAILED: Expected "${t.expected}", got "${result}"`);
        }
    });

    if (passed === tests.length) {
        print("ALL TESTS PASSED");
        imports.system.exit(0);
    } else {
        print(`${tests.length - passed} TESTS FAILED`);
        imports.system.exit(1);
    }
}

test();
