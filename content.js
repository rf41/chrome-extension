/**
 * Content script for Quick Site Shortcuts extension
 * Adds a floating panel to access shortcuts on websites
 */

// ===== HELPER FUNCTIONS =====

/**
 * Get the current domain
 * @returns {string} Current hostname
 */
function getCurrentDomain() {
  return window.location.hostname;
}

/**
 * Check if domains match (handles subdomains and wildcards)
 * @param {string} targetDomain - Domain pattern to check
 * @param {string} currentDomain - Current domain
 * @returns {boolean} Whether domains match
 */
function isDomainMatch(targetDomain, currentDomain) {
  if (!targetDomain || !currentDomain) return false;
  
  // Convert to lowercase for case-insensitive comparison
  const pattern = targetDomain.toLowerCase();
  const domain = currentDomain.toLowerCase();
  
  // Exact match
  if (pattern === domain) return true;
  
  // Wildcard subdomain matching
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.substring(2);
    return domain === baseDomain || domain.endsWith('.' + baseDomain);
  }
  
  return false;
}

/**
 * Generate initials from text
 * @param {string} text - Input text
 * @returns {string} 1-2 character initials
 */
function getInitials(text) {
  if (!text) return '?';
  
  const words = text.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generate a consistent color from text
 * @param {string} text - Input text
 * @returns {string} HSL color string
 */
function getColorFromText(text) {
  if (!text) return 'hsl(0, 0%, 80%)';
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

/**
 * Check if current user has premium status
 * @returns {Promise<boolean>} Premium status
 */
function isPremiumUser() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['premiumStatus'], (result) => {
      resolve(result.premiumStatus && result.premiumStatus.active === true);
    });
  });
}

// ===== UI COMPONENTS AND BEHAVIORS =====

/**
 * Toggle panel visibility with dynamic expansion direction
 */
