/**
 * Popup script for the Custom Shortcut Extension
 * Handles the options button click and displays extension information
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

/**
 * Initialize popup functionality
 */
function initializePopup() {
  setupOptionsButton();
  displayExtensionInfo();
}

/**
 * Set up options button click handler
 */
function setupOptionsButton() {
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  } else {
    console.warn('Options button element not found in popup');
  }
}

/**
 * Display extension name and version information
 */
function displayExtensionInfo() {
  const versionDiv = document.querySelector('.version-info');
  
  if (versionDiv) {
    chrome.management.getSelf(info => {
      try {
        if (info && info.name && info.version) {
          versionDiv.textContent = `${info.name} v${info.version}`;
        } else {
          versionDiv.textContent = 'Extension info unavailable';
        }
      } catch (error) {
        console.error('Error displaying extension info:', error);
        versionDiv.textContent = 'Extension info error';
      }
    });
  }
}