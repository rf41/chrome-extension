/**
 * Popup script for the Custom Shortcut Extension
 * Handles the options button click
 */

// DOM elements
const openOptionsBtn = document.getElementById('openOptionsBtn');

// When the popup loads
document.addEventListener('DOMContentLoaded', () => {
  // Add event listener to open options button
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }
  
  // Get extension name and version from manifest
  chrome.management.getSelf(info => {
    const versionDiv = document.querySelector('.version-info');
    if (versionDiv && info.name && info.version) {
      versionDiv.textContent = `${info.name} v${info.version}`;
    }
  });
});