function togglePanel() {
  const panel = document.getElementById('shortcut-ext-panel');
  if (!panel) return;
  
  if (panel.classList.contains('shortcut-ext-expanded')) {
    // Collapse panel
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
    panel.classList.add('shortcut-ext-collapsed');
    
    // Restore original position
    const originalRight = panel.getAttribute('data-original-right');
    const originalBottom = panel.getAttribute('data-original-bottom');
    const originalLeft = panel.getAttribute('data-original-left');
    const originalTop = panel.getAttribute('data-original-top');
    
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
  
  // Determine expansion direction based on available space
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const expandedWidth = 320;  // Fixed width value
  const expandedHeight = 460; // Fixed height value
  
  // Calculate available space in each direction
  const spaceRight = viewportWidth - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = viewportHeight - rect.bottom;
  
  // Choose the best expansion direction
  let expandDirectionClass;
  if (spaceRight >= expandedWidth) {
    expandDirectionClass = spaceBottom >= expandedHeight ? 'expand-right-down' : 'expand-right-up';
  } else if (spaceLeft >= expandedWidth) {
    expandDirectionClass = spaceBottom >= expandedHeight ? 'expand-left-down' : 'expand-left-up';
  } else {
    expandDirectionClass = (spaceRight >= spaceLeft) ? 
      (spaceBottom >= expandedHeight ? 'expand-right-down' : 'expand-right-up') : 
      (spaceBottom >= expandedHeight ? 'expand-left-down' : 'expand-left-up');
  }
  
  // Apply expansion classes
  panel.classList.remove('shortcut-ext-collapsed');
  panel.classList.add('shortcut-ext-expanded', expandDirectionClass);
  
  // Adjust panel position after expansion
  setTimeout(() => {
    ensurePanelInViewport(panel);
    loadShortcuts();
  }, 100);
}

/**
 * Ensure panel stays within viewport boundaries
 * @param {HTMLElement} panel - Panel element to adjust
 */
function ensurePanelInViewport(panel) {
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate necessary adjustments
  let leftAdjust = 0;
  let topAdjust = 0;
  
  if (rect.right > viewportWidth - 20) leftAdjust = viewportWidth - 20 - rect.right;
  if (rect.left < 20) leftAdjust = 20 - rect.left;
  if (rect.bottom > viewportHeight - 20) topAdjust = viewportHeight - 20 - rect.bottom;
  if (rect.top < 20) topAdjust = 20 - rect.top;
  
  // Apply adjustments if needed
  if (leftAdjust !== 0 || topAdjust !== 0) {
    // Get current position
    const style = window.getComputedStyle(panel);
    let left = rect.left;
    let top = rect.top;
    
    // Update position
    panel.style.left = `${left + leftAdjust}px`;
    panel.style.top = `${top + topAdjust}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    // Save new position
    savePosition(panel);
  }
}

/**
 * Save panel position to storage
 * @param {HTMLElement} panel - Panel element
 */
function savePosition(panel) {
  const position = {
    top: panel.style.top,
    left: panel.style.left,
    right: panel.style.right,
    bottom: panel.style.bottom
  };
  
  chrome.storage.sync.set({ 'panelPosition': position });
}

/**
 * Make an element draggable
 * @param {HTMLElement} element - Element to make draggable
 * @param {HTMLElement} handle - Drag handle element
 */
function makeElementDraggable(element, handle) {
  let startX, startY, startLeft, startTop;
  let isDragging = false;
  let hasMoved = false;
  
  function dragStart(e) {
    // Only handle primary mouse button
    if (e.button !== 0) return;
    
    // Only allow dragging from handle
    if (e.target !== handle && !handle.contains(e.target)) return;
    
    e.preventDefault();
    hasMoved = false;
    
    // Store initial positions
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = element.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    isDragging = true;
    element.classList.add('shortcut-ext-dragging');
    
    // Add temporary global listeners
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // Consider real movement after 3px threshold
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
    }
    
    // Calculate new position with boundaries
    const rect = element.getBoundingClientRect();
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    
    // Keep within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    newLeft = Math.max(20, Math.min(newLeft, viewportWidth - rect.width - 20));
    newTop = Math.max(20, Math.min(newTop, viewportHeight - rect.height - 20));
    
    // Apply position
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }
  
  function dragEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    element.classList.remove('shortcut-ext-dragging');
    
    // Remove temporary listeners
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
    
    if (hasMoved) {
      // Update data attributes
      element.setAttribute('data-original-left', element.style.left);
      element.setAttribute('data-original-top', element.style.top);
      element.removeAttribute('data-original-right');
      element.removeAttribute('data-original-bottom');
      
      // Save position
      savePosition(element);
      
      // Prevent accidental click after drag
      const preventClick = (e) => {
        e.stopPropagation();
        handle.removeEventListener('click', preventClick);
      };
      
      handle.addEventListener('click', preventClick);
    }
  }
  
  // Initialize position if needed
  if (window.getComputedStyle(element).position !== 'fixed') {
    element.style.position = 'fixed';
    element.style.right = '20px';
    element.style.bottom = '20px';
  }
  
  // Add drag start listener
  handle.addEventListener('mousedown', dragStart);
}

/**
 * Create and insert the shortcuts panel
 */
function createShortcutPanel() {
  // Check if panel already exists
  if (document.getElementById('shortcut-ext-panel')) return;
  
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'shortcut-ext-panel';
  panel.className = 'shortcut-ext-panel shortcut-ext-collapsed';
  
  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'shortcut-ext-toggle';
  toggleBtn.className = 'shortcut-ext-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle shortcuts panel');
  toggleBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
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
  
  // Create content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'shortcut-ext-content-wrapper';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'shortcut-ext-header';
  header.innerHTML = `
    <h3>Shortcuts for this site</h3>
    <div class="shortcut-ext-header-actions">
      <button id="shortcut-ext-settings" class="shortcut-ext-button" aria-label="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <button id="shortcut-ext-close" class="shortcut-ext-close" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;
  
  // Create search box
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
  
  // Create shortcuts container
  const shortcutsContainer = document.createElement('div');
  shortcutsContainer.id = 'shortcut-ext-shortcuts';
  shortcutsContainer.className = 'shortcut-ext-shortcuts';
  
  // Assemble panel
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(searchBox);
  contentWrapper.appendChild(shortcutsContainer);
  panel.appendChild(toggleBtn);
  panel.appendChild(contentWrapper);
  
  // Add to page
  document.body.appendChild(panel);
  
  // Add event listeners
  toggleBtn.addEventListener('click', togglePanel);
  
  // Settings button
  const settingsBtn = document.getElementById('shortcut-ext-settings');
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "openOptions"});
  });
  
  // Close button
  const closeBtn = document.getElementById('shortcut-ext-close');
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.add('shortcut-ext-collapsed');
  });
  
  // Search functionality
  const searchInput = document.getElementById('shortcut-ext-search-input');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.shortcut-ext-item');
    
    items.forEach(item => {
      const title = (item.getAttribute('data-title') || '').toLowerCase();
      const url = (item.getAttribute('data-url') || '').toLowerCase();
      item.style.display = (title.includes(query) || url.includes(query)) ? 'flex' : 'none';
    });
  });
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('shortcut-ext-expanded') && 
        !panel.contains(e.target)) {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    }
  });
  
  // Set position from storage
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    Object.keys(position).forEach(key => {
      if (position[key] !== 'auto') {
        panel.style[key] = position[key];
        if (['top', 'bottom', 'left', 'right'].includes(key)) {
          panel.setAttribute('data-original-' + key, position[key]);
        }
      }
    });
  });
  
  // Make panel draggable
  makeElementDraggable(panel, toggleBtn);
  
  // Check premium status and add badge if premium
  isPremiumUser().then(premium => {
    if (premium) {
      const headerText = header.querySelector('h3');
      if (headerText) {
        headerText.innerHTML = `Shortcuts for this site <span class="premium-badge-small">PRO</span>`;
      }
    }
  });
  
  // Initial load of shortcuts
  loadShortcuts();
}

