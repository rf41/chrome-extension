/**
 * Options script for the Custom Shortcut Extension
 * Handles saving and loading custom URLs and shortcuts
 */

// DOM elements - dengan pengecekan keberadaan elemen
const shortcutForm = document.getElementById('shortcutForm');
const titleInput = document.getElementById('title');
const shortcutUrlInput = document.getElementById('shortcutUrl');
const shortcutsBody = document.getElementById('shortcutsBody');
const customStatus = document.getElementById('customStatus');
const configureShortcutsBtn = document.getElementById('configureShortcutsBtn');

// Variabel opsional yang mungkin tidak ada di semua versi UI
const defaultTabBtn = document.getElementById('defaultTabBtn');
const customTabBtn = document.getElementById('customTabBtn');
const defaultTabContent = document.getElementById('defaultTabContent');
const customTabContent = document.getElementById('customTabContent');
const urlInput = document.getElementById('urlInput');
const saveBtn = document.getElementById('saveBtn');
const defaultStatus = document.getElementById('defaultStatus');

// Default URL
const DEFAULT_URL = "chrome://newtab"; // Default to Chrome's New Tab page
// Maximum number of custom shortcuts (limited by manifest)
const MAX_SHORTCUTS = 3;

// State for recording keyboard shortcuts
let isRecording = false;
let commandIdEditable = false;
let currentShortcut = {
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  key: ''
};

// Define available command IDs (must match manifest.json)
const AVAILABLE_COMMANDS = [
    'shortcut-01',
    'shortcut-02', 
    'shortcut-03',
    'shortcut-04',
    'shortcut-05',
    'shortcut-06',
    'shortcut-07',
    'shortcut-08',
    'shortcut-09',
    'shortcut-10'
  ];

const FREE_USER_LIMIT = 3; // Free users can only add 3 shortcuts per domain
let isPremiumUser = false; // Default to free user

const EXTENSION_ID = chrome.runtime.id; // Gets the current extension ID automatically

// Function to get next available command Id
function getNextAvailableCommandId() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['customShortcuts'], (result) => {
      const shortcuts = result.customShortcuts || [];
      
      // Find first command ID that's not already in use
      const usedCommandIds = shortcuts.map(s => s.command);
      const availableId = AVAILABLE_COMMANDS.find(id => !usedCommandIds.includes(id));
      
      resolve(availableId || '');
    });
  });
}

// Improved URL validation function
function isValidUrl(string) {
  // Handle empty strings
  if (!string || string.trim() === '') return false;
  
  // Add protocol if missing
  let url = string.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try { 
    const urlObj = new URL(url);
    // Additional validation - must have a valid hostname with at least one dot
    return urlObj.hostname && urlObj.hostname.includes('.') && 
           // Basic check that hostname follows domain name rules
           /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])+$/.test(urlObj.hostname);
  } catch (_) {
    return false;
  }
}

// Tab navigation
if (defaultTabBtn && customTabBtn) {
  defaultTabBtn.addEventListener('click', () => {
    defaultTabBtn.classList.add('active');
    customTabBtn.classList.remove('active');
    defaultTabContent.classList.add('active');
    customTabContent.classList.remove('active');
  });

  customTabBtn.addEventListener('click', () => {
    customTabBtn.classList.add('active');
    defaultTabBtn.classList.remove('active');
    customTabContent.classList.add('active');
    defaultTabContent.classList.remove('active');
  });
}

// Separate UI initialization and data filling
document.addEventListener('DOMContentLoaded', async () => {
  // Check premium status first
  await checkPremiumStatus();
  
  // Display premium status in UI
  displayPremiumStatus();
  
  // Initialize UI
  initializeUI();
  
  // Debug commands
  setTimeout(debugCommands, 1000);
  
  // Load data
  loadData();
  
  // Initialize collapsible sections
  initCollapsibleSections();
  
  // Add license management section
  addLicenseManagementSection();
});

// Initialization UI elements
function initializeUI() {
  // Add handler for Configure Shortcuts button
  if (configureShortcutsBtn) {
    configureShortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'chrome://extensions/shortcuts'
      });
    });
  }
  
  // Initialize guide button
  initGuideButton();
  
  // Prepare empty dropdown structure but don't fill it yet
  prepareCommandDropdown();
  
  // Check Chrome API support
  checkChromeAPIs();
  
  // Initialize table sorting
  initTableSorting();
  
  // Initialize domain auto-update
  initDomainAutoUpdate();
  
  // Enhance domain field with visual indicators
  enhanceDomainField();
  
  // Add domain restriction info
  createDomainRestrictionInfo();
  
  // Ensure domain field has proper appearance
  createDomainField();
  
  // Add license management section
  addLicenseManagementSection();
}

// Load data from storage
function loadData() {
  // Load URL data
  if (urlInput) {
    chrome.storage.sync.get(['customUrl'], (result) => {
      if (result.customUrl) {
        urlInput.value = result.customUrl;
      } else {
        urlInput.value = DEFAULT_URL;
      }
    });
  }
  
  // Load shortcuts and update UI
  loadCustomShortcuts();
}

// Save the default custom URL when the save button is clicked
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    // Get the URL from the input field
    const customUrl = urlInput.value.trim();
    
    // Validate the URL (basic check)
    if (!customUrl) {
      defaultStatus.textContent = "Please enter a valid URL";
      defaultStatus.style.color = "red";
      return;
    }
    
    // Add protocol if missing
    let urlToSave = customUrl;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      urlToSave = 'https://' + customUrl;
      urlInput.value = urlToSave;
    }
    
    // Save the URL to Chrome storage
    chrome.storage.sync.set({ customUrl: urlToSave }, () => {
      // Show success message
      defaultStatus.textContent = "Default URL saved successfully!";
      defaultStatus.style.color = "green";
      
      // Hide the message after 2 seconds
      setTimeout(() => {
        defaultStatus.textContent = "";
      }, 2000);
    });
  });
}

// Form submission handler
if (shortcutForm) {
  shortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = titleInput.value.trim();
    let url = shortcutUrlInput.value.trim();
    
    // Get the command ID from dropdown or from the edit data attribute
    const commandIdSelect = document.getElementById('commandIdSelect');
    let commandId = commandIdSelect ? commandIdSelect.value : '';
    
    // Check if we're in edit mode and get the index
    const addBtn = document.getElementById('addBtn');
    const isUpdate = addBtn && addBtn.classList.contains('update-btn');
    const editIndex = isUpdate && addBtn ? parseInt(addBtn.getAttribute('data-edit-index')) : -1;
    
    // Validate URL using the same validation function from background.js
    // First make sure the URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Import the validation function from background.js
    chrome.runtime.sendMessage({
      action: "validateUrl", 
      url: url
    }, (response) => {
      if (!response.isValid) {
        customStatus.textContent = response.reason;
        customStatus.style.color = "red";
        return;
      }
      
      // Continue with the existing form processing if URL is valid
      processFormSubmission(title, url, commandId, isUpdate, editIndex);
    });
  });
}

