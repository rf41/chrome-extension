/**
 * Background service worker for the Custom Shortcut Extension
 * Listens for shortcut commands and opens the saved URL
 */

// Default URL to open if none is saved
const DEFAULT_URL = "https://example.com";

// Listen for the keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-custom-url") {
    // Open options page instead of URL
    chrome.runtime.openOptionsPage();
  } else {
    // Handle custom shortcuts from user settings
    chrome.storage.sync.get(["customShortcuts"], (result) => {
      if (result.customShortcuts) {
        const shortcut = result.customShortcuts.find(s => s.command === command);
        if (shortcut && shortcut.url) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
              chrome.tabs.update(tabs[0].id, {url: shortcut.url});
            }
          });
        }
      }
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getShortcuts") {
    // Get shortcuts from storage and send back to content script
    chrome.storage.sync.get(["customShortcuts"], (result) => {
      sendResponse({shortcuts: result.customShortcuts || []});
    });
    return true; // Required for async response
  } 
  else if (message.action === "openOptions") {
    // Open options page
    chrome.runtime.openOptionsPage();
  }
});

// Listen for install events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page when extension is first installed
    chrome.runtime.openOptionsPage();
  }
});