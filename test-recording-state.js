
const Gdk = imports.gi.Gdk;

class ShortcutRecorder {
    constructor() {
        this.state = "IDLE";
        this.currentShortcut = "";
    }

    start() {
        this.state = "RECORDING";
    }

    cancel() {
        this.state = "IDLE";
    }

    handleKey(keyval, mask) {
        if (this.state !== "RECORDING")
            return false;
        
        // In actual implementation, we would call formatKeyComboToString
        // For the test, we just set state back to IDLE
        this.state = "IDLE";
        return true;
    }
}

function test() {
    let recorder = new ShortcutRecorder();
    let passed = 0;
    let total = 0;

    function assert(condition, message) {
        total++;
        if (condition) {
            print(`PASS: ${message}`);
            passed++;
        } else {
            print(`FAIL: ${message}`);
        }
    }

    // Test 1: Initial state
    assert(recorder.state === "IDLE", "Initial state is IDLE");

    // Test 2: Start recording
    recorder.start();
    assert(recorder.state === "RECORDING", "State is RECORDING after start()");

    // Test 3: Cancel recording
    recorder.cancel();
    assert(recorder.state === "IDLE", "State is IDLE after cancel()");

    // Test 4: Handle key
    recorder.start();
    let handled = recorder.handleKey(Gdk.KEY_m, Gdk.ModifierType.CONTROL_MASK);
    assert(handled === true, "handleKey returns true when recording");
    assert(recorder.state === "IDLE", "State returns to IDLE after key handled");

    if (passed === total) {
        print("ALL TESTS PASSED");
        imports.system.exit(0);
    } else {
        print(`${total - passed} TESTS FAILED`);
        imports.system.exit(1);
    }
}

test();