// Get shortcut limit based on premium status
function getShortcutLimit() {
  return isPremiumUser ? Infinity : FREE_USER_LIMIT;
}

// Function to handle the form processing - update the relevant parts
function processFormSubmission(title, url, commandId, isUpdate, editIndex) {
  // Validasi inputs
  if (!title) {
    customStatus.textContent = "Please enter a title for your shortcut";
    customStatus.style.color = "red";
    return;
  }
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Use the improved URL validation
  if (!isValidUrl(url)) {
    customStatus.textContent = "Please enter a valid URL (e.g., example.com)";
    customStatus.style.color = "red";
    return;
  }
  
  // Extract current domain from the URL
  let currentDomain;
  try {
    currentDomain = new URL(url).hostname;
  } catch (e) {
    customStatus.textContent = "Invalid URL format";
    customStatus.style.color = "red";
    return;
  }
  
  // Get domain targeting with improved pattern support
  const domainTargeting = document.getElementById('domainTargeting');
  let domains = [];
  
  // Force domain targeting to be the domain from the URL
  if (domainTargeting) {
    domainTargeting.value = currentDomain;
    domains = [currentDomain];
  }
  
  // Check if we already have 3 shortcuts for this domain
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    
    // Count shortcuts for current domain (excluding the one being edited if applicable)
    const domainShortcutsCount = shortcuts.filter((s, idx) => {
      // Skip the current shortcut if we're editing it
      if (isUpdate && idx === editIndex) return false;
      
      // Check if shortcut is for current domain
      return s.domains && s.domains.includes(currentDomain);
    }).length;
    
    // Get the applicable limit based on premium status
    const shortcutLimit = getShortcutLimit();
    
    // Check if limit reached
    if (domainShortcutsCount >= shortcutLimit) {
      customStatus.innerHTML = `
        <div>Maximum limit of ${shortcutLimit} shortcuts per domain (${currentDomain}) reached.</div>
        ${!isPremiumUser ? `<div style="margin-top:8px;">
          <strong>Need more?</strong> <a href="#" id="upgradeLink">Upgrade to Premium</a> for unlimited shortcuts per domain.
        </div>` : ''}
      `;
      customStatus.style.color = "red";
      
      // Add event listener to upgrade link if shown
      const upgradeLink = document.getElementById('upgradeLink');
      if (upgradeLink) {
        upgradeLink.addEventListener('click', (e) => {
          e.preventDefault();
          showPremiumUpgradeModal();
        });
      }
      
      return;
    }
    
    // Continue with shortcut creation/update
    if (isUpdate && editIndex >= 0 && editIndex < shortcuts.length) {
      // Update existing shortcut
      shortcuts[editIndex].command = commandId;
      shortcuts[editIndex].title = title;
      shortcuts[editIndex].url = url;
      shortcuts[editIndex].domains = domains; // Force domain to match URL

      // Save updated shortcuts
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        // Reset form to add mode
        resetShortcutForm();
        
        // Show success message with shortcut title
        customStatus.innerHTML = `
          <div>Shortcut "${title}" updated successfully!</div>
        `;
        customStatus.style.color = "green";
        
        // Reload the list
        loadCustomShortcuts();
        
        // Hide the message after 2 seconds
        setTimeout(() => {
          customStatus.textContent = "";
        }, 2000);
      });
    } else {
      // Adding new shortcut
      // Only check for duplicate command ID if one is provided
      if (commandId && commandId !== '' && shortcuts.some(s => s.command === commandId)) {
        customStatus.textContent = `Command ID "${commandId}" already exists. Please choose a different one.`; 
        customStatus.style.color = "red";
        return;
      }
      
      // Create a new shortcut with domain restriction
      shortcuts.push({
        command: commandId || "", // Allow empty command ID
        title: title,
        url: url,
        domains: domains, // Force domain to match URL
        shortcutKey: ""
      });
      
      // Save updated shortcuts
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        // Clear the form
        resetShortcutForm();
        
        // Show success message with title and domain
        customStatus.innerHTML = `
          <div>Shortcut "${title}" added successfully</div>
          <div style="margin-top:8px;">
            <strong>Note:</strong> This shortcut will only appear when browsing at <strong>${currentDomain}</strong>.
          </div>
        `;
        customStatus.style.color = "green";
        
        // Reload the list
        loadCustomShortcuts();
        
        // Add this line to clear the message after a delay
        setTimeout(() => {
          customStatus.textContent = "";
        }, 4000); // Show for 4 seconds
      });
    }
  });
}

// Update Chrome commands (for manifest v3, this is mostly for documentation)
function updateChromeCommands(shortcuts) {
  // In Manifest V3, we can't add commands programmatically,
  // so this is mostly for future compatibility or extension
}

