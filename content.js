/**
 * Content script for Custom Shortcut Extension
 * Adds a floating panel to access shortcuts from any page
 */

// Function to get initials from title
function getInitials(title) {
  // Handle empty strings
  if (!title) return '?';

  // Split by spaces and get first letter of each word (max 2)
  const words = title.trim().split(/\s+/);
  if (words.length === 1) {
    // If single word, return first 2 letters (or 1 if very short)
    return words[0].length > 1 ? words[0].substring(0, 2).toUpperCase() : words[0].substring(0, 1).toUpperCase();
  }

  // Return first letter of first word + first letter of last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Generate a background color based on text
function getColorFromText(text) {
  // Simple hash function to generate color
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use pastel-like colors
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

// Get the current domain
function getCurrentDomain() {
  return window.location.hostname;
}

// Enhance the domain matching function to support subdomains
function isDomainMatch(targetDomain, currentDomain) {
  // Direct match
  if (targetDomain === currentDomain) return true;

  // Check for wildcard subdomain matching
  if (targetDomain.startsWith('*.')) {
    const baseDomain = targetDomain.substring(2);
    return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
  }

  // Try as regex pattern match
  try {
    const regex = new RegExp(targetDomain, 'i');
    return regex.test(currentDomain);
  } catch (e) {
    // If invalid regex, just do exact match
    return false;
  }
}

// Store references to event listeners for cleanup
let documentClickListener = null;

function setupEventListeners(panel) {
  // Remove existing listeners first
  if (documentClickListener) {
    document.removeEventListener('click', documentClickListener);
  }
  
  // Create and store new listener
  documentClickListener = (e) => {
    if (!panel.contains(e.target) && panel.classList.contains('shortcut-ext-expanded')) {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    }
  };
  
  // Add listener
  document.addEventListener('click', documentClickListener);
}

// Enhanced toggle functionality with dynamic expansion direction
function toggleBtn_onClick() {
  const panel = document.getElementById('shortcut-ext-panel');
  if (!panel) return;
  
  // If already expanded, simply collapse and restore original position
  if (panel.classList.contains('shortcut-ext-expanded')) {
    // Store position before collapsing
    const rect = panel.getBoundingClientRect();
    
    // Remove expanded classes
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
    panel.classList.add('shortcut-ext-collapsed');
    
    // Get the original position from the data attributes
    const originalRight = panel.getAttribute('data-original-right');
    const originalBottom = panel.getAttribute('data-original-bottom');
    const originalLeft = panel.getAttribute('data-original-left');
    const originalTop = panel.getAttribute('data-original-top');
    
    // Restore original position
    if (originalRight && originalBottom) {
      panel.style.right = originalRight;
      panel.style.bottom = originalBottom;
      panel.style.left = 'auto';
      panel.style.top = 'auto';
    } else if (originalLeft && originalTop) {
      panel.style.left = originalLeft;
      panel.style.top = originalTop;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
    
    return;
  }
  
  // Store original position before expanding
  const style = window.getComputedStyle(panel);
  if (style.right !== 'auto' && style.bottom !== 'auto') {
    panel.setAttribute('data-original-right', style.right);
    panel.setAttribute('data-original-bottom', style.bottom);
  } else {
    panel.setAttribute('data-original-left', style.left);
    panel.setAttribute('data-original-top', style.top);
  }
  
  // Determine best expansion direction
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get panel dimensions
  const expandedWidth = parseInt(panel.style.getPropertyValue('--panel-expanded-width')) || 320;
  const expandedHeight = parseInt(panel.style.getPropertyValue('--panel-expanded-height')) || 460;
  
  // Calculate available space in each direction
  const spaceRight = viewportWidth - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = viewportHeight - rect.bottom;
  const spaceTop = rect.top;
  
  // Determine horizontal expansion direction
  let expandDirectionClass;
  
  if (spaceRight >= expandedWidth) {
    // Can expand to the right
    expandDirectionClass = spaceBottom >= expandedHeight ? 'expand-right-down' : 'expand-right-up';
  } else if (spaceLeft >= expandedWidth) {
    // Can expand to the left
    expandDirectionClass = spaceBottom >= expandedHeight ? 'expand-left-down' : 'expand-left-up';
  } else {
    // Not enough space horizontally, choose best direction
    expandDirectionClass = (spaceRight >= spaceLeft) ? 
      (spaceBottom >= expandedHeight ? 'expand-right-down' : 'expand-right-up') : 
      (spaceBottom >= expandedHeight ? 'expand-left-down' : 'expand-left-up');
  }
  
  // Remove all direction classes first
  panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
  
  // Apply classes
  panel.classList.remove('shortcut-ext-collapsed');
  panel.classList.add('shortcut-ext-expanded', expandDirectionClass);
  
  // Set a timeout to adjust height after shortcuts are loaded
  setTimeout(() => {
    adjustPanelHeight(panel);
    ensurePanelInViewport(panel);
  }, 300);
}

// Function to adjust panel height based on content
function adjustPanelHeight(panel) {
  const shortcutsContainer = document.getElementById('shortcut-ext-shortcuts');
  if (!shortcutsContainer) return;
  
  // Get all shortcut items
  const shortcutItems = shortcutsContainer.querySelectorAll('.shortcut-ext-item');
  
  if (shortcutItems.length === 0) return;
  
  // Reset max-height temporarily to measure content
  shortcutsContainer.style.maxHeight = 'none';
  
  // Calculate height for visible elements (max 3 items)
  const itemHeight = shortcutItems[0].offsetHeight + 10; // Add margin
  
  // Calculate other elements' heights
  const headerHeight = panel.querySelector('.shortcut-ext-header').offsetHeight || 60;
  const searchHeight = panel.querySelector('.shortcut-ext-search').offsetHeight || 60;
  // Removed footer height reference
  
  // Calculate container height for 3 items max
  const shortcutsMaxHeight = Math.min(itemHeight * shortcutItems.length, itemHeight * 3);
  
  // Calculate total panel height (with 20px padding)
  const totalHeight = headerHeight + searchHeight + shortcutsMaxHeight + 40;
  
  // Apply the height (min 200px, max 460px)
  const finalHeight = Math.max(200, Math.min(totalHeight, 460));
  panel.style.setProperty('--panel-expanded-height', finalHeight + 'px');
  
  // Re-apply scrollable max-height to shortcuts container
  shortcutsContainer.style.maxHeight = shortcutsMaxHeight + 'px';
}

// Create the shortcuts panel
function createShortcutPanel() {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'shortcut-ext-panel';
  panel.className = 'shortcut-ext-panel shortcut-ext-collapsed';
  
  // Set fixed dimensions for expanded state via CSS variables
  panel.style.setProperty('--panel-expanded-width', '320px');
  panel.style.setProperty('--panel-expanded-height', '460px');
  panel.style.setProperty('--panel-collapsed-width', '48px');  // Added for collapsed state
  panel.style.setProperty('--panel-collapsed-height', '48px'); // Added for collapsed state

  // Create content wrapper to facilitate scrolling
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'shortcut-ext-content-wrapper';

  // Create toggle button with modern design
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'shortcut-ext-toggle';
  toggleBtn.className = 'shortcut-ext-toggle';
  toggleBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
      <path d="M6 8h.01"></path>
      <path d="M10 8h.01"></path>
      <path d="M14 8h.01"></path>
      <path d="M18 8h.01"></path>
      <path d="M8 12h.01"></path>
      <path d="M12 12h.01"></path>
      <path d="M16 12h.01"></path>
      <path d="M7 16h10"></path>
    </svg>
  `;
  toggleBtn.title = 'Toggle Custom Shortcuts';

   // Create panel header
  const panelHeader = document.createElement('div');
  panelHeader.className = 'shortcut-ext-header';
  panelHeader.innerHTML = `
    <h3>Shortcuts for this site</h3>
    <div class="shortcut-ext-header-actions">
      <button id="shortcut-ext-settings" class="shortcut-ext-button" title="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <button id="shortcut-ext-close" class="shortcut-ext-close" title="Close Panel">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  // Check premium status and add badge if premium
  isPremiumUser().then(premium => {
    if (premium) {
      const header = panelHeader.querySelector('h3');
      if (header) {
        header.innerHTML = `
          Shortcuts for this site
          <span class="premium-badge-small">PRO</span>
        `;
      }
    }
  });

  // Create shortcuts container
  const shortcutsContainer = document.createElement('div');
  shortcutsContainer.id = 'shortcut-ext-shortcuts';
  shortcutsContainer.className = 'shortcut-ext-shortcuts';

  // Create loading indicator with modern spinner
  shortcutsContainer.innerHTML = `
    <div class="shortcut-ext-loading">
      <div class="shortcut-ext-spinner"></div>
      <p>Loading shortcuts...</p>
    </div>
  `;

  // Create search box for filtering shortcuts
  const searchBox = document.createElement('div');
  searchBox.className = 'shortcut-ext-search';
  searchBox.innerHTML = `
    <div class="shortcut-ext-search-container">
      <svg class="shortcut-ext-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input type="text" id="shortcut-ext-search-input" placeholder="Search shortcuts...">
    </div>
  `;

  // Add elements to the panel
  panel.appendChild(toggleBtn);
  contentWrapper.appendChild(panelHeader);
  contentWrapper.appendChild(searchBox);
  contentWrapper.appendChild(shortcutsContainer);
  

  // Add wrapper to panel
  panel.appendChild(contentWrapper);

  // Add panel to the page
  document.body.appendChild(panel);

  // Replace the toggle functionality with our dynamic function
  toggleBtn.addEventListener('click', toggleBtn_onClick);
  
  // Same for the keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key === 'S') {
      toggleBtn_onClick();
    }
  });

  // Add close functionality
  const closeBtn = document.getElementById('shortcut-ext-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    });
  }

  // Add settings functionality
  const settingsBtn = document.getElementById('shortcut-ext-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({action: "openOptions"});
    });
  }

  // Add search functionality
  const searchInput = document.getElementById('shortcut-ext-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const shortcutItems = document.querySelectorAll('.shortcut-ext-item');

      shortcutItems.forEach(item => {
        const title = item.getAttribute('data-title').toLowerCase();
        const url = item.getAttribute('data-url').toLowerCase();

        if (title.includes(query) || url.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Setup event listeners
  setupEventListeners(panel);
  
  // Set panel position from user preference
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    
    // Apply position
    Object.keys(position).forEach(key => {
      panel.style[key] = position[key];
      
      // Store original position as data attributes
      if (key === 'right' || key === 'bottom' || key === 'left' || key === 'top') {
        panel.setAttribute('data-original-' + key, position[key]);
      }
    });
    
    // Ensure initial position is valid
    if (panel.classList.contains('shortcut-ext-expanded')) {
      ensurePanelInViewport(panel);
    }
  });
  
  // Make panel draggable
  makeElementDraggable(panel, toggleBtn);
}

// Function to ensure panel stays within viewport
function ensurePanelInViewport(panel) {
  // Get panel dimensions
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate adjustments if needed
  let leftAdjust = 0;
  let topAdjust = 0;
  
  // Check right edge
  if (rect.right > viewportWidth - 20) {
    leftAdjust = viewportWidth - 20 - rect.right;
  }
  
  // Check left edge
  if (rect.left < 20) {
    leftAdjust = 20 - rect.left;
  }
  
  // Check bottom edge
  if (rect.bottom > viewportHeight - 20) {
    topAdjust = viewportHeight - 20 - rect.bottom;
  }
  
  // Check top edge
  if (rect.top < 20) {
    topAdjust = 20 - rect.top;
  }
  
  // Apply adjustments if needed
  if (leftAdjust !== 0 || topAdjust !== 0) {
    // Convert any right/bottom to left/top for consistency
    const style = window.getComputedStyle(panel);
    let left = parseInt(style.left) || 0;
    let top = parseInt(style.top) || 0;
    
    if (left === 0 && style.right !== 'auto') {
      left = viewportWidth - rect.width - parseInt(style.right);
    }
    
    if (top === 0 && style.bottom !== 'auto') {
      top = viewportHeight - rect.height - parseInt(style.bottom);
    }
    
    // Set adjusted position
    panel.style.left = `${left + leftAdjust}px`;
    panel.style.top = `${top + topAdjust}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    // Update stored position
    chrome.storage.sync.set({
      'panelPosition': {
        top: panel.style.top,
        left: panel.style.left,
        right: 'auto',
        bottom: 'auto'
      }
    });
  }
}

function makeElementDraggable(element, handle) {
  let startX, startY, startLeft, startTop;
  let isDragging = false;
  let hasMoved = false; // Track if actual movement occurred
  
  function initPosition() {
    const style = window.getComputedStyle(element);
    if (style.position !== 'fixed') {
      element.style.position = 'fixed';
    }
    
    // Initialize element position if needed
    if (!element.style.left && !element.style.top) {
      element.style.right = '20px';
      element.style.bottom = '20px';
    }
  }
  
  function dragStart(e) {
    // Only allow dragging from the handle (not the entire panel)
    if (e.target !== handle && !handle.contains(e.target)) return;
    
    // Prevent default behavior
    e.preventDefault();
    
    // Reset movement flag
    hasMoved = false;
    
    // Get initial positions
    startX = e.clientX;
    startY = e.clientY;
    
    // Get current position in pixels
    const style = window.getComputedStyle(element);
    startLeft = parseInt(style.left) || 0;
    startTop = parseInt(style.top) || 0;
    
    // Convert right/bottom to left/top if needed
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = element.getBoundingClientRect();
    
    if (startLeft === 0 && style.right !== 'auto') {
      startLeft = viewportWidth - rect.width - parseInt(style.right);
      element.style.right = 'auto';
    }
    
    if (startTop === 0 && style.bottom !== 'auto') {
      startTop = viewportHeight - rect.height - parseInt(style.bottom);
      element.style.bottom = 'auto';
    }
    
    isDragging = true;
    
    // Use window event listeners for better drag tracking
    window.addEventListener('mousemove', drag, { passive: false });
    window.addEventListener('mouseup', dragEnd);
    
    // Add dragging class for visual feedback
    element.classList.add('shortcut-ext-dragging');
  }
  
  function drag(e) {
    if (!isDragging) return;
    e.preventDefault(); // Important for smooth dragging
    
    // Calculate position difference
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // If moved more than 3px, consider it an actual drag
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
    }
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = element.getBoundingClientRect();
    
    // Calculate new position with boundary checks
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    
    // Ensure panel stays within viewport boundaries (with 20px margin)
    newLeft = Math.max(20, Math.min(newLeft, viewportWidth - rect.width - 20));
    newTop = Math.max(20, Math.min(newTop, viewportHeight - rect.height - 20));
    
    // Apply new position
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }
  
  function dragEnd(e) {
    if (!isDragging) return;
    
    isDragging = false;
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', dragEnd);
    
    // Remove dragging class
    element.classList.remove('shortcut-ext-dragging');
    
    // Only save position if actually moved
    if (hasMoved) {
      // Store as original position data attributes
      element.setAttribute('data-original-left', element.style.left);
      element.setAttribute('data-original-top', element.style.top);
      element.removeAttribute('data-original-right');
      element.removeAttribute('data-original-bottom');
      
      // Save position for persistence
      chrome.storage.sync.set({
        'panelPosition': {
          top: element.style.top,
          left: element.style.left,
          right: 'auto',
          bottom: 'auto'
        }
      });
      
      // Prevent toggle from opening after drag
      e.stopPropagation();
      
      // IMPORTANT: Create a more robust click prevention
      const clickThreshold = 300; // milliseconds
      const clickBlocker = (event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      
      // Block all clicks on the handle for a short period after drag
      handle.addEventListener('click', clickBlocker, true);
      
      // Remove the click blocker after the threshold
      setTimeout(() => {
        handle.removeEventListener('click', clickBlocker, true);
      }, clickThreshold);
    }
  }
  
  // Initialize position
  initPosition();
  
  // Add listeners
  handle.addEventListener('mousedown', dragStart);
}

// Load shortcuts from storage
function loadShortcuts() {
  const shortcutsContainer = document.getElementById('shortcut-ext-shortcuts');
  if (!shortcutsContainer) return;

  // Show loading spinner
  shortcutsContainer.innerHTML = `
    <div class="shortcut-ext-loading">
      <div class="shortcut-ext-spinner"></div>
      <p>Loading shortcuts...</p>
    </div>
  `;

  const currentDomain = getCurrentDomain();

  // Request shortcuts from background script
  chrome.runtime.sendMessage({action: "getShortcuts"}, (response) => {

      // Group shortcuts as before
      const domainShortcuts = response.shortcuts.filter(s => {
        if (!s.domains || !s.domains.length) return false;
        return s.domains.some(domain => isDomainMatch(domain, currentDomain));
      });

      const generalShortcuts = response.shortcuts.filter(s =>
        !s.domains || !s.domains.length
      );

      const sortedShortcuts = [...domainShortcuts, ...generalShortcuts];

      // Create shortcuts grid - IMPORTANT: Don't include footer here
      let shortcutsHtml = '<div class="shortcut-ext-grid">';

      sortedShortcuts.forEach(shortcut => {
        const initials = getInitials(shortcut.title);
        const bgColor = getColorFromText(shortcut.title);
        const isSiteSpecific = shortcut.domains && shortcut.domains.some(domain =>
          isDomainMatch(domain, currentDomain)
        );

        shortcutsHtml += `
          <div class="shortcut-ext-item ${isSiteSpecific ? 'site-specific' : ''}" data-title="${shortcut.title}" data-url="${shortcut.url}">
            <a href="${shortcut.url}" class="shortcut-ext-link" data-url="${shortcut.url}">
              <div class="shortcut-ext-icon-wrapper" style="background-color: ${bgColor}">
                ${isSiteSpecific ? '<span class="site-badge">★</span>' : ''}
                <span class="shortcut-ext-initials">${initials}</span>
              </div>
              <div class="shortcut-ext-details">
                <span class="shortcut-ext-title">${shortcut.title}</span>
                <span class="shortcut-ext-url">${new URL(shortcut.url).pathname}</span>
              </div>
            </a>
          </div>
        `;
      });

      shortcutsHtml += '</div>';
      
      // Set shortcuts content
      shortcutsContainer.innerHTML = shortcutsHtml;


    
  });
}

// Check if shortcuts exist for this domain before injecting UI
function shouldInjectUI() {
  return new Promise(resolve => {
    const currentDomain = getCurrentDomain();
    chrome.runtime.sendMessage({action: "getShortcuts"}, (response) => {
      // Only inject if there are shortcuts (either domain-specific or general)
      if (response && response.shortcuts && response.shortcuts.length > 0) {
        const hasRelevantShortcuts = response.shortcuts.some(s => 
          !s.domains || !s.domains.length || // General shortcuts
          s.domains.some(domain => isDomainMatch(domain, currentDomain)) // Domain-specific
        );
        resolve(hasRelevantShortcuts);
      } else {
        resolve(false);
      }
    });
  });
}

function isBlacklistedDomain() {
  return new Promise(resolve => {
    const currentDomain = getCurrentDomain();
    chrome.storage.sync.get(['blacklistedDomains'], (result) => {
      const blacklist = result.blacklistedDomains || [];
      resolve(blacklist.some(domain => isDomainMatch(domain, currentDomain)));
    });
  });
}

// Initialize the panel when the page is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await isBlacklistedDomain()) && await shouldInjectUI()) {
      createShortcutPanel();
      loadShortcuts(); // Load shortcuts when the page is fully loaded
    }
  });
} else {
  Promise.all([isBlacklistedDomain(), shouldInjectUI()])
    .then(([isBlacklisted, shouldInject]) => {
      if (!isBlacklisted && shouldInject) {
        createShortcutPanel();
        loadShortcuts(); // Load shortcuts when the page is fully loaded
      }
    });
}

// Add keyboard shortcut to toggle panel (Alt+Shift+S)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'S') {
    const panel = document.getElementById('shortcut-ext-panel');
    if (panel && panel.classList.contains('shortcut-ext-expanded')) {
      panel.classList.add('shortcut-ext-collapsed');
      loadShortcuts();
    }
  }
});

// First, get premium status before creating the panel
function isPremiumUser() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['premiumStatus'], (result) => {
      resolve(result.premiumStatus && result.premiumStatus.active === true);
    });
  });
}