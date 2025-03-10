/**
 * Options script for Smart Shortcut Panel
 * Handles saving and loading custom URLs and shortcuts
 */


const shortcutForm = document.getElementById('shortcutForm');
const titleInput = document.getElementById('title');
const shortcutUrlInput = document.getElementById('shortcutUrl');
const shortcutsBody = document.getElementById('shortcutsBody');
const customStatus = document.getElementById('customStatus');
const configureShortcutsBtn = document.getElementById('configureShortcutsBtn');

const defaultTabBtn = document.getElementById('defaultTabBtn');
const customTabBtn = document.getElementById('customTabBtn');
const defaultTabContent = document.getElementById('defaultTabContent');
const customTabContent = document.getElementById('customTabContent');
const urlInput = document.getElementById('urlInput');
const saveBtn = document.getElementById('saveBtn');
const defaultStatus = document.getElementById('defaultStatus');

const DEFAULT_URL = "chrome://newtab"; 
const MAX_SHORTCUTS = 3;

let isRecording = false;
let commandIdEditable = false;
let currentShortcut = {
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  key: ''
};

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

const FREE_USER_LIMIT = 3;
let isPremiumUser = false;

const EXTENSION_ID = chrome.runtime.id; 

function getNextAvailableCommandId() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['customShortcuts'], (result) => {
      const shortcuts = result.customShortcuts || [];
      
      const usedCommandIds = shortcuts.map(s => s.command);
      const availableId = AVAILABLE_COMMANDS.find(id => !usedCommandIds.includes(id));
      
      resolve(availableId || '');
    });
  });
}

function isValidUrl(string) {
  if (!string || string.trim() === '') return false;
  
  let url = string.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try { 
    const urlObj = new URL(url);
    return urlObj.hostname && urlObj.hostname.includes('.') && 
           /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])+$/.test(urlObj.hostname);
  } catch (_) {
    return false;
  }
}

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

document.addEventListener('DOMContentLoaded', async () => {
  await checkPremiumStatus();
  
  displayPremiumStatus();
  initializeUI();
  setTimeout(debugCommands, 1000);
  loadData();
  initCollapsibleSections();
  addLicenseManagementSection();
});


function initializeUI() {
  if (configureShortcutsBtn) {
    configureShortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'chrome://extensions/shortcuts'
      });
    });
  }

  initGuideButton();
  prepareCommandDropdown();
  checkChromeAPIs();
  initTableSorting();
  initDomainAutoUpdate();
  enhanceDomainField();
  createDomainRestrictionInfo();
  createDomainField();
  addLicenseManagementSection();
}

function loadData() {
  if (urlInput) {
    chrome.storage.sync.get(['customUrl'], (result) => {
      if (result.customUrl) {
        urlInput.value = result.customUrl;
      } else {
        urlInput.value = DEFAULT_URL;
      }
    });
  }
  loadCustomShortcuts();
}


if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const customUrl = urlInput.value.trim();

    if (!customUrl) {
      defaultStatus.textContent = "Please enter a valid URL";
      defaultStatus.style.color = "red";
      return;
    }

    let urlToSave = customUrl;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      urlToSave = 'https://' + customUrl;
      urlInput.value = urlToSave;
    }

    chrome.storage.sync.set({ customUrl: urlToSave }, () => {
      defaultStatus.textContent = "Default URL saved successfully!";
      defaultStatus.style.color = "green";

      setTimeout(() => {
        defaultStatus.textContent = "";
      }, 2000);
    });
  });
}

if (shortcutForm) {
  shortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = titleInput.value.trim();
    let url = shortcutUrlInput.value.trim();

    const commandIdSelect = document.getElementById('commandIdSelect');
    let commandId = commandIdSelect ? commandIdSelect.value : '';

    const addBtn = document.getElementById('addBtn');
    const isUpdate = addBtn && addBtn.classList.contains('update-btn');
    const editIndex = isUpdate && addBtn ? parseInt(addBtn.getAttribute('data-edit-index')) : -1;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    chrome.runtime.sendMessage({
      action: "validateUrl", 
      url: url
    }, (response) => {
      if (!response.isValid) {
        customStatus.textContent = response.reason;
        customStatus.style.color = "red";
        return;
      }

      processFormSubmission(title, url, commandId, isUpdate, editIndex);
    });
  });
}