// Update the loadCustomShortcuts function to store the original index as a data attribute
function loadCustomShortcuts(sortColumn = 'domain', sortDirection = 'asc') {
  if (!shortcutsBody) return;
  
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    let shortcuts = result.customShortcuts || [];
    
    console.log("Loaded shortcuts:", shortcuts); // Debugging
    
    // Group shortcuts by domain for display
    const domainGroups = {};
    shortcuts.forEach((shortcut, originalIndex) => {
      const domain = shortcut.domains && shortcut.domains.length > 0 ? 
        shortcut.domains[0] : 'All websites';
      
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      // Store the original index with the shortcut
      shortcut._originalIndex = originalIndex;
      domainGroups[domain].push(shortcut);
    });
    
    // Sort domain groups if requested
    if (sortColumn) {
      // Sort the shortcuts within each domain
      Object.keys(domainGroups).forEach(domain => {
        domainGroups[domain].sort((a, b) => {
          // Same sorting logic as before
          let valueA, valueB;
          
          // Determine values to compare based on column
          switch(sortColumn) {
            case 'command':
              valueA = a.command || '';
              valueB = b.command || '';
              break;
            case 'title':
              valueA = a.title || '';
              valueB = b.title || '';
              break;
            case 'url':
              valueA = a.url || '';
              valueB = b.url || '';
              break;
            default:
              valueA = a.title || '';
              valueB = b.title || '';
          }
          
          // Case insensitive string comparison
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
          
          let result = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
          return sortDirection === 'desc' ? -result : result;
        });
      });
      
      // Sort domain groups by domain name
      const sortedDomains = Object.keys(domainGroups).sort();
      if (sortDirection === 'desc') {
        sortedDomains.reverse();
      }
      
      // Reassemble shortcuts based on sorted domains
      shortcuts = [];
      sortedDomains.forEach(domain => {
        shortcuts = shortcuts.concat(domainGroups[domain]);
      });
    }
    
    // Clear existing rows
    shortcutsBody.innerHTML = '';
    
    if (shortcuts.length === 0) {
      // Show a message if no shortcuts exist
      shortcutsBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center;">No custom shortcuts added yet</td>
        </tr>
      `;
    } else {
      let currentDomain = null;
      let domainCount = 0;
      
      // Loop through shortcuts
      shortcuts.forEach((shortcut, displayIndex) => {
        const domain = shortcut.domains && shortcut.domains.length > 0 ? 
          shortcut.domains[0] : 'All websites';
        
        // Add domain header when changing domains
        if (domain !== currentDomain) {
          // Reset count for new domain
          domainCount = domainGroups[domain].length;
          currentDomain = domain;
          
          // Add domain header row
          const headerRow = document.createElement('tr');
          headerRow.className = 'domain-header';

          // Get the applicable limit based on premium status
          const shortcutLimit = getShortcutLimit();
          const limitText = isPremiumUser ? 'unlimited' : `${domainCount}/${shortcutLimit}`;
          const limitReached = !isPremiumUser && domainCount >= shortcutLimit;

          headerRow.innerHTML = `
            <td colspan="6" class="domain-header-cell">
              <strong>Domain: ${domain}</strong>
              <span class="domain-count">
                (${limitText} shortcuts${limitReached ? ' - <font color=red>LIMIT REACHED</font>' : ''})
              </span>
            </td>
          `;
          shortcutsBody.appendChild(headerRow);
        }
        
        // Add the shortcut row
        const row = document.createElement('tr');
        
        // Use the ORIGINAL index, not the display index
        const originalIndex = shortcut._originalIndex;
        
        row.innerHTML = `
          <td>${shortcut.command || '<span class="optional-badge">none</span>'}</td>
          <td>${shortcut.title}</td>
          <td>${shortcut.url}</td>
          <td data-command-id="${shortcut.command}" class="shortcut-cell">
            ${shortcut.command ? 
              '<span class="shortcut-binding">Set in chrome://extensions/shortcuts</span>' : 
              '<span class="no-command">No command ID assigned</span>'}
            <span class="optional-badge">optional</span>
          </td>
          <td class="domain-cell">${domain}</td>
          <td>
            <button class="edit-btn" data-index="${originalIndex}">Edit</button>
            <button class="delete-btn" data-index="${originalIndex}">Delete</button>
          </td>
        `;
        
        shortcutsBody.appendChild(row);
      });
      
      // Add event handlers for Edit and Delete buttons
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.getAttribute('data-index'));
          editShortcut(index);
        });
      });
      
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.getAttribute('data-index'));
          if (confirm('Are you sure you want to delete this shortcut?')) {
            deleteShortcut(index);
          }
        });
      });
    }
  });
  
  // Add this at the end of the function:
  updateShortcutDisplayTable();
}

// Update the deleteShortcut function
function deleteShortcut(index) {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    
    // Store shortcut information before deletion for the success message
    const deletedShortcut = shortcuts[index];
    
    if (!deletedShortcut) {
      customStatus.textContent = "Error: Shortcut not found";
      customStatus.style.color = "red";
      return;
    }
    
    // Remove the shortcut at the specified index
    shortcuts.splice(index, 1);
    
    // Save updated shortcuts
    chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
      // Show success message with shortcut title
      customStatus.innerHTML = `
        <div>Shortcut "${deletedShortcut.title}" deleted successfully!</div>
      `;
      customStatus.style.color = "green";
      
      // Reload the list
      loadCustomShortcuts();
      
      // Hide the message after 2 seconds
      setTimeout(() => {
        customStatus.textContent = "";
      }, 2000);
    });
  });
}

// Add a function to periodically check and display current shortcut settings

function updateShortcutDisplayTable() {
  // Only Chrome 93+ includes the commands.getAll API
  if (!chrome.commands || !chrome.commands.getAll) {
    return;
  }
  
  chrome.commands.getAll((commands) => {
    chrome.storage.sync.get(['customShortcuts'], (result) => {
      const shortcuts = result.customShortcuts || [];
      const shortcutMap = {};
      
      // Create mapping of command ID -> shortcut data
      shortcuts.forEach(shortcut => {
        shortcutMap[shortcut.command] = shortcut;
      });
      
      // Update UI with actual Chrome shortcut bindings
      commands.forEach(command => {
        if (shortcutMap[command.name]) {
          const shortcutElem = document.querySelector(`[data-command-id="${command.name}"] .shortcut-binding`);
          if (shortcutElem) {
            shortcutElem.textContent = command.shortcut || 'Not set';
            shortcutElem.style.color = command.shortcut ? 'green' : 'red';
          }
        }
      });
    });
  });
}

// Call this periodically to keep the UI in sync
setInterval(updateShortcutDisplayTable, 5000);

// Add a special guide function that explains the process with screenshots

function showShortcutConfigGuide() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'shortcut-guide-modal';
  modal.innerHTML = `
    <div class="guide-content">
      <h2>How to Configure Keyboard Shortcuts (Optional)</h2>
      <p>Keyboard shortcuts are completely optional. Your shortcuts will always be available through the floating widget.</p>
      <div class="guide-step">
        <h3>Step 1: Access Chrome's Shortcuts Page</h3>
        <p>After clicking "Configure Keyboard Shortcuts", you'll be taken to Chrome's shortcut page.</p>
      </div>
      <div class="guide-step">
        <h3>Step 2: Find Your Extension</h3>
        <p>Look for "Custom Shortcut Extension" in the list.</p>
      </div>
      <div class="guide-step">
        <h3>Step 3: Set Your Keyboard Combination</h3>
        <p>You have up to 10 command slots available (command-1 through command-10). Assign keyboard shortcuts to the commands that correspond to your most important shortcuts.</p>
      </div>
      <button class="close-guide-btn">Close Guide</button>
    </div>
  `;

}


// Check if Chrome has the newer commands API

let hasCommandsAPI = false;

// Check for Chrome API support
function checkChromeAPIs() {
  if (chrome.commands && chrome.commands.getAll) {
    try {
      chrome.commands.getAll(() => {
        hasCommandsAPI = true;
        console.log('Chrome commands API is available');
        updateShortcutDisplayTable();
      });
    } catch (e) {
      console.log('Chrome commands API is not available:', e);
    }
  }
}

// Check API support on page load
document.addEventListener('DOMContentLoaded', checkChromeAPIs);

// Function to initialize and populate the command dropdown
function initCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) {
    // If dropdown not found, create it
    createCommandDropdown();
    return;
  }
  
  // Clear current options to prevent duplicates
  commandDropdown.innerHTML = '';
  
  // Add a default "None" option to make it clear this is optional
  commandDropdown.appendChild(new Option('None (Optional)', ''));
  
  // Get existing shortcuts to check which commands are already used
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const usedCommandIds = shortcuts.map(s => s.command).filter(id => id); // Filter out empty command IDs
    
    // Make sure AVAILABLE_COMMANDS is defined
    if (AVAILABLE_COMMANDS && AVAILABLE_COMMANDS.length) {
      // Add available commands to dropdown
      AVAILABLE_COMMANDS.forEach(cmd => {
        if (!usedCommandIds.includes(cmd)) {
          commandDropdown.appendChild(new Option(cmd, cmd));
        }
      });
    }
    
    // No need to disable the dropdown if all commands are used - users can still select "None"
    if (commandDropdown.options.length <= 1) {
      commandDropdown.appendChild(new Option('All command IDs in use', ''));
    }
  });
}

// Create command dropdown if it doesn't exist
function createCommandDropdown() {
  // Find the form group that should contain the dropdown
  const formGroups = document.querySelectorAll('.form-group');
  let commandFormGroup;
  
  for (const group of formGroups) {
    if (group.textContent.toLowerCase().includes('command id')) {
      commandFormGroup = group;
      break;
    }
  }
  
  if (commandFormGroup) {
    // Create the dropdown element
    const dropdownHtml = `
      <div class="command-id-group">
        <select id="commandIdSelect" class="command-id-input">
          <option value="">None (Optional)</option>
        </select>
      </div>
      <div class="shortcut-hint">
        <span class="optional-badge">optional</span>
        Command IDs are only needed if you want to assign keyboard shortcuts. You can add shortcuts without selecting a Command ID.
      </div>
    `;
    
    // Replace the content of the form group
    commandFormGroup.innerHTML = `
      <label for="commandIdSelect">Command ID (Optional):</label>
      ${dropdownHtml}
    `;
    
    // Initialize the dropdown with options
    initCommandDropdown();
  }
}

// Update the createCommandDropdown function to also ensure domain field has proper appearance
function createDomainField() {
  const formGroups = document.querySelectorAll('.form-group');
  let domainFormGroup;
  
  for (const group of formGroups) {
    if (group.textContent.toLowerCase().includes('target domain')) {
      domainFormGroup = group;
      break;
    }
  }
  
  if (domainFormGroup) {
    // Create the domain input field with readonly attribute
    domainFormGroup.innerHTML = `
      <label for="domainTargeting">Target Domain:</label>
      <input type="text" id="domainTargeting" readonly placeholder="Automatically set from URL">
      <div class="shortcut-hint">
        <div class="domain-auto-update">
          <span class="domain-auto-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" 
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </span>
          <span>Auto-filled from URL</span>
        </div>
      </div>
    `;
  }
}

// Prepare command dropdown structure
function prepareCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) {
    createCommandDropdown();
  } else {
    // If dropdown exists, fill it with options
    initCommandDropdown();
  }
}

// Fill command dropdown with options
function fillCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) return;
  
  // Clear existing options
  commandDropdown.innerHTML = '';
  commandDropdown.appendChild(new Option('Select a command ID', ''));
  
  // Fill with available options
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const usedCommandIds = shortcuts.map(s => s.command);
    
    AVAILABLE_COMMANDS.forEach(cmd => {
      if (!usedCommandIds.includes(cmd)) {
        commandDropdown.appendChild(new Option(cmd, cmd));
      }
    });
    
    if (commandDropdown.options.length <= 1) {
      commandDropdown.appendChild(new Option('All commands in use - delete one first', ''));
      commandDropdown.disabled = true;
    } else {
      commandDropdown.disabled = false;
    }
  });
}

// Update the updateCommandIdDropdown function
function updateCommandIdDropdown() {
  // Call fillCommandDropdown which will properly clear and repopulate the dropdown
  fillCommandDropdown();
}

// Tambahkan fungsi editShortcut
function editShortcut(index) {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const shortcut = shortcuts[index];
    
    if (!shortcut) return;
    
    // Populate form fields with shortcut data
    if (titleInput) titleInput.value = shortcut.title;
    if (shortcutUrlInput) shortcutUrlInput.value = shortcut.url;
    
    // Extract domain from URL
    let domain = '';
    try {
      domain = new URL(shortcut.url).hostname;
    } catch (e) {
      console.error('Invalid URL', e);
    }
    
    // Populate domain targeting (now read-only)
    const domainTargetingInput = document.getElementById('domainTargeting');
    if (domainTargetingInput) {
      domainTargetingInput.value = domain;
      domainTargetingInput.setAttribute('readonly', 'readonly');
    }
    
    // Handle command ID dropdown while user edit the shortcut
    const commandIdSelect = document.getElementById('commandIdSelect');
    if (commandIdSelect) {
      // Re-initialize the dropdown to show all available options plus the current one
      commandIdSelect.innerHTML = '';
      commandIdSelect.appendChild(new Option('None (Optional)', ''));
      
      // Get list of used command IDs excluding the current one
      const usedCommandIds = shortcuts
        .filter((s, i) => i !== index && s.command) // Exclude this shortcut
        .map(s => s.command);
      
      // Add available commands to dropdown
      AVAILABLE_COMMANDS.forEach(cmd => {
        // Include this command if it's not used by any other shortcut
        // or if it's the current shortcut's command
        if (!usedCommandIds.includes(cmd) || shortcut.command === cmd) {
          const option = new Option(cmd, cmd);
          commandIdSelect.appendChild(option);
          
          // Select the current command if it exists
          if (shortcut.command === cmd) {
            option.selected = true;
          }
        }
      });
      
      // Keep dropdown enabled
      commandIdSelect.disabled = false;
    }
    
    // Change the Add button to an Update button
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.textContent = 'Update Shortcut';
      addBtn.classList.add('update-btn');
      // Store the index to know which shortcut to update
      addBtn.setAttribute('data-edit-index', index);
    }
    
    // Add cancel button
    if (!document.getElementById('cancelEditBtn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelEditBtn';
      cancelBtn.className = 'cancel-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.type = 'button';  // Important - don't submit the form
      
      cancelBtn.addEventListener('click', () => {
        resetShortcutForm();
      });
      
      // Add the cancel button after the add/update button
      if (addBtn && addBtn.parentNode) {
        addBtn.parentNode.insertBefore(cancelBtn, addBtn.nextSibling);
      }
    }
    
    // Scroll to the form
    if (shortcutForm) {
      shortcutForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// Reset form status to "Add"
function resetShortcutForm() {
  // Clear form fields
  if (titleInput) titleInput.value = '';
  if (shortcutUrlInput) shortcutUrlInput.value = '';
  
  // Clear domain targeting but keep it readonly
  const domainTargetingInput = document.getElementById('domainTargeting');
  if (domainTargetingInput) {
    domainTargetingInput.value = '';
    domainTargetingInput.setAttribute('readonly', 'readonly'); // Always keep readonly
  }
  
  // Reset command ID dropdown
  updateCommandIdDropdown();
  const commandIdSelect = document.getElementById('commandIdSelect');
  if (commandIdSelect) {
    commandIdSelect.disabled = false;
  }
  
  // Reset Add button
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.textContent = 'Add Custom Shortcut';
    addBtn.classList.remove('update-btn');
    addBtn.removeAttribute('data-edit-index');
  }
  
  // Remove cancel button
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) {
    cancelBtn.parentNode.removeChild(cancelBtn);
  }
}


// Add table sorting functionality
function initTableSorting() {
  const table = document.getElementById('shortcutsTable');
  if (!table) return;
  
  // Current sort state - Initialize with domain sorting by default
  let sortConfig = {
    column: 'domain', // Start with domain sorting by default
    direction: 'asc'
  };
  
  // Add click event listeners to sortable headers
  document.querySelectorAll('th.sortable').forEach(header => {
    // Set initial visual indicator for domain column
    if (header.getAttribute('data-sort') === 'domain') {
      header.classList.add('sort-asc');
    }
    
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      const direction = sortConfig.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      
      // Update sort visual indicators
      document.querySelectorAll('th.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
      
      // Save the new sort state
      sortConfig = { column, direction };
      
      // Reload shortcuts with new sorting
      loadCustomShortcuts(column, direction);
    });
  });
  
  // Apply the initial default sorting
  loadCustomShortcuts(sortConfig.column, sortConfig.direction);
}

// Add this function after resetting the form
function initDomainAutoUpdate() {
  const urlInput = document.getElementById('shortcutUrl');
  const domainInput = document.getElementById('domainTargeting');
  
  if (!urlInput || !domainInput) return;
  
  // Make domain input always readonly
  domainInput.setAttribute('readonly', 'readonly');
  
  // Helper function to extract domain from URL
  const extractDomain = (url) => {
    if (!url || url.trim() === '') return '';
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      return new URL(url).hostname;
    } catch (e) {
      // For partial URLs that might be invalid while typing,
      // try a simple domain extraction as fallback
      const domainMatch = url.match(/[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/);
      return domainMatch ? domainMatch[0] : '';
    }
  };
  
  // Function to update domain input with animation effect
  const updateDomain = (domain) => {
    // Update value and placeholder
    domainInput.value = domain;
    domainInput.placeholder = domain ? domain : "Automatically set from URL";
    
    // Add visual feedback
    if (domain) {
      // Remove and re-add the animation class to trigger animation
      domainInput.classList.remove('domain-updated');
      // Use setTimeout to ensure the class removal is processed before adding it back
      setTimeout(() => {
        domainInput.classList.add('valid-domain');
        domainInput.classList.add('domain-updated');
      }, 10);
    } else {
      domainInput.classList.remove('valid-domain');
      domainInput.classList.remove('domain-updated');
    }
  };
  
  // Add input event listener to update domain in real-time as user types
  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    const domain = extractDomain(url);
    
    // Update domain with animation
    updateDomain(domain);
    
    console.log('URL changed:', url, '→ Domain:', domain); // Debugging
  });
  
  // Also handle blur event for final validation and URL correction
  urlInput.addEventListener('blur', () => {
    let url = urlInput.value.trim();
    
    if (url) {
      // Add protocol if missing for the actual input value
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        urlInput.value = url;
      }
      
      // Final domain extraction with complete URL
      try {
        const domain = new URL(url).hostname;
        updateDomain(domain);
      } catch (e) {
        // Leave it as is if URL is invalid
      }
    }
  });
  
  // Initialize on page load if URL already has a value
  if (urlInput.value.trim()) {
    const domain = extractDomain(urlInput.value.trim());
    updateDomain(domain);
  }
}

// Add this function to create an information banner
function createDomainRestrictionInfo() {
  const formContainer = document.querySelector('.custom-shortcut-form');
  if (!formContainer) return;
  
  // Create info element if it doesn't exist
  if (!document.querySelector('.domain-restricted')) {
    const infoElement = document.createElement('div');
    infoElement.className = 'domain-restricted';
    infoElement.innerHTML = `
      <p><strong>Domain Restriction Policy:</strong></p>
      <ul>
        <li>Shortcuts can only be used on the domain they are created for</li>
        <li>Maximum of 5 shortcuts allowed per domain</li>
        <li>The domain is automatically set based on the URL you enter</li>
      </ul>
    `;
    
    // Insert at the beginning of the form
    formContainer.insertBefore(infoElement, formContainer.firstChild);
  }
}

// Add debug function to check the state
function debugCommands() {
  console.log("AVAILABLE_COMMANDS:", AVAILABLE_COMMANDS);
  
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    console.log("Current shortcuts:", result.customShortcuts || []);
  });
  
  const dropdown = document.getElementById('commandIdSelect');
  if (dropdown) {
    console.log("Dropdown options:", dropdown.options.length);
    for (let i = 0; i < dropdown.options.length; i++) {
      console.log(`Option ${i}:`, dropdown.options[i].value);
    }
  } else {
    console.log("Dropdown not found");
  }
}

// Initialize guide button functionality
function initGuideButton() {
  const guideBtn = document.getElementById('shortcutGuideBtn');
  if (guideBtn) {
    guideBtn.addEventListener('click', () => {
      showShortcutConfigGuide();
    });
  }
}

// Update the domain field to show an icon indicating auto-update
function enhanceDomainField() {
  const domainContainer = document.getElementById('domainTargeting')?.parentElement;
  if (!domainContainer) return;
  
  // Add an auto-update icon
  const autoIcon = document.createElement('div');
  autoIcon.className = 'domain-auto-icon';
  autoIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" 
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 2v6h-6"></path>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
      <path d="M3 22v-6h6"></path>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
    </svg>
  `;
  
  // Add label to make it clear
  const autoLabel = document.createElement('span');
  autoLabel.className = 'domain-auto-label';
  autoLabel.textContent = 'Auto-filled from URL';
  
  // Update the hint text
  const hintDiv = domainContainer.querySelector('.shortcut-hint') || document.createElement('div');
  hintDiv.className = 'shortcut-hint';
  hintDiv.innerHTML = `
    <div class="domain-auto-update">
      <span class="domain-auto-icon">${autoIcon.innerHTML}</span>
      <span>Auto-filled from URL</span>
    </div>
  `;
  
  // Ensure the hint is in the container
  if (!domainContainer.querySelector('.shortcut-hint')) {
    domainContainer.appendChild(hintDiv);
  }
  
}

// Function to check premium status - add this after existing functions
function checkPremiumStatus() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['premiumStatus'], (result) => {
      if (result.premiumStatus && result.premiumStatus.active === true) {
        // If there's an expiration date, check if the license is still valid
        if (result.premiumStatus.expiresOn) {
          const now = new Date();
          const expiryDate = new Date(result.premiumStatus.expiresOn);
          isPremiumUser = now <= expiryDate;
        } else {
          isPremiumUser = true;
        }
      } else {
        isPremiumUser = false;
      }
      resolve(isPremiumUser);
    });
  });
}

