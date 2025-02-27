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
const DEFAULT_URL = "https://example.com";
// Maximum number of custom shortcuts (limited by manifest)
const MAX_SHORTCUTS = 5;

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

// Function to get next available command ID
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

// Tab navigation - dengan pengecekan null
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

// Pisahkan inisialisasi UI dan pengisian data
document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi UI
  initializeUI();
  
  // Migrate old command IDs to new format
  migrateOldCommandIds();
  
  // Load data
  loadData();
});

// Inisialisasi UI elements
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

// Add to [options/options.js](options/options.js) after loadData() function around line 127
function migrateOldCommandIds() {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    let needsMigration = false;
    
    // Check if any shortcuts use the old naming convention
    shortcuts.forEach(shortcut => {
      if (shortcut.command && shortcut.command.startsWith('shortcut-')) {
        needsMigration = true;
        const commandNumber = shortcut.command.split('-').pop();
        shortcut.command = `shortcut-${commandNumber}`;
      }
    });
    
    // Save migrated shortcuts if needed
    if (needsMigration) {
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        console.log('Migrated old command IDs to new format');
      });
    }
  });
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

// Add new custom shortcut
if (shortcutForm) {
  shortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = titleInput.value.trim();
    let url = shortcutUrlInput.value.trim();
    
    // Check if we're updating an existing shortcut
    const addBtn = document.getElementById('addBtn');
    const isUpdate = addBtn && addBtn.classList.contains('update-btn');
    const editIndex = isUpdate ? parseInt(addBtn.getAttribute('data-edit-index')) : -1;
    
    // Get command ID - for update we use existing, for new we get from dropdown
    let commandId;
    if (isUpdate) {
      // Get existing command ID for update
      chrome.storage.sync.get(['customShortcuts'], (result) => {
        const shortcuts = result.customShortcuts || [];
        if (shortcuts[editIndex]) {
          commandId = shortcuts[editIndex].command;
          processFormSubmission(title, url, commandId, isUpdate, editIndex);
        }
      });
    } else {
      // New shortcut - get command ID from dropdown
      const commandIdSelect = document.getElementById('commandIdSelect');
      commandId = commandIdSelect ? commandIdSelect.value : '';
      processFormSubmission(title, url, commandId, isUpdate, editIndex);
    }
  });
}

