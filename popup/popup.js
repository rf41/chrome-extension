/**
 * Popup script for the Custom Shortcut Extension
 * Handles displaying and opening the saved URL
 */

// DOM elements
const currentUrlDiv = document.getElementById('currentUrl');
const openUrlBtn = document.getElementById('openUrlBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');
const shortcutsListDiv = document.getElementById('shortcutsList');

// Default URL
const DEFAULT_URL = "https://example.com";

// When the popup loads, get the saved URL from storage
document.addEventListener('DOMContentLoaded', () => {
  // Get the custom URL from storage
  chrome.storage.sync.get(['customUrl', 'customShortcuts'], (result) => {
    // Display the default URL in the popup
    const savedUrl = result.customUrl || DEFAULT_URL;
    currentUrlDiv.textContent = `Default URL: ${savedUrl}`;
    
    // Display custom shortcuts if they exist
    const shortcuts = result.customShortcuts || [];
    if (shortcuts.length > 0 && shortcutsListDiv) {
      let shortcutsHtml = '<ul class="shortcuts-list">';
      
      shortcuts.forEach(shortcut => {
        shortcutsHtml += `
          <li class="shortcut-item">
            <button class="shortcut-button" data-url="${shortcut.url}">
              <span class="shortcut-title">${shortcut.title}</span>
              <span class="shortcut-key">${shortcut.shortcutKey || 'No shortcut'}</span>
            </button>
          </li>`;
      });
      
      shortcutsHtml += '</ul>';
      shortcutsListDiv.innerHTML = shortcutsHtml;
      
      // Add click handlers to shortcut buttons
      document.querySelectorAll('.shortcut-button').forEach(button => {
        button.addEventListener('click', () => {
          const url = button.getAttribute('data-url');
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
              chrome.tabs.update(tabs[0].id, {url: url});
            }
          });
          window.close();
        });
      });
    } else if (shortcutsListDiv) {
      shortcutsListDiv.innerHTML = '<p class="no-shortcuts">No shortcuts configured yet.</p>';
    }
  });
  
  // Add event listener to open options button
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      // Close the popup after opening the options page
      window.close();
    });
  }
});

// Open the saved URL when the button is clicked
openUrlBtn.addEventListener('click', () => {
  chrome.storage.sync.get(['customUrl'], (result) => {
    const urlToOpen = result.customUrl || DEFAULT_URL;
    // Open in the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, {url: urlToOpen});
      }
    });
    // Close the popup after opening the URL
    window.close();
  });
});

// Open the options page when the change URL button is clicked
openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  // Close the popup after opening the options page
  window.close();
});