// Add this function to display premium status
function displayPremiumStatus() {
  // Create or update premium status indicator
  let statusContainer = document.querySelector('.premium-status-container');
  
  if (!statusContainer) {
    // Create the container if it doesn't exist
    statusContainer = document.createElement('div');
    statusContainer.className = 'premium-status-container';
    
    // Insert after h1
    const h1 = document.querySelector('h1');
    if (h1 && h1.parentNode) {
      h1.parentNode.insertBefore(statusContainer, h1.nextSibling);
    } else {
      document.body.insertBefore(statusContainer, document.body.firstChild);
    }
  }
  
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    
    // Format the activation date if available
    let activatedText = '';
    if (premiumData.activatedOn) {
      const activationDate = new Date(premiumData.activatedOn);
      activatedText = `Activated on: ${activationDate.toLocaleDateString()}`;
    }
    
    // Format the expiration date if available
    let expiresText = '';
    if (premiumData.expiresOn) {
      const expiryDate = new Date(premiumData.expiresOn);
      expiresText = `Expires: ${expiryDate.toLocaleDateString()}`;
    }
    
    // Update status container content
    statusContainer.innerHTML = isPremiumUser ? 
      `<div class="premium-badge">
         <span class="premium-icon">✓</span>
         <span class="premium-text">Premium User</span>
         <span class="premium-feature">Unlimited shortcuts per domain</span>
         ${activatedText ? `<span style="margin-left: 10px; font-size: 0.8em;">${activatedText}</span>` : ''}
         ${expiresText ? `<span style="margin-left: 10px; font-size: 0.8em;">${expiresText}</span>` : ''}
       </div>` : 
      `<div class="free-badge">
         <span class="free-icon">ℹ</span>
         <span class="free-text">Free User</span>
         <span class="free-feature">Limited to ${FREE_USER_LIMIT} shortcuts per domain</span>
         <button id="upgradeToPremium" class="upgrade-btn">Upgrade to Premium</button>
       </div>`;
       
    // Add event listener to upgrade button
    const upgradeBtn = document.getElementById('upgradeToPremium');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', showPremiumUpgradeModal);
    }
  });
}