/**
 * Load shortcuts from storage and populate the panel
 */
function loadShortcuts() {
  const container = document.getElementById('shortcut-ext-shortcuts');
  if (!container) return;
  
  // Show loading
  container.innerHTML = `
    <div class="shortcut-ext-loading">
      <div class="shortcut-ext-spinner"></div>
      <p>Loading shortcuts...</p>
    </div>
  `;
  
  const currentDomain = getCurrentDomain();
  
  // Request shortcuts from background
  chrome.runtime.sendMessage({action: "getShortcuts"}, (response) => {
    if (!response || !response.shortcuts) {
      container.innerHTML = '<p class="shortcut-ext-empty">No shortcuts found</p>';
      return;
    }
    
    // Filter shortcuts for current domain
    const domainShortcuts = response.shortcuts.filter(s => 
      s.domains && s.domains.length && 
      s.domains.some(domain => isDomainMatch(domain, currentDomain))
    );
    
    // Get domain-agnostic shortcuts
    const generalShortcuts = response.shortcuts.filter(s =>
      !s.domains || !s.domains.length
    );
    
    // Combine with domain-specific first
    const shortcuts = [...domainShortcuts, ...generalShortcuts];
    
    if (shortcuts.length === 0) {
      container.innerHTML = '<p class="shortcut-ext-empty">No shortcuts found for this site</p>';
      return;
    }
    
    // Build HTML safely
    let html = '<div class="shortcut-ext-grid">';
    shortcuts.forEach(shortcut => {
      if (!shortcut.title || !shortcut.url) return;
      
      // Safely encode values
      const title = escapeHTML(shortcut.title);
      const url = escapeHTML(shortcut.url);
      const initials = getInitials(shortcut.title);
      const bgColor = getColorFromText(shortcut.title);
      const isSiteSpecific = shortcut.domains && shortcut.domains.some(domain => 
        isDomainMatch(domain, currentDomain)
      );
      
      let urlPath = '';
      try {
        urlPath = escapeHTML(new URL(shortcut.url).pathname);
      } catch (e) {
        urlPath = '/';
      }
      
      html += `
        <div class="shortcut-ext-item${isSiteSpecific ? ' site-specific' : ''}" data-title="${title}" data-url="${url}">
          <a href="${url}" class="shortcut-ext-link">
            <div class="shortcut-ext-icon-wrapper" style="background-color: ${bgColor}">
              ${isSiteSpecific ? '<span class="site-badge">★</span>' : ''}
              <span class="shortcut-ext-initials">${initials}</span>
            </div>
            <div class="shortcut-ext-details">
              <span class="shortcut-ext-title">${title}</span>
              <span class="shortcut-ext-url">${urlPath}</span>
            </div>
          </a>
        </div>
      `;
    });
    html += '</div>';
    
    // Update container
    container.innerHTML = html;
    
    // Add click handlers for shortcuts
    container.querySelectorAll('.shortcut-ext-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (url) {
          // Validate URL before opening
          chrome.runtime.sendMessage({action: "validateUrl", url}, (response) => {
            if (response && response.isValid) {
              window.location.href = url;
            }
          });
        }
      });
    });
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (match) => {
    const replacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return replacements[match];
  });
}

/**
 * Check if shortcuts exist for this domain
 * @returns {Promise<boolean>} Whether to inject UI
 */
function shouldInjectUI() {
  return new Promise(resolve => {
    const currentDomain = getCurrentDomain();
    chrome.runtime.sendMessage({action: "getShortcuts"}, (response) => {
      if (response && response.shortcuts && response.shortcuts.length > 0) {
        const hasRelevantShortcuts = response.shortcuts.some(s => 
          !s.domains || !s.domains.length || // General shortcuts
          s.domains.some(domain => isDomainMatch(domain, currentDomain))
        );
        resolve(hasRelevantShortcuts);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Check if current domain is blacklisted
 * @returns {Promise<boolean>} Whether domain is blacklisted
 */
function isBlacklistedDomain() {
  return new Promise(resolve => {
    const currentDomain = getCurrentDomain();
    chrome.storage.sync.get(['blacklistedDomains'], (result) => {
      const blacklist = result.blacklistedDomains || [];
      resolve(blacklist.some(domain => isDomainMatch(domain, currentDomain)));
    });
  });
}

// ===== INITIALIZATION =====

// Setup keyboard shortcut handler (just once!)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'S') {
    const panel = document.getElementById('shortcut-ext-panel');
    if (panel) {
      togglePanel();
    }
  }
});

// Initialize panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await isBlacklistedDomain()) && await shouldInjectUI()) {
      createShortcutPanel();
    }
  });
} else {
  // If DOM already loaded
  Promise.all([isBlacklistedDomain(), shouldInjectUI()])
    .then(([isBlacklisted, shouldInject]) => {
      if (!isBlacklisted && shouldInject) {
        createShortcutPanel();
      }
    });
}