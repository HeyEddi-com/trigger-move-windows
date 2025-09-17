#!/bin/bash
# test-direct.sh - Direct GNOME Shell JavaScript testing script
#
# This script directly executes JavaScript code in GNOME Shell to test
# extension functionality without relying on the extension loading mechanism.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DIRECT-TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to execute JavaScript in GNOME Shell
exec_js() {
    local js_code="$1"
    gdbus call --session \
        --dest org.gnome.Shell \
        --object-path /org/gnome/Shell \
        --method org.gnome.Shell.Eval \
        "$js_code" 2>/dev/null
}

# Test basic GNOME Shell functionality
test_basic() {
    print_status "Testing basic GNOME Shell JavaScript execution..."

    local result
    result=$(exec_js "global.get_window_actors().length")

    if [[ $result == *"true"* ]]; then
        print_success "GNOME Shell JavaScript execution works"
    else
        print_error "GNOME Shell JavaScript execution failed"
        echo "Result: $result"
        exit 1
    fi
}

# Test notification system
test_notifications() {
    print_status "Testing notification system..."

    local result
    result=$(exec_js "imports.ui.main.notify('Test', 'Direct JavaScript test notification'); true")

    if [[ $result == *"true"* ]]; then
        print_success "Notification test sent - you should see a notification"
    else
        print_error "Notification test failed"
        echo "Result: $result"
    fi
}