// Add this function to show premium upgrade modal
function showPremiumUpgradeModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'premium-upgrade-modal';
  modal.innerHTML = `
    <div class="premium-modal-content">
      <h2>Upgrade to Premium</h2>
      <p>Unlock unlimited shortcuts per domain with our Premium plan!</p>
      
      <div class="premium-benefits">
        <h3>Premium Benefits:</h3>
        <ul>
          <li><strong>Unlimited shortcuts</strong> per domain</li>
          <li><strong>Priority support</strong> for any issues</li>
          <li><strong>Early access</strong> to new features</li>
        </ul>
      </div>
      
      <div class="premium-price">
        <p class="price-tag">$4.99 <span>one-time payment</span></p>
      </div>
      
      <div class="modal-buttons">
        <a href="https://ridwancard.my.id/checkout/?add-to-cart=62" 
           target="_blank" id="buyPremium" class="primary-btn">Purchase Premium</a>
        <button id="activateLicense" class="primary-btn">Already purchased? Activate License</button>
        <button id="closeModal" class="cancel-btn">Maybe Later</button>
      </div>
      
      <div id="licenseActivationForm" style="display:none; margin-top: 20px;">
        <h3>Enter Your License Key</h3>
        <p>You should have received your license key via email after purchase.</p>
        <div style="margin: 15px 0;">
          <input type="text" id="licenseKeyInput" placeholder="Enter your license key" 
                 style="width: 100%; padding: 8px; margin-bottom: 10px;">
          <button id="verifyLicense" class="primary-btn" style="width: 100%;">Activate License</button>
        </div>
        <div id="licenseMessage" style="margin-top: 10px;"></div>
      </div>
    </div>
  `;
  
  // Add modal to body
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('activateLicense').addEventListener('click', () => {
    document.getElementById('licenseActivationForm').style.display = 'block';
    document.getElementById('activateLicense').style.display = 'none';
  });
  
  document.getElementById('verifyLicense').addEventListener('click', () => {
    const licenseKey = document.getElementById('licenseKeyInput').value.trim();
    if (!licenseKey) {
      document.getElementById('licenseMessage').innerHTML = 
        '<p style="color: red;">Please enter a license key</p>';
      return;
    }
    
    verifyLicenseKey(licenseKey);
  });
  
  document.getElementById('closeModal').addEventListener('click', closeModal);
  
  function closeModal() {
    document.body.removeChild(modal);
  }
}

