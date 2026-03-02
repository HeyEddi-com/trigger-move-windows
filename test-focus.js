
const ExtensionUtils = imports.misc.extensionUtils;
const ME = 'trigger-move-windows@eddi.local';

function testFocus(appId) {
    let extension = ExtensionUtils.extensions[ME];
    if (!extension || !extension.stateObj) {
        return JSON.stringify({error: 'Extension not active'});
    }
    
    try {
        log(`Testing focus for: ${appId}`);
        extension.stateObj._activateApp(appId);
        return JSON.stringify({success: true, message: `Attempted to activate ${appId}`});
    } catch (e) {
        return JSON.stringify({error: e.message});
    }
}
