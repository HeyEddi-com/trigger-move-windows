
const Gtk = imports.gi.Gtk;

// Mock function for conflict checking
function checkShortcutConflicts(newShortcut, currentAppId, configs) {
    for (const [id, config] of Object.entries(configs)) {
        if (id === currentAppId) continue;
        
        const shortcut = typeof config === 'object' ? config.shortcut : '';
        if (shortcut === newShortcut) {
            return config.name || id;
        }
    }
    return null;
}

function test() {
    const mockConfigs = {
        "firefox": { name: "Firefox", shortcut: "<Super><Shift>f" },
        "terminal": { name: "Terminal", shortcut: "<Control><Alt>t" }
    };

    const tests = [
        { shortcut: "<Super><Shift>z", appId: "zen", expected: null, msg: "No conflict" },
        { shortcut: "<Super><Shift>f", appId: "zen", expected: "Firefox", msg: "Conflict with Firefox" },
        { shortcut: "<Super><Shift>f", appId: "firefox", expected: null, msg: "No conflict with self" }
    ];

    let passed = 0;
    tests.forEach((t, i) => {
        const result = checkShortcutConflicts(t.shortcut, t.appId, mockConfigs);
        if (result === t.expected) {
            print(`Test ${i + 1} PASSED: ${t.msg}`);
            passed++;
        } else {
            print(`Test ${i + 1} FAILED: ${t.msg}. Expected "${t.expected}", got "${result}"`);
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