// Function to handle the form processing
function processFormSubmission(title, url, commandId, isUpdate, editIndex) {
  // Validasi inputs
  if (!title || !url) {
    customStatus.textContent = "Please fill in all required fields";
    customStatus.style.color = "red";
    return;
  }
  
  //if (!isUpdate && !commandId) {
    //customStatus.textContent = "Please select a command ID";
    //customStatus.style.color = "red";
    //return;
  //}
  
  // Validate command ID is in allowed list
  //if (!isUpdate && !AVAILABLE_COMMANDS.includes(commandId)) {
    //customStatus.textContent = "Invalid command ID. Please choose from the available options.";
   //customStatus.style.color = "red";
    //return;
  //}
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Get domain targeting with improved pattern support
  const domainTargeting = document.getElementById('domainTargeting').value.trim();
  let domains = [];
  
  if (domainTargeting) {
    domains = domainTargeting.split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);
      
    // Validate domains/patterns
    for (const domain of domains) {
      // Check if it's a regex pattern and valid
      if (domain.startsWith('/') && domain.lastIndexOf('/') > 0) {
        try {
          // Try creating a regex to validate it
          const patternBody = domain.substring(1, domain.lastIndexOf('/'));
          const flags = domain.substring(domain.lastIndexOf('/') + 1);
          new RegExp(patternBody, flags);
        } catch (e) {
          customStatus.textContent = `Invalid regex pattern: ${domain}`;
          customStatus.style.color = "red";
          return;
        }
      }
    }
  }
  
  // Get existing shortcuts
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    let shortcuts = result.customShortcuts || [];
    
    if (isUpdate && editIndex >= 0 && editIndex < shortcuts.length) {
      // Update existing shortcut
      shortcuts[editIndex].title = title;
      shortcuts[editIndex].url = url;
      shortcuts[editIndex].domains = domains; // Add domains
      
      // Save updated shortcuts
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        // Reset form to add mode
        resetShortcutForm();
        
        // Show success message
        customStatus.innerHTML = `
          <div>Shortcut updated successfully!</div>
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
      // Check if command ID already exists
      if (shortcuts.some(s => s.command === commandId)) {
        customStatus.textContent = `Command ID "${commandId}" already exists. Please choose a different one.`;
        customStatus.style.color = "red";
        return;
      }
      
      // Create a new shortcut
      shortcuts.push({
        command: commandId,
        title: title,
        url: url,
        domains: domains, // Add domains
        shortcutKey: ""
      });
      
      // Save updated shortcuts
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        // Clear the form
        resetShortcutForm();
        
        // Show success message with clear instructions
        customStatus.innerHTML = `
          <div>Shortcut added successfully!</div>
          <div style="margin-top:8px;">
            <strong>Important:</strong> To activate this shortcut, you need to:
            <ol style="margin-top:5px;padding-left:20px;">
              <li>Go to <code>chrome://extensions/shortcuts</code></li>
              <li>Find "${commandId}" under this extension</li>
              <li>Click the input field and set your keyboard shortcut</li>
            </ol>
          </div>
        `;
        customStatus.style.color = "green";
        
        // Reload the list
        loadCustomShortcuts();
      });
    }
  });
}

// Update Chrome commands (for manifest v3, this is mostly for documentation)
function updateChromeCommands(shortcuts) {
  // In Manifest V3, we can't add commands programmatically,
  // so this is mostly for future compatibility or extension
}

// Load and display custom shortcuts
function loadCustomShortcuts(sortColumn = null, sortDirection = 'asc') {
  if (!shortcutsBody) return;
  
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    let shortcuts = result.customShortcuts || [];
    
    // Sort shortcuts if requested
    if (sortColumn) {
      shortcuts.sort((a, b) => {
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
          case 'domain':
            valueA = (a.domains && a.domains.join(',')) || '';
            valueB = (b.domains && b.domains.join(',')) || '';
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
    }
    
    // Clear existing rows
    shortcutsBody.innerHTML = '';
    
    if (shortcuts.length === 0) {
      // Show a message if no shortcuts exist
      shortcutsBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center;">No custom shortcuts added yet</td>
        </tr>
      `;
    } else {
      // Update the row rendering to include domains and remove unwanted elements
      shortcuts.forEach((shortcut, index) => {
        const row = document.createElement('tr');
        
        // Format domains for display
        const domainsText = shortcut.domains && shortcut.domains.length > 0 
          ? shortcut.domains.join(', ') 
          : 'All websites';
        
        row.innerHTML = `
          <td>${shortcut.command}</td>
          <td>${shortcut.title}</td>
          <td>${shortcut.url}</td>
          <td data-command-id="${shortcut.command}" class="shortcut-cell">
            <span class="shortcut-binding">Set in chrome://extensions/shortcuts</span>
            <span class="optional-badge">optional</span>
          </td>
          <td class="domain-cell">${domainsText}</td>
          <td>
            <button class="edit-btn" data-index="${index}">Edit</button>
            <button class="delete-btn" data-index="${index}">Delete</button>
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

// Delete a custom shortcut
function deleteShortcut(index) {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    
    // Remove the shortcut at the specified index
    shortcuts.splice(index, 1);
    
    // Update command IDs to maintain sequence
    shortcuts.forEach((shortcut, i) => {
      shortcut.command = `shortcut-${i + 1}`;
    });
    
    // Save updated shortcuts
    chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
      // Show success message
      customStatus.textContent = "Shortcut deleted successfully!";
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

// Add this to your existing code
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
  
  // Rest of the function remains the same...
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
    // Jika dropdown tidak ditemukan, coba buat elemen dropdown
    createCommandDropdown();
    return;
  }
  
  // Clear current options - PENTING untuk mencegah duplikasi
  commandDropdown.innerHTML = ''; // Uncomment this line to fix the issue
  
  // Add a default option
  commandDropdown.appendChild(new Option('Select a command ID', ''));
  
  // Get existing shortcuts to check which commands are already used
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const usedCommandIds = shortcuts.map(s => s.command);
    
    // Add available commands to dropdown
    AVAILABLE_COMMANDS.forEach(cmd => {
      if (!usedCommandIds.includes(cmd)) {
        commandDropdown.appendChild(new Option(cmd, cmd));
      }
    });
    
    // If no commands available
    if (commandDropdown.options.length <= 1) {
      commandDropdown.appendChild(new Option('All commands in use - delete one first', ''));
      commandDropdown.disabled = true;
    } else {
      commandDropdown.disabled = false;
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
          <option value="">Select a command ID</option>
        </select>
      </div>
      <div class="shortcut-hint">Select from one of the pre-defined commands</div>
    `;
    
    // Replace the content of the form group
    commandFormGroup.innerHTML = `
      <label for="commandIdSelect">Command ID:</label>
      ${dropdownHtml}
    `;
    
    // Initialize the dropdown with options
    initCommandDropdown();
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
    
    // Populate domain targeting
    const domainTargetingInput = document.getElementById('domainTargeting');
    if (domainTargetingInput && shortcut.domains && shortcut.domains.length) {
      domainTargetingInput.value = shortcut.domains.join(', ');
    } else if (domainTargetingInput) {
      domainTargetingInput.value = '';
    }
    
    // Handle command ID dropdown differently - we disable it during edit
    const commandIdSelect = document.getElementById('commandIdSelect');
    if (commandIdSelect) {
      // Create a temporary option for this command ID
      const tempOption = new Option(shortcut.command, shortcut.command, true, true);
      commandIdSelect.innerHTML = '';
      commandIdSelect.appendChild(tempOption);
      commandIdSelect.disabled = true; // Disable during edit
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

// Fungsi untuk mereset form kembali ke status "Add"
function resetShortcutForm() {
  // Clear form fields
  if (titleInput) titleInput.value = '';
  if (shortcutUrlInput) shortcutUrlInput.value = '';
  
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

// Tambahkan CSS untuk Edit dan Cancel Button
const editStyles = document.createElement('style');
editStyles.textContent = `
  .edit-btn {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 5px;
  }
  
  .edit-btn:hover {
    background-color: #0069d9;
  }
  
  .update-btn {
    background-color: #28a745 !important;
  }
  
  .cancel-btn {
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 10px;
  }
  
  .cancel-btn:hover {
    background-color: #5a6268;
  }
  
  th.sortable {
    cursor: pointer;
    position: relative;
    user-select: none;
  }
  
  th.sortable:hover {
    background-color: #f0f0f0;
  }
  
  th.sort-asc .sort-icon:after {
    content: " ↓";
  }
  
  th.sort-desc .sort-icon:after {
    content: " ↑";
  }
  
  .optional-badge {
    font-size: 0.7em;
    background-color: #6c757d;
    color: white;
    padding: 2px 4px;
    border-radius: 3px;
    margin-left: 5px;
    vertical-align: middle;
  }
  
  .domain-cell {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .domain-cell:hover {
    overflow: visible;
    white-space: normal;
    word-break: break-all;
    background-color: #f8f9fa;
    position: relative;
    z-index: 1;
  }
`;
document.head.appendChild(editStyles);

// Add to [options/options.js](options/options.js) after all existing functions
// Around line 810
// Add table sorting functionality
function initTableSorting() {
  const table = document.getElementById('shortcutsTable');
  if (!table) return;
  
  // Current sort state
  let sortConfig = {
    column: null,
    direction: 'asc'
  };
  
  // Add click event listeners to sortable headers
  document.querySelectorAll('th.sortable').forEach(header => {
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
}