// License API Configuration - Keep this section as the single source of truth
const LICENSE_API_CONFIG = {
  baseUrl: 'https://ridwancard.my.id',
  credentials: {
    consumerKey: 'ck_9eeb9517833188c72cdf4d94dac63f6cbc18ba3c',
    consumerSecret: 'cs_6ac366de7eae5804493d735e58d08b85db8944cb'
  },
  endpoints: {
    activate: '/wp-json/lmfwc/v2/licenses/activate/',
    validate: '/wp-json/lmfwc/v2/licenses/validate/',
    deactivate: '/wp-json/lmfwc/v2/licenses/deactivate/'
  }
};

// Helper function to create authorization header - Keep this
function getAuthorizationHeader() {
  return btoa(`${LICENSE_API_CONFIG.credentials.consumerKey}:${LICENSE_API_CONFIG.credentials.consumerSecret}`);
}

// Helper function to make license API requests - Keep this
function makeLicenseApiRequest(endpoint, licenseKey) {
  const url = `${LICENSE_API_CONFIG.baseUrl}${endpoint}${licenseKey}`;
  
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${getAuthorizationHeader()}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.text().then(text => {
      try {
        if (text.includes('<b>Warning</b>') || text.includes('<br />')) {
          const jsonMatch = text.match(/(\{.*\})/);
          if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
          }
          throw new Error('Server returned HTML error with no valid JSON');
        }
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Failed to parse server response');
      }
    });
  });
}

// KEEP THIS ONE: Function to verify license key
function verifyLicenseKey(licenseKey) {
  const licenseMessage = document.getElementById('licenseMessage');
  licenseMessage.innerHTML = '<p style="color: blue;">Verifying license...</p>';
  
  makeLicenseApiRequest(LICENSE_API_CONFIG.endpoints.activate, licenseKey)
    .then(data => {
      if (data.success === true) {
        // License is valid and activated
        licenseMessage.innerHTML = '<p style="color: green;">License verified and activated successfully! Refreshing page...</p>';
        
        // Store the license information from the response
        chrome.storage.sync.set({
          'premiumStatus': {
            active: true,
            activatedOn: new Date().toISOString(),
            licenseKey: licenseKey,
            expiresOn: data.data?.expiresAt || null,
            timesActivated: data.data?.timesActivated || 0,
            timesActivatedMax: data.data?.timesActivatedMax || 1,
            remainingActivations: data.data?.remainingActivations || 1
          }
        }, () => {
          // Refresh the page immediately after setting the storage
          // This ensures all UI components are properly updated with new premium status
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        });
      } else {
        // License is invalid
        licenseMessage.innerHTML = 
          `<p style="color: red;">Invalid license key: ${data.message || 'Please check and try again'}</p>`;
      }
    })
    .catch(error => {
      console.error('License verification error:', error);
      licenseMessage.innerHTML = 
        '<p style="color: red;">Error connecting to license server. Please try again later.</p>';
    });
}


//open shortcut setting page in Chrome
document.getElementById('openShortcutsPage').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