function getShortcutLimit() {
  return isPremiumUser ? Infinity : FREE_USER_LIMIT;
}

function processFormSubmission(title, url, commandId, isUpdate, editIndex) {
  if (!title) {
    customStatus.textContent = "Please enter a title for your shortcut";
    customStatus.style.color = "red";
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!isValidUrl(url)) {
    customStatus.textContent = "Please enter a valid URL (e.g., example.com)";
    customStatus.style.color = "red";
    return;
  }

  let currentDomain;
  try {
    currentDomain = new URL(url).hostname;
  } catch (e) {
    customStatus.textContent = "Invalid URL format";
    customStatus.style.color = "red";
    return;
  }

  const domainTargeting = document.getElementById('domainTargeting');
  let domains = [];

  if (domainTargeting) {
    domainTargeting.value = currentDomain;
    domains = [currentDomain];
  }

  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const domainShortcutsCount = shortcuts.filter((s, idx) => {
      if (isUpdate && idx === editIndex) return false;
      return s.domains && s.domains.includes(currentDomain);
    }).length;
    const shortcutLimit = getShortcutLimit();
    
    if (domainShortcutsCount >= shortcutLimit) {
      customStatus.innerHTML = `
        <div>Maximum limit of ${shortcutLimit} shortcuts per domain (${currentDomain}) reached.</div>
        ${!isPremiumUser ? `<div style="margin-top:8px;">
          <strong>Need more?</strong> <a href="#" id="upgradeLink">Upgrade to Premium</a> for unlimited shortcuts per domain.
        </div>` : ''}
      `;
      customStatus.style.color = "red";
      const upgradeLink = document.getElementById('upgradeLink');
      if (upgradeLink) {
        upgradeLink.addEventListener('click', (e) => {
          e.preventDefault();
          showPremiumUpgradeModal();
        });
      }
      
      return;
    }

    if (isUpdate && editIndex >= 0 && editIndex < shortcuts.length) {
      shortcuts[editIndex].command = commandId;
      shortcuts[editIndex].title = title;
      shortcuts[editIndex].url = url;
      shortcuts[editIndex].domains = domains; 
      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        resetShortcutForm();
        customStatus.innerHTML = `
          <div>Shortcut "${title}" updated successfully!</div>
        `;
        customStatus.style.color = "green";

        loadCustomShortcuts();
        setTimeout(() => {
          customStatus.textContent = "";
        }, 2000);
      });
    } else {
      if (commandId && commandId !== '' && shortcuts.some(s => s.command === commandId)) {
        customStatus.textContent = `Command ID "${commandId}" already exists. Please choose a different one.`; 
        customStatus.style.color = "red";
        return;
      }
      shortcuts.push({
        command: commandId || "", 
        title: title,
        url: url,
        domains: domains,
        shortcutKey: ""
      });

      chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
        resetShortcutForm();

        customStatus.innerHTML = `
          <div>Shortcut "${title}" added successfully</div>
          <div style="margin-top:8px;">
            <strong>Note:</strong> This shortcut will only appear when browsing at <strong>${currentDomain}</strong>.
          </div>
        `;
        customStatus.style.color = "green";

        loadCustomShortcuts();

        setTimeout(() => {
          customStatus.textContent = "";
        }, 4000);
      });
    }
  });
}

function updateChromeCommands(shortcuts) {
  // In Manifest V3, we can't add commands programmatically,
  // so this is mostly for future compatibility or extension
}