# Test window listing
test_windows() {
    print_status "Testing window enumeration..."

    local js_code='
    try {
        let windows = global.get_window_actors();
        let normalWindows = windows.filter(w =>
            w.get_meta_window().get_window_type() === Meta.WindowType.NORMAL
        );

        let windowInfo = normalWindows.map(w => {
            let meta = w.get_meta_window();
            return {
                title: meta.get_title(),
                wmClass: meta.get_wm_class(),
                workspace: meta.get_workspace().index()
            };
        });

        imports.ui.main.notify("Windows Found",
            `Found ${normalWindows.length} normal windows:\\n` +
            windowInfo.slice(0, 3).map(w => `${w.wmClass}: ${w.title}`).join("\\n")
        );

        JSON.stringify({success: true, count: normalWindows.length, windows: windowInfo});
    } catch (e) {
        JSON.stringify({success: false, error: e.message});
    }'

    local result
    result=$(exec_js "$js_code")

    print_status "Window enumeration result:"
    echo "$result" | sed 's/.*true, "//' | sed 's/")$//' | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if data.get('success'):
        print(f\"Found {data['count']} windows\")
        for w in data['windows'][:3]:
            print(f\"  - {w['wmClass']}: {w['title'][:50]}...\")
    else:
        print(f\"Error: {data['error']}\")
except:
    print('Could not parse result')
"
}

# Test workspace operations
test_workspaces() {
    print_status "Testing workspace operations..."

    local js_code='
    try {
        let workspaceManager = global.workspace_manager;
        let currentWs = workspaceManager.get_active_workspace();
        let totalWs = workspaceManager.get_n_workspaces();

        imports.ui.main.notify("Workspace Info",
            `Current: ${currentWs.index() + 1}/${totalWs}`
        );

        JSON.stringify({
            success: true,
            current: currentWs.index() + 1,
            total: totalWs
        });
    } catch (e) {
        JSON.stringify({success: false, error: e.message});
    }'

    local result
    result=$(exec_js "$js_code")

    print_status "Workspace test result:"
    echo "$result" | sed 's/.*true, "//' | sed 's/")$//' | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if data.get('success'):
        print(f\"Current workspace: {data['current']}/{data['total']}\")
    else:
        print(f\"Error: {data['error']}\")
except:
    print('Could not parse result')
"
}

# Test direct window movement
test_window_movement() {
    print_status "Testing direct window movement..."

    local js_code='
    try {
        // Find Firefox window
        let windows = global.get_window_actors();
        let firefoxWindow = null;

        for (let windowActor of windows) {
            let meta = windowActor.get_meta_window();
            if (meta.get_window_type() === Meta.WindowType.NORMAL) {
                let wmClass = meta.get_wm_class();
                let title = meta.get_title();

                if (wmClass && (wmClass.toLowerCase().includes("firefox") ||
                               wmClass.toLowerCase().includes("chrome"))) {
                    firefoxWindow = meta;
                    break;
                }

                if (title && title.toLowerCase().includes("firefox")) {
                    firefoxWindow = meta;
                    break;
                }
            }
        }

        if (firefoxWindow) {
            let currentWs = firefoxWindow.get_workspace().index();
            let workspaceManager = global.workspace_manager;
            let targetWs = workspaceManager.get_workspace_by_index(1); // Workspace 2 (0-based)

            if (currentWs !== 1) {
                firefoxWindow.change_workspace(targetWs);
                imports.ui.main.notify("Window Moved",
                    `Moved ${firefoxWindow.get_wm_class()} to workspace 2`
                );
                JSON.stringify({success: true, moved: true, app: firefoxWindow.get_wm_class()});
            } else {
                imports.ui.main.notify("Window Already There",
                    `${firefoxWindow.get_wm_class()} is already on workspace 2`
                );
                JSON.stringify({success: true, moved: false, app: firefoxWindow.get_wm_class()});
            }
        } else {
            imports.ui.main.notify("No Browser Found",
                "Could not find Firefox or Chrome window to move"
            );
            JSON.stringify({success: false, error: "No Firefox/Chrome window found"});
        }
    } catch (e) {
        imports.ui.main.notify("Movement Error", e.message);
        JSON.stringify({success: false, error: e.message});
    }'

    local result
    result=$(exec_js "$js_code")

    print_status "Window movement test result:"
    echo "$result" | sed 's/.*true, "//' | sed 's/")$//' | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if data.get('success'):
        if data.get('moved'):
            print(f\"Successfully moved {data['app']} to workspace 2\")
        else:
            print(f\"{data['app']} was already on workspace 2\")
    else:
        print(f\"Error: {data['error']}\")
except:
    print('Could not parse result')
"
}

# Check extension status
check_extension_status() {
    print_status "Checking extension loading status..."

    local js_code='
    try {
        let extensionUtils = imports.misc.extensionUtils;
        let ext = extensionUtils.extensions["trigger-move-windows@eddi.local"];

        if (ext) {
            imports.ui.main.notify("Extension Status",
                `Extension found. State: ${ext.state}`
            );
            JSON.stringify({
                found: true,
                state: ext.state,
                hasStateObj: !!ext.stateObj,
                error: ext.error ? ext.error.message : null
            });
        } else {
            imports.ui.main.notify("Extension Status",
                "Extension not found in extension system"
            );
            JSON.stringify({found: false});
        }
    } catch (e) {
        JSON.stringify({found: false, error: e.message});
    }'

    local result
    result=$(exec_js "$js_code")

    print_status "Extension status result:"
    echo "$result" | sed 's/.*true, "//' | sed 's/")$//' | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if data.get('found'):
        print(f\"Extension found with state: {data['state']}\")
        print(f\"Has state object: {data['hasStateObj']}\")
        if data.get('error'):
            print(f\"Extension error: {data['error']}\")
    else:
        print(\"Extension not found in GNOME Shell extension system\")
        if data.get('error'):
            print(f\"Check error: {data['error']}\")
except:
    print('Could not parse result')
"
}

# Main test function
run_all_tests() {
    echo -e "${GREEN}GNOME Shell Direct JavaScript Testing${NC}"
    echo "====================================="
    echo

    test_basic
    echo

    test_notifications
    echo

    test_workspaces
    echo

    test_windows
    echo

    check_extension_status
    echo

    print_status "Opening a browser for movement test..."
    if command -v firefox >/dev/null 2>&1; then
        firefox &
        sleep 3
        test_window_movement
    elif command -v google-chrome >/dev/null 2>&1; then
        google-chrome &
        sleep 3
        test_window_movement
    else
        print_status "No Firefox or Chrome found for movement test"
    fi

    echo
    print_status "All tests completed!"
    print_status "If you saw notifications, the JavaScript execution works"
    print_status "If window movement worked, the core functionality is fine"
}

# Parse command line arguments
case "${1:-all}" in
    "all"|"test")
        run_all_tests
        ;;
    "basic")
        test_basic
        ;;
    "notify")
        test_notifications
        ;;
    "windows")
        test_windows
        ;;
    "workspaces")
        test_workspaces
        ;;
    "move")
        test_window_movement
        ;;
    "status")
        check_extension_status
        ;;
    "help"|"--help"|"-h")
        echo "Direct GNOME Shell JavaScript Testing"
        echo
        echo "Usage: $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  all         Run all tests (default)"
        echo "  basic       Test basic JavaScript execution"
        echo "  notify      Test notification system"
        echo "  windows     Test window enumeration"
        echo "  workspaces  Test workspace operations"
        echo "  move        Test window movement"
        echo "  status      Check extension status"
        echo "  help        Show this help"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