function initCollapsibleSections() {
  const collapsibles = document.querySelectorAll('.collapsible-header');
  
  collapsibles.forEach(collapsible => {
    collapsible.addEventListener('click', function() {
      // Toggle active class on parent container
      this.parentElement.classList.toggle('active');
    });
  });
  
  // Open the first section by default
  if (collapsibles.length > 0) {
    collapsibles[0].parentElement.classList.add('active');
  }
}

// Update the showShortcutConfigGuide function in options.js

function showShortcutConfigGuide() {
  const guideContent = `
    <div class="guide-container">
      <h2>📘 Complete Guide: Getting The Most From Quick Site Shortcuts</h2>
      
      <div class="guide-section">
        <h3>Detailed Setup</h3>
        <ol>
          <li><strong>Adding Keyboard Shortcuts:</strong>
            <ul>
              <li><strong>Setting up Chrome-level Keyboard Shortcuts:</strong></li>
              <li>You can configure up to 10 keyboard combinations for this extension</li>
              <li>Go to Chrome's Extensions Shortcuts page by:
                  <ul>
                      <li>Opening a new tab and typing: <code>chrome://extensions/shortcuts</code></li>
                      <li>Or from Chrome menu: Settings → Extensions → ⋮ (menu) → Keyboard shortcuts</li>
                  </ul>
              </li>
              <li>Find "Quick Site Shortcuts" in the list of extensions</li>
              <li>For each command you want to use:
                  <ul>
                      <li>Click the empty input box next to the command name</li>
                      <li>Press your desired key combination (e.g., <code>Alt+Shift+G</code>)</li>
                      <li>Chrome will save it automatically</li>
                  </ul>
              </li>
              <li>Recommended combinations: <code>Alt+Shift+[letter]</code> or <code>Ctrl+Shift+[number]</code></li>
              <li>To edit a shortcut: Click the input box and press a new combination</li>
              <li>To remove a shortcut: Click the input box and press <code>Backspace</code></li>
              <li>These shortcuts will work globally across all Chrome windows</li>                            
            </ul>
          </li>
          <li><strong>Add Your First Shortcut:</strong>
            <ul>
              <li>Enter a descriptive title for your shortcut (e.g., "Gmail Inbox")</li>
            <li>Enter the complete URL you want to open (e.g., "https://mail.google.com")</li>
            <li>Select a Command ID from the dropdown to assign a keyboard shortcut</li>
            <li>The target domain will be automatically detected from the URL you provided</li>
            <li>Click the "Add Custom Shortcut" button to save your new shortcut</li>
            </ul>
          </li>
          <li><strong>Using Your Shortcuts:</strong>
            <ul>
              <li>Visit the website you've added shortcuts for</li>
              <li>A floating panel will appear on the screen</li>
              <li>You can freely move this panel anywhere on the screen as needed</li>
              <li>Click on the panel to open the list of shortcuts you've added</li>
              <li>Click on any shortcut to access it</li>
            </ul>
          </li>
        </ol>
      </div>
      
      <div class="guide-section">
        <h3>Keyboard Shortcut Tips</h3>
        <ul>
          <li>Choose memorable combinations like first letters of the site name</li>
          <li>For frequently used sites, assign simple combinations</li>
          <li>The same keyboard shortcut works across all domains</li>
          <li>If a keyboard shortcut conflicts with browser or website shortcuts, try a different combination</li>
        </ul>
      </div>
      
    </div>
  `;
  
  // Show the guide in a modal dialog
  showModal('Shortcut Configuration Guide', guideContent);
}

// Add this function to show modals - the missing piece!
function showModal(title, content) {
  // Remove any existing modals first
  const existingModal = document.querySelector('.guide-modal');
  if (existingModal) {
    existingModal.parentNode.removeChild(existingModal);
  }
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'guide-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'modalTitle');
  modal.setAttribute('aria-describedby', 'modalContent');
  
  // Create modal content
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h2 id="modalTitle">${title}</h2>
        <button class="guide-close-btn" aria-label="Close">&times;</button>
      </div>
      
      <div class="guide-modal-body" id="modalContent">
        ${content}
      </div>
      
      <div class="guide-modal-footer">
        <button class="guide-ok-btn">OK</button>
      </div>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(modal);
  
  // Focus trap for accessibility
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Focus the first element
  firstElement.focus();
  
  // Close button functionality
  const closeBtn = modal.querySelector('.guide-close-btn');
  const okBtn = modal.querySelector('.guide-ok-btn');
  
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', closeModal);
  
  // Close when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscapeKey);
    }
  });
  
  // Handle tab key for focus trap
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  });
}

// Add this function to your options.js
function addLicenseManagementSection() {
  const settingsContainer = document.querySelector('.shortcut-note.highlight') || document.body;
  
  // Create the license management section if it doesn't exist
  if (!document.getElementById('licenseManagementSection')) {
    const licenseSection = document.createElement('div');
    licenseSection.id = 'licenseManagementSection';
    licenseSection.className = 'collapsible-container';
    licenseSection.innerHTML = `
      <button class="collapsible-header">
        <span class="collapsible-icon">▶</span>
        <h3>🔑 License Management</h3>
      </button>
      <div class="collapsible-content" style="display: none;">
        <div id="licenseDetails">
          Loading license information...
        </div>
        <div id="licenseActionButtons" style="margin-top: 15px; display: none;">
          <button id="refreshLicenseBtn" class="primary-btn">Refresh License</button>
          <button id="deactivateLicenseBtn" class="deactivated-btn">Deactivate License</button>
        </div>
      </div>
    `;
    
    // Insert before the form
    const form = document.getElementById('shortcutForm');
    if (form && form.parentNode) {
      form.parentNode.insertBefore(licenseSection, form);
    } else {
      settingsContainer.appendChild(licenseSection);
    }
    
    // Initialize collapsible behavior 
    const header = licenseSection.querySelector('.collapsible-header');
    const content = licenseSection.querySelector('.collapsible-content');
    const icon = licenseSection.querySelector('.collapsible-icon');
    
    header.addEventListener('click', function() {
      // Toggle content visibility
      if (content.style.display === "none" || !content.style.display) {
        content.style.display = "block";
        icon.textContent = "▼"; // Change arrow to pointing down
        updateLicenseDetails(); // Load license details when expanded
      } else {
        content.style.display = "none";
        icon.textContent = "▶"; // Change arrow to pointing right
      }
    });
    
    // Add event listeners for license management buttons
    document.getElementById('refreshLicenseBtn').addEventListener('click', refreshLicense);
    document.getElementById('deactivateLicenseBtn').addEventListener('click', deactivateLicense);
    
    // Initialize license details
    updateLicenseDetails();
  }
}