function loadCustomShortcuts(sortColumn = 'domain', sortDirection = 'asc') {
  if (!shortcutsBody) return;
  
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    let shortcuts = result.customShortcuts || [];
    
    console.log("Loaded shortcuts:", shortcuts);

    const domainGroups = {};
    shortcuts.forEach((shortcut, originalIndex) => {
      const domain = shortcut.domains && shortcut.domains.length > 0 ? 
        shortcut.domains[0] : 'All websites';
      
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      shortcut._originalIndex = originalIndex;
      domainGroups[domain].push(shortcut);
    });

    if (sortColumn) {
      Object.keys(domainGroups).forEach(domain => {
        domainGroups[domain].sort((a, b) => {
          let valueA, valueB;

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
          
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
          
          let result = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
          return sortDirection === 'desc' ? -result : result;
        });
      });
      const sortedDomains = Object.keys(domainGroups).sort();
      if (sortDirection === 'desc') {
        sortedDomains.reverse();
      }
      shortcuts = [];
      sortedDomains.forEach(domain => {
        shortcuts = shortcuts.concat(domainGroups[domain]);
      });
    }
    shortcutsBody.innerHTML = '';
    
    if (shortcuts.length === 0) {
      shortcutsBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center;">No custom shortcuts added yet</td>
        </tr>
      `;
    } else {
      let currentDomain = null;
      let domainCount = 0;
      
      shortcuts.forEach((shortcut, displayIndex) => {
        const domain = shortcut.domains && shortcut.domains.length > 0 ? 
          shortcut.domains[0] : 'All websites';
        
        if (domain !== currentDomain) {
          domainCount = domainGroups[domain].length;
          currentDomain = domain;
          const headerRow = document.createElement('tr');
          headerRow.className = 'domain-header';
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

        const row = document.createElement('tr');
        const originalIndex = shortcut._originalIndex;
        
        row.innerHTML = `
          <td>${shortcut.command || '<span class="optional-badge">none</span>'}</td>
          <td>${shortcut.title}</td>
          <td>${shortcut.url}</td>
          <td data-command-id="${shortcut.command}" class="shortcut-cell">
            ${shortcut.command ? 
              '<span class="shortcut-binding">Set in chrome://extensions/shortcuts</span>' : 
              '<span class="no-command">No command ID assigned</span>'}
          </td>
          <td class="domain-cell">${domain}</td>
          <td>
            <button class="edit-btn" data-index="${originalIndex}">Edit</button>
            <button class="delete-btn" data-index="${originalIndex}">Delete</button>
          </td>
        `;
        
        shortcutsBody.appendChild(row);
      });

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

  updateShortcutDisplayTable();
}

function deleteShortcut(index) {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const deletedShortcut = shortcuts[index];
    
    if (!deletedShortcut) {
      customStatus.textContent = "Error: Shortcut not found";
      customStatus.style.color = "red";
      return;
    }
    shortcuts.splice(index, 1);

    chrome.storage.sync.set({ customShortcuts: shortcuts }, () => {
      customStatus.innerHTML = `
        <div>Shortcut "${deletedShortcut.title}" deleted successfully!</div>
      `;
      customStatus.style.color = "green";
      loadCustomShortcuts();
      setTimeout(() => {
        customStatus.textContent = "";
      }, 2000);
    });
  });
}

function updateShortcutDisplayTable() {
  // Only Chrome 93+ includes the commands.getAll API
  if (!chrome.commands || !chrome.commands.getAll) {
    return;
  }
  
  chrome.commands.getAll((commands) => {
    chrome.storage.sync.get(['customShortcuts'], (result) => {
      const shortcuts = result.customShortcuts || [];
      const shortcutMap = {};
      shortcuts.forEach(shortcut => {
        shortcutMap[shortcut.command] = shortcut;
      });
      commands.forEach(command => {
        if (shortcutMap[command.name]) {
          const shortcutElem = document.querySelector(`[data-command-id="${command.name}"] .shortcut-binding`);
          if (shortcutElem) {
            shortcutElem.textContent = "Set here";
            shortcutElem.style.color = command.shortcut ? 'green' : 'blue';
            shortcutElem.style.cursor = 'pointer';
            shortcutElem.style.textDecoration = 'underline';
            const newElem = shortcutElem.cloneNode(true);
            shortcutElem.parentNode.replaceChild(newElem, shortcutElem);
            newElem.addEventListener('click', function() {
              chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
            });
          }
        }
      });
    });
  });
}

setInterval(updateShortcutDisplayTable, 5000);


function showShortcutConfigGuide() {
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

let hasCommandsAPI = false;

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

document.addEventListener('DOMContentLoaded', checkChromeAPIs);

function initCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) {
    createCommandDropdown();
    return;
  }
  
  commandDropdown.innerHTML = '';

  commandDropdown.appendChild(new Option('None (Optional)', ''));

  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const usedCommandIds = shortcuts.map(s => s.command).filter(id => id); 

    if (AVAILABLE_COMMANDS && AVAILABLE_COMMANDS.length) {
      AVAILABLE_COMMANDS.forEach(cmd => {
        if (!usedCommandIds.includes(cmd)) {
          commandDropdown.appendChild(new Option(cmd, cmd));
        }
      });
    }

    if (commandDropdown.options.length <= 1) {
      commandDropdown.appendChild(new Option('All command IDs in use', ''));
    }
  });
}

function createCommandDropdown() {
  const formGroups = document.querySelectorAll('.form-group');
  let commandFormGroup;
  
  for (const group of formGroups) {
    if (group.textContent.toLowerCase().includes('command id')) {
      commandFormGroup = group;
      break;
    }
  }
  
  if (commandFormGroup) {
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

    commandFormGroup.innerHTML = `
      <label for="commandIdSelect">Command ID (Optional):</label>
      ${dropdownHtml}
    `;

    initCommandDropdown();
  }
}

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

function prepareCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) {
    createCommandDropdown();
  } else {
    initCommandDropdown();
  }
}

function fillCommandDropdown() {
  const commandDropdown = document.getElementById('commandIdSelect');
  if (!commandDropdown) return;
  
  commandDropdown.innerHTML = '';
  commandDropdown.appendChild(new Option('Select a command ID', ''));
  
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

function updateCommandIdDropdown() {
  fillCommandDropdown();
}

function editShortcut(index) {
  chrome.storage.sync.get(['customShortcuts'], (result) => {
    const shortcuts = result.customShortcuts || [];
    const shortcut = shortcuts[index];
    
    if (!shortcut) return;

    if (titleInput) titleInput.value = shortcut.title;
    if (shortcutUrlInput) shortcutUrlInput.value = shortcut.url;
    
    let domain = '';
    try {
      domain = new URL(shortcut.url).hostname;
    } catch (e) {
      console.error('Invalid URL', e);
    }

    const domainTargetingInput = document.getElementById('domainTargeting');
    if (domainTargetingInput) {
      domainTargetingInput.value = domain;
      domainTargetingInput.setAttribute('readonly', 'readonly');
    }

    const commandIdSelect = document.getElementById('commandIdSelect');
    if (commandIdSelect) {
      commandIdSelect.innerHTML = '';
      commandIdSelect.appendChild(new Option('None (Optional)', ''));

      const usedCommandIds = shortcuts
        .filter((s, i) => i !== index && s.command)
        .map(s => s.command);

      AVAILABLE_COMMANDS.forEach(cmd => {
        if (!usedCommandIds.includes(cmd) || shortcut.command === cmd) {
          const option = new Option(cmd, cmd);
          commandIdSelect.appendChild(option);

          if (shortcut.command === cmd) {
            option.selected = true;
          }
        }
      });

      commandIdSelect.disabled = false;
    }

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.textContent = 'Update Shortcut';
      addBtn.classList.add('update-btn');
      addBtn.setAttribute('data-edit-index', index);
    }

    if (!document.getElementById('cancelEditBtn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelEditBtn';
      cancelBtn.className = 'cancel-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.type = 'button';
      
      cancelBtn.addEventListener('click', () => {
        resetShortcutForm();
      });
      
      if (addBtn && addBtn.parentNode) {
        addBtn.parentNode.insertBefore(cancelBtn, addBtn.nextSibling);
      }
    }
    
    if (shortcutForm) {
      shortcutForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function resetShortcutForm() {
  if (titleInput) titleInput.value = '';
  if (shortcutUrlInput) shortcutUrlInput.value = '';
  const domainTargetingInput = document.getElementById('domainTargeting');
  if (domainTargetingInput) {
    domainTargetingInput.value = '';
    domainTargetingInput.setAttribute('readonly', 'readonly');
  }

  updateCommandIdDropdown();
  const commandIdSelect = document.getElementById('commandIdSelect');
  if (commandIdSelect) {
    commandIdSelect.disabled = false;
  }
  
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.textContent = 'Add Custom Shortcut';
    addBtn.classList.remove('update-btn');
    addBtn.removeAttribute('data-edit-index');
  }

  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) {
    cancelBtn.parentNode.removeChild(cancelBtn);
  }
}

function initTableSorting() {
  const table = document.getElementById('shortcutsTable');
  if (!table) return;

  let sortConfig = {
    column: 'domain', 
    direction: 'asc'
  };

  document.querySelectorAll('th.sortable').forEach(header => {
    if (header.getAttribute('data-sort') === 'domain') {
      header.classList.add('sort-asc');
    }
    
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      const direction = sortConfig.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc';

      document.querySelectorAll('th.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');

      sortConfig = { column, direction };

      loadCustomShortcuts(column, direction);
    });
  });
  
  loadCustomShortcuts(sortConfig.column, sortConfig.direction);
}

function initDomainAutoUpdate() {
  const urlInput = document.getElementById('shortcutUrl');
  const domainInput = document.getElementById('domainTargeting');
  
  if (!urlInput || !domainInput) return;

  domainInput.setAttribute('readonly', 'readonly');

  const extractDomain = (url) => {
    if (!url || url.trim() === '') return '';

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      return new URL(url).hostname;
    } catch (e) {
      const domainMatch = url.match(/[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/);
      return domainMatch ? domainMatch[0] : '';
    }
  };
  
  const updateDomain = (domain) => {
    domainInput.value = domain;
    domainInput.placeholder = domain ? domain : "Automatically set from URL";

    if (domain) {
      domainInput.classList.remove('domain-updated');
      requestAnimationFrame(() => {
        domainInput.classList.add('valid-domain');
        domainInput.classList.add('domain-updated');
      });
    } else {
      domainInput.classList.remove('valid-domain');
      domainInput.classList.remove('domain-updated');
    }
  };

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    const domain = extractDomain(url);

    updateDomain(domain);
 
  });

  urlInput.addEventListener('blur', () => {
    let url = urlInput.value.trim();
    
    if (url) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        urlInput.value = url;
      }

      try {
        const domain = new URL(url).hostname;
        updateDomain(domain);
      } catch (e) {
        updateDomain('');
      }
    }
  });

  if (urlInput.value.trim()) {
    const domain = extractDomain(urlInput.value.trim());
    updateDomain(domain);
  }
}

function createDomainRestrictionInfo() {
  const formContainer = document.querySelector('.custom-shortcut-form');
  if (!formContainer) return;

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

    formContainer.insertBefore(infoElement, formContainer.firstChild);
  }
}

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

function initGuideButton() {
  const guideBtn = document.getElementById('shortcutGuideBtn');
  if (guideBtn) {
    guideBtn.addEventListener('click', () => {
      showShortcutConfigGuide();
    });
  }
}

function enhanceDomainField() {
  const domainContainer = document.getElementById('domainTargeting')?.parentElement;
  if (!domainContainer) return;

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

  const autoLabel = document.createElement('span');
  autoLabel.className = 'domain-auto-label';
  autoLabel.textContent = 'Auto-filled from URL';

  const hintDiv = domainContainer.querySelector('.shortcut-hint') || document.createElement('div');
  hintDiv.className = 'shortcut-hint';
  hintDiv.innerHTML = `
    <div class="domain-auto-update">
      <span class="domain-auto-icon">${autoIcon.innerHTML}</span>
      <span>Auto-filled from URL</span>
    </div>
  `;

  if (!domainContainer.querySelector('.shortcut-hint')) {
    domainContainer.appendChild(hintDiv);
  }
  
}

function checkPremiumStatus() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['premiumStatus'], (result) => {
      if (result.premiumStatus && result.premiumStatus.active === true) {
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

function displayPremiumStatus() {
  let statusContainer = document.querySelector('.premium-status-container');
  
  if (!statusContainer) {
    statusContainer = document.createElement('div');
    statusContainer.className = 'premium-status-container';

    const h1 = document.querySelector('h1');
    if (h1 && h1.parentNode) {
      h1.parentNode.insertBefore(statusContainer, h1.nextSibling);
    } else {
      document.body.insertBefore(statusContainer, document.body.firstChild);
    }
  }
  
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};

    let activatedText = '';
    if (premiumData.activatedOn) {
      const activationDate = new Date(premiumData.activatedOn);
      activatedText = `Activated on: ${activationDate.toLocaleDateString()}`;
    }

    let expiresText = '';
    if (premiumData.expiresOn) {
      const expiryDate = new Date(premiumData.expiresOn);
      expiresText = `Expires: ${expiryDate.toLocaleDateString()}`;
    }

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

    const upgradeBtn = document.getElementById('upgradeToPremium');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', showPremiumUpgradeModal);
    }
  });
}

function showPremiumUpgradeModal() {
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
        <a href="#" id="buyPremium" class="primary-btn">Purchase Premium</a>
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

  document.body.appendChild(modal);

  document.getElementById('buyPremium').addEventListener('click', (e) => {
    e.preventDefault();
    const width = 800;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    window.open(
      'https://ridwancard.my.id/buy-smart-shortcut-panel',
      'PremiumPurchase',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  });

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

const LICENSE_API_CONFIG = {
  baseUrl: 'https://ridwancard.my.id',
  endpoints: {
    activate: '/wp-json/lmfwc/v2/licenses/activate/',
    validate: '/wp-json/lmfwc/v2/licenses/validate/',
    deactivate: '/wp-json/lmfwc/v2/licenses/deactivate/'
  }
};

function makeLicenseApiRequest(endpoint, licenseKey) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "licenseApiRequest",
      endpoint: endpoint,
      licenseKey: licenseKey
    }, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    });
  });
}

function verifyLicenseKey(licenseKey) {
  const licenseMessage = document.getElementById('licenseMessage');
  licenseMessage.innerHTML = '<p style="color: blue;">Verifying license...</p>';
  
  makeLicenseApiRequest(LICENSE_API_CONFIG.endpoints.activate, licenseKey)
    .then(data => {
      if (data.success === true) {
        licenseMessage.innerHTML = '<p style="color: green;">License verified and activated successfully! Refreshing page...</p>';
        
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
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        });
      } else {
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

function refreshLicense() {
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    const licenseKey = premiumData.licenseKey;
    
    if (!licenseKey) {
      customStatus.innerHTML = `<div style="color: red;">No license key found. Please add a license first.</div>`;
      return;
    }
    
    customStatus.innerHTML = `<div style="color: blue;">Refreshing license status...</div>`;
    
    makeLicenseApiRequest(LICENSE_API_CONFIG.endpoints.validate, licenseKey)
      .then(data => {
        if (data.success === true) {
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
            updateLicenseDetails();
            displayPremiumStatus();
            
            customStatus.innerHTML = `<div style="color: green;">License refreshed successfully!</div>`;
            setTimeout(() => {
              customStatus.textContent = "";
            }, 4000);
          });
        } else {
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

function maskLicenseKey(key) {
  if (!key || key === 'Unknown') return 'Unknown';
  if (key.length <= 4) return key;
  return '••••••••' + key.slice(-4);
}

function deactivateLicense() {
  if (!confirm('Are you sure you want to deactivate your premium license? This will revert you to the free version with limited features.')) {
    return;
  }
  
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    const licenseKey = premiumData.licenseKey;
    
    showStatusMessage('Deactivating license...', 'blue');
    
    if (!licenseKey) {
      removeLicenseLocally('License deactivated. You\'re now using the free version.', 'orange');
      return;
    }
    
    makeLicenseApiRequest(LICENSE_API_CONFIG.endpoints.deactivate, licenseKey)
      .then(data => {
        const message = data.success === true 
          ? 'License deactivated successfully. You\'re now using the free version.'
          : 'License deactivated locally. You\'re now using the free version.';
        
        if (!data.success) {
          console.warn('Remote deactivation failed:', data.message);
        }
        
        removeLicenseLocally(message, 'orange');
      })
      .catch(error => {
        console.error('License deactivation error:', error);
        removeLicenseLocally('License deactivated locally. You\'re now using the free version.', 'orange');
      });
  });
  
  function showStatusMessage(message, color) {
    customStatus.innerHTML = `<div style="color: ${color};">${message}</div>`;
  }
  
  function removeLicenseLocally(message, color) {
    chrome.storage.sync.remove(['premiumStatus'], () => {
      showStatusMessage(message, color);
      window.location.reload();
    });
  }
}

document.getElementById('openShortcutsPage').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

function initCollapsibleSections() {
  const collapsibles = document.querySelectorAll('.collapsible-header');
  
  collapsibles.forEach(collapsible => {
    collapsible.addEventListener('click', function() {
      this.parentElement.classList.toggle('active');
    });
  });
  
  if (collapsibles.length > 0) {
    collapsibles[0].parentElement.classList.add('active');
  }
}


function showShortcutConfigGuide() {
  const guideContent = `
    <div class="guide-container">
      <h2>📘 Complete Guide: Getting The Most From Smart Shortcut Panel</h2>
      
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
              <li>Find "Smart Shortcut Panel" in the list of extensions</li>
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
  
  showModal('Shortcut Configuration Guide', guideContent);
}

function showModal(title, content) {
  const existingModal = document.querySelector('.guide-modal');
  if (existingModal) {
    existingModal.parentNode.removeChild(existingModal);
  }
  
  const modal = document.createElement('div');
  modal.className = 'guide-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'modalTitle');
  modal.setAttribute('aria-describedby', 'modalContent');
  
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
  
  document.body.appendChild(modal);
  
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  firstElement.focus();
  
  const closeBtn = modal.querySelector('.guide-close-btn');
  const okBtn = modal.querySelector('.guide-ok-btn');
  
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  document.addEventListener('keydown', function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscapeKey);
    }
  });
  
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