// Make sure to define updateLicenseDetails function if it's not already defined
function updateLicenseDetails() {
  const licenseDetails = document.getElementById('licenseDetails');
  const licenseActionButtons = document.getElementById('licenseActionButtons');
  
  if (!licenseDetails || !licenseActionButtons) return;
  
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    
    if (premiumData.active) {
      // Show action buttons when license is active
      licenseActionButtons.style.display = 'block';
      
      // Format dates
      const activatedDate = premiumData.activatedOn ? 
        new Date(premiumData.activatedOn).toLocaleDateString() : 'Unknown';
      
      const lastVerifiedInfo = premiumData.lastVerified ? 
        `<p><strong>Last Verified:</strong> ${new Date(premiumData.lastVerified).toLocaleString()}</p>` : '';
      
      const expiryInfo = premiumData.expiresOn ? 
        `<p><strong>Expires On:</strong> ${new Date(premiumData.expiresOn).toLocaleDateString()}</p>` : 
        '<p><strong>License Type:</strong> Lifetime (no expiration)</p>';
      
      // Add activation count information if available
      const activationInfo = premiumData.timesActivatedMax ? 
        `<p><strong>Activations:</strong> ${premiumData.timesActivated || 1} / ${premiumData.timesActivatedMax}</p>` : '';
      
      licenseDetails.innerHTML = `
        <div class="license-active">
          <p><strong>Status:</strong> <span style="color: green;">Active</span></p>
          <p><strong>License Key:</strong> ${maskLicenseKey(premiumData.licenseKey || 'Unknown')}</p>
          <p><strong>Activated On:</strong> ${activatedDate}</p>
          ${expiryInfo}
          ${activationInfo}
          ${lastVerifiedInfo}
        </div>
      `;
      
      // Show license management section when license exists
      const licenseSection = document.getElementById('licenseManagementSection');
      if (licenseSection) {
        licenseSection.style.display = 'block';
      }
    } else {
      // Hide action buttons when no license is active
      licenseActionButtons.style.display = 'none';
      
      // Hide the entire license management section when no license exists
      const licenseSection = document.getElementById('licenseManagementSection');
      if (licenseSection) {
        licenseSection.style.display = 'none';
      }
      
      licenseDetails.innerHTML = `
        <div class="license-inactive">
          <p>No active license found.</p>
          <button id="addLicenseBtn" class="primary-btn">Add License Key</button>
        </div>
      `;
      
      // Add event listener to the Add License button
      const addLicenseBtn = document.getElementById('addLicenseBtn');
      if (addLicenseBtn) {
        addLicenseBtn.addEventListener('click', showPremiumUpgradeModal);
      }
    }
  });
}

// Function to mask license key for display (show only last 4 characters)
function maskLicenseKey(key) {
  if (!key || key === 'Unknown') return 'Unknown';
  if (key.length <= 4) return key;
  return '••••••••' + key.slice(-4);
}

// Function to refresh the license status using official API
function refreshLicense() {
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    const licenseKey = premiumData.licenseKey;
    
    if (!licenseKey) {
      customStatus.innerHTML = `<div style="color: red;">No license key found. Please add a license first.</div>`;
      return;
    }
    
    // Show loading message
    customStatus.innerHTML = `<div style="color: blue;">Refreshing license status...</div>`;
    
    // Use the official License Manager for WooCommerce REST API
    // The license key is part of the URL path
    const apiUrl = `https://ridwancard.my.id/wp-json/lmfwc/v2/licenses/validate/${licenseKey}`;
    const consumerKey = 'ck_9eeb9517833188c72cdf4d94dac63f6cbc18ba3c';
    const consumerSecret = 'cs_6ac366de7eae5804493d735e58d08b85db8944cb';
    
    // Basic authentication for WooCommerce API
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    
    fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success === true) {
        // Update stored license information with latest data
        chrome.storage.sync.set({
          'premiumStatus': {
            active: true,
            activatedOn: premiumData.activatedOn || new Date().toISOString(),
            licenseKey: licenseKey,
            expiresOn: data.data?.expiresAt || null,
            lastVerified: new Date().toISOString(),
            timesActivated: data.data?.timesActivated || 1,
            timesActivatedMax: data.data?.timesActivatedMax || null
          }
        }, () => {
          // Update UI
          updateLicenseDetails();
          displayPremiumStatus();
          
          // Show success message
          customStatus.innerHTML = `<div style="color: green;">License refreshed successfully!</div>`;
          setTimeout(() => {
            customStatus.textContent = "";
          }, 4000);
        });
      } else {
        // License is no longer valid
        chrome.storage.sync.set({
          'premiumStatus': {
            active: false,
            licenseKey: licenseKey,
            deactivatedOn: new Date().toISOString(),
            reason: data.message || 'License is no longer valid'
          }
        }, () => {
          isPremiumUser = false;
          updateLicenseDetails();
          displayPremiumStatus();
          loadCustomShortcuts();
          
          customStatus.innerHTML = `<div style="color: red;">License is no longer valid: ${data.message || 'Please renew your license.'}</div>`;
          setTimeout(() => {
            customStatus.textContent = "";
          }, 5000);
        });
      }
    })
    .catch(error => {
      console.error('License refresh error:', error);
      customStatus.innerHTML = '<div style="color: red;">Error connecting to license server. Please try again later.</div>';
      setTimeout(() => {
        customStatus.textContent = "";
      }, 4000);
    });
  });
}

// Function to deactivate the license using official API
function deactivateLicense() {
  if (confirm('Are you sure you want to deactivate your premium license? This will revert you to the free version with limited features.')) {
    chrome.storage.sync.get(['premiumStatus'], (result) => {
      const premiumData = result.premiumStatus || {};
      const licenseKey = premiumData.licenseKey;
      
      if (!licenseKey) {
        // No license to deactivate
        chrome.storage.sync.remove(['premiumStatus'], () => {
          customStatus.innerHTML = `<div style="color: orange;">License deactivated. You're now using the free version.</div>`;
          
          // Refresh the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        });
        return;
      }
      
      // Show loading message
      customStatus.innerHTML = `<div style="color: blue;">Deactivating license...</div>`;
      
      // Use the helper function to make the API request
      makeLicenseApiRequest(LICENSE_API_CONFIG.endpoints.deactivate, licenseKey)
        .then(data => {
          // Remove local license data 
          chrome.storage.sync.remove(['premiumStatus'], () => {
            if (data.success === true) {
              customStatus.innerHTML = `<div style="color: orange;">License deactivated successfully. You're now using the free version.</div>`;
            } else {
              customStatus.innerHTML = `<div style="color: orange;">License deactivated locally. You're now using the free version.</div>`;
              console.warn('Remote deactivation failed:', data.message);
            }
            
            // IMPORTANT: Refresh the page IMMEDIATELY without updating UI in between
            // This prevents "deleted shortcut" notifications from appearing
            window.location.reload();
          });
        })
        .catch(error => {
          console.error('License deactivation error:', error);
          // Still remove local license data even if API call fails
          chrome.storage.sync.remove(['premiumStatus'], () => {
            customStatus.innerHTML = `<div style="color: orange;">License deactivated locally. You're now using the free version.</div>`;
            
            // IMPORTANT: Refresh the page IMMEDIATELY without updating UI in between
            window.location.reload();
          });
        });
    });
  }
}