function addLicenseManagementSection() {
  const settingsContainer = document.querySelector('.shortcut-note.highlight') || document.body;
  
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
    
    const form = document.getElementById('shortcutForm');
    if (form && form.parentNode) {
      form.parentNode.insertBefore(licenseSection, form);
    } else {
      settingsContainer.appendChild(licenseSection);
    }
    
    const header = licenseSection.querySelector('.collapsible-header');
    const content = licenseSection.querySelector('.collapsible-content');
    const icon = licenseSection.querySelector('.collapsible-icon');
    
    header.addEventListener('click', function() {
      if (content.style.display === "none" || !content.style.display) {
        content.style.display = "block";
        icon.textContent = "▼"; 
        updateLicenseDetails();
      } else {
        content.style.display = "none";
        icon.textContent = "▶"; 
      }
    });
    
    document.getElementById('refreshLicenseBtn').addEventListener('click', refreshLicense);
    document.getElementById('deactivateLicenseBtn').addEventListener('click', deactivateLicense);
    
    updateLicenseDetails();
  }
}

function updateLicenseDetails() {
  const licenseDetails = document.getElementById('licenseDetails');
  const licenseActionButtons = document.getElementById('licenseActionButtons');
  
  if (!licenseDetails || !licenseActionButtons) return;
  
  chrome.storage.sync.get(['premiumStatus'], (result) => {
    const premiumData = result.premiumStatus || {};
    
    if (premiumData.active) {
      licenseActionButtons.style.display = 'block';
      
      const activatedDate = premiumData.activatedOn ? 
        new Date(premiumData.activatedOn).toLocaleDateString() : 'Unknown';
      
      const lastVerifiedInfo = premiumData.lastVerified ? 
        `<p><strong>Last Verified:</strong> ${new Date(premiumData.lastVerified).toLocaleString()}</p>` : '';
      
      const expiryInfo = premiumData.expiresOn ? 
        `<p><strong>Expires On:</strong> ${new Date(premiumData.expiresOn).toLocaleDateString()}</p>` : 
        '<p><strong>License Type:</strong> Lifetime (no expiration)</p>';
      
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
      
      const licenseSection = document.getElementById('licenseManagementSection');
      if (licenseSection) {
        licenseSection.style.display = 'block';
      }
    } else {
      licenseActionButtons.style.display = 'none';
      
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
      
      const addLicenseBtn = document.getElementById('addLicenseBtn');
      if (addLicenseBtn) {
        addLicenseBtn.addEventListener('click', showPremiumUpgradeModal);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const shortcutLinks = document.querySelectorAll('#openShortcutsPage');
  shortcutLinks.forEach(link => {
    link.addEventListener('click', function() {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  });
  
});
