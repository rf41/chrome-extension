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

/**
 * Safely create HTML element with properties
 * @param {string} tag - HTML tag name
 * @param {Object} props - Properties to set
 * @param {string|Array} children - Child content or elements
 * @returns {HTMLElement} Created element
 */
function createElement(tag, props = {}, children = null) {
  const element = document.createElement(tag);
  
  // Set properties safely
  Object.keys(props).forEach(key => {
    if (key === 'className') {
      element.className = props[key];
    } else if (key === 'style') {
      Object.assign(element.style, props[key]);
    } else {
      element.setAttribute(key, props[key]);
    }
  });
  
  // Add children
  if (children) {
    if (Array.isArray(children)) {
      children.forEach(child => {
        if (child instanceof HTMLElement) {
          element.appendChild(child);
        } else if (child) {
          element.appendChild(document.createTextNode(child));
        }
      });
    } else if (typeof children === 'string') {
      element.textContent = children;
    }
  }
  
  return element;
}

// ===== UI COMPONENTS AND BEHAVIORS =====

/**
 * Toggle panel visibility with dynamic expansion direction
 */
function togglePanel() {
  const panel = document.getElementById('shortcut-ext-panel');
  if (!panel) return;
  
  if (panel.classList.contains('shortcut-ext-expanded')) {
    // Collapse panel - restore original size
    panel.classList.remove('shortcut-ext-expanded');
    // Important: Remove ALL expansion direction classes when collapsing
    panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
    panel.classList.add('shortcut-ext-collapsed');
    
    // Clear any expansion-related margins that might have been applied
    panel.style.margin = '0';
    
    return;
  }
  
  // When expanding, we need to determine the best expansion direction
  // based on the panel's CURRENT position, not saved position
  const rect = panel.getBoundingClientRect();
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const expandedWidth = 320;  // Fixed width value
  const expandedHeight = 460; // Fixed height value
  
  // Calculate available space in each direction from the panel's current position
  const spaceRight = viewportWidth - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = viewportHeight - rect.bottom;
  const spaceTop = rect.top;
  
  // Choose the best expansion direction based on available space
  let expandDirectionClass;
  
  // First check if we have room to expand to the right
  if (spaceRight >= expandedWidth - rect.width) {
    // If we have room below, expand right-down
    if (spaceBottom >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-right-down';
    }
    // Otherwise if we have room above, expand right-up
    else if (spaceTop >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-right-up';
    }
    // If neither, still try right-down as default
    else {
      expandDirectionClass = 'expand-right-down';
    }
  }
  // If not enough room to the right, check if we have room to expand to the left
  else if (spaceLeft >= expandedWidth - rect.width) {
    // If we have room below, expand left-down
    if (spaceBottom >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-left-down';
    }
    // Otherwise if we have room above, expand left-up
    else if (spaceTop >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-left-up';
    }
    // If neither, try left-down as default
    else {
      expandDirectionClass = 'expand-left-down';
    }
  }
  // If neither side has enough room, choose the side with more space
  else {
    if (spaceRight >= spaceLeft) {
      expandDirectionClass = (spaceBottom >= spaceTop) ? 'expand-right-down' : 'expand-right-up';
    } else {
      expandDirectionClass = (spaceBottom >= spaceTop) ? 'expand-left-down' : 'expand-left-up';
    }
  }
  
  // Remove any existing expansion classes to ensure clean state
  panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
  
  // Apply expansion classes
  panel.classList.remove('shortcut-ext-collapsed');
  panel.classList.add('shortcut-ext-expanded', expandDirectionClass);
  
  // Ensure the panel is fully visible after expansion
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
    const currentLeft = parseInt(rect.left + leftAdjust);
    const currentTop = parseInt(rect.top + topAdjust);
    
    // Update position with absolute values
    panel.style.left = `${currentLeft}px`;
    panel.style.top = `${currentTop}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    // Update the data attributes to match the new position
    panel.setAttribute('data-original-left', `${currentLeft}px`);
    panel.setAttribute('data-original-top', `${currentTop}px`);
    panel.removeAttribute('data-original-right');
    panel.removeAttribute('data-original-bottom');
    
    // Save new position
    savePosition(panel);
  }
}

/**
 * Save panel position to storage
 * @param {HTMLElement} panel - Panel element
 */
function savePosition(panel) {
  // Get computed position to ensure we have the most accurate values
  const style = window.getComputedStyle(panel);
  const rect = panel.getBoundingClientRect();
  
  // Determine which position values to use
  let position;
  
  // If left/top are defined and not 'auto', use those (prioritize)
  if (style.left !== 'auto' && style.top !== 'auto') {
    position = {
      left: style.left,
      top: style.top,
      right: 'auto',
      bottom: 'auto'
    };
    
    // Update data attributes to stay in sync
    panel.setAttribute('data-original-left', style.left);
    panel.setAttribute('data-original-top', style.top);
    panel.removeAttribute('data-original-right');
    panel.removeAttribute('data-original-bottom');
  } 
  // Otherwise use right/bottom
  else {
    position = {
      right: style.right,
      bottom: style.bottom,
      left: 'auto',
      top: 'auto'
    };
    
    // Update data attributes to stay in sync
    panel.setAttribute('data-original-right', style.right);
    panel.setAttribute('data-original-bottom', style.bottom);
    panel.removeAttribute('data-original-left');
    panel.removeAttribute('data-original-top');
  }
  
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
      // Always use left/top for positioning after drag
      const rect = element.getBoundingClientRect();
      
      // Update data attributes with current position
      element.setAttribute('data-original-left', element.style.left);
      element.setAttribute('data-original-top', element.style.top);
      element.removeAttribute('data-original-right');
      element.removeAttribute('data-original-bottom');
      
      // Save the new position to storage
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
  const panel = createElement('div', {
    id: 'shortcut-ext-panel',
    className: 'shortcut-ext-panel shortcut-ext-collapsed'
  });
  
  // Create toggle button
  const toggleSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  toggleSvg.setAttribute("width", "24");
  toggleSvg.setAttribute("height", "24");
  toggleSvg.setAttribute("viewBox", "0 0 24 24");
  toggleSvg.setAttribute("fill", "none");
  toggleSvg.setAttribute("stroke", "currentColor");
  toggleSvg.setAttribute("stroke-width", "2");
  toggleSvg.setAttribute("stroke-linecap", "round");
  toggleSvg.setAttribute("stroke-linejoin", "round");
  
  // Create rect element
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "2");
  rect.setAttribute("y", "4");
  rect.setAttribute("width", "20");
  rect.setAttribute("height", "16");
  rect.setAttribute("rx", "2");
  toggleSvg.appendChild(rect);
  
  // Add paths for toggle button icon
  const paths = [
    ["M6 8h.01"], ["M10 8h.01"], ["M14 8h.01"], ["M18 8h.01"],
    ["M8 12h.01"], ["M12 12h.01"], ["M16 12h.01"], ["M7 16h10"]
  ];
  
  paths.forEach(d => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d[0]);
    toggleSvg.appendChild(path);
  });
  
  const toggleBtn = createElement('button', {
    id: 'shortcut-ext-toggle',
    className: 'shortcut-ext-toggle',
    'aria-label': 'Toggle shortcuts panel'
  });
  toggleBtn.appendChild(toggleSvg);
  
  // Create content wrapper
  const contentWrapper = createElement('div', {
    className: 'shortcut-ext-content-wrapper'
  });
  
  // Create header
  const header = createElement('div', {
    className: 'shortcut-ext-header'
  });
  
  const headerTitle = createElement('h3', {}, 'Shortcuts for this site');
  header.appendChild(headerTitle);
  
  const headerActions = createElement('div', {
    className: 'shortcut-ext-header-actions'
  });
  
  // Settings button with SVG
  const settingsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  settingsSvg.setAttribute("width", "18");
  settingsSvg.setAttribute("height", "18");
  settingsSvg.setAttribute("viewBox", "0 0 24 24");
  settingsSvg.setAttribute("fill", "none");
  settingsSvg.setAttribute("stroke", "currentColor");
  settingsSvg.setAttribute("stroke-width", "2");
  settingsSvg.setAttribute("stroke-linecap", "round");
  settingsSvg.setAttribute("stroke-linejoin", "round");
  
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "3");
  settingsSvg.appendChild(circle);
  
  const settingsPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  settingsPath.setAttribute("d", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z");
  settingsSvg.appendChild(settingsPath);
  
  const settingsBtn = createElement('button', {
    id: 'shortcut-ext-settings',
    className: 'shortcut-ext-button',
    'aria-label': 'Settings'
  });
  settingsBtn.appendChild(settingsSvg);
  headerActions.appendChild(settingsBtn);
  
  // Close button with SVG
  const closeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  closeSvg.setAttribute("width", "20");
  closeSvg.setAttribute("height", "20");
  closeSvg.setAttribute("viewBox", "0 0 24 24");
  closeSvg.setAttribute("fill", "none");
  closeSvg.setAttribute("stroke", "currentColor");
  closeSvg.setAttribute("stroke-width", "2");
  closeSvg.setAttribute("stroke-linecap", "round");
  closeSvg.setAttribute("stroke-linejoin", "round");
  
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "18");
  line1.setAttribute("y1", "6");
  line1.setAttribute("x2", "6");
  line1.setAttribute("y2", "18");
  closeSvg.appendChild(line1);
  
  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "6");
  line2.setAttribute("y1", "6");
  line2.setAttribute("x2", "18");
  line2.setAttribute("y2", "18");
  closeSvg.appendChild(line2);
  
  const closeBtn = createElement('button', {
    id: 'shortcut-ext-close',
    className: 'shortcut-ext-close',
    'aria-label': 'Close'
  });
  closeBtn.appendChild(closeSvg);
  headerActions.appendChild(closeBtn);
  header.appendChild(headerActions);
  
  // Create search box
  const searchBox = createElement('div', {
    className: 'shortcut-ext-search'
  });
  
  const searchContainer = createElement('div', {
    className: 'shortcut-ext-search-container'
  });
  
  const searchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  searchSvg.setAttribute("class", "shortcut-ext-search-icon");
  searchSvg.setAttribute("width", "16");
  searchSvg.setAttribute("height", "16");
  searchSvg.setAttribute("viewBox", "0 0 24 24");
  searchSvg.setAttribute("fill", "none");
  searchSvg.setAttribute("stroke", "currentColor");
  searchSvg.setAttribute("stroke-width", "2");
  searchSvg.setAttribute("stroke-linecap", "round");
  searchSvg.setAttribute("stroke-linejoin", "round");
  
  const searchCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  searchCircle.setAttribute("cx", "11");
  searchCircle.setAttribute("cy", "11");
  searchCircle.setAttribute("r", "8");
  searchSvg.appendChild(searchCircle);
  
  const searchLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  searchLine.setAttribute("x1", "21");
  searchLine.setAttribute("y1", "21");
  searchLine.setAttribute("x2", "16.65");
  searchLine.setAttribute("y2", "16.65");
  searchSvg.appendChild(searchLine);
  
  searchContainer.appendChild(searchSvg);
  
  const searchInput = createElement('input', {
    type: 'text',
    id: 'shortcut-ext-search-input',
    placeholder: 'Search shortcuts...'
  });
  searchContainer.appendChild(searchInput);
  searchBox.appendChild(searchContainer);
  
  // Create shortcuts container
  const shortcutsContainer = createElement('div', {
    id: 'shortcut-ext-shortcuts',
    className: 'shortcut-ext-shortcuts'
  });
  
  // Assemble panel
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(searchBox);
  contentWrapper.appendChild(shortcutsContainer);
  panel.appendChild(toggleBtn);
  panel.appendChild(contentWrapper);
  
  // Add to page
  document.body.appendChild(panel);
  
  // Set position from storage
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    
    // Reset all position properties first
    panel.style.left = 'auto';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.margin = '0';  // Ensure no margins are applied
    
    // Apply stored position - prioritize left/top positioning
    if (position.left && position.left !== 'auto' && position.top && position.top !== 'auto') {
      panel.style.left = position.left;
      panel.style.top = position.top;
    } else {
      panel.style.right = position.right || '20px';
      panel.style.bottom = position.bottom || '20px';
    }
  });
  
  // Add event listeners
  toggleBtn.addEventListener('click', togglePanel);
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "openOptions"});
  });
  
  // Close button
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.add('shortcut-ext-collapsed');
  });
  
  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.shortcut-ext-item');
    
    items.forEach(item => {
      const title = (item.getAttribute('data-title') || '').toLowerCase();
      const url = (item.getAttribute('data-url') || '').toLowerCase();
      item.style.display = (title.includes(query) || url.includes(query)) ? 'flex' : 'none';
    });
  });
  
  // Click outside to close - use event capturing to prevent closing when clicking inside
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('shortcut-ext-expanded') && 
        !panel.contains(e.target)) {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    }
  }, true);
  
  // Set position from storage
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    
    // Reset all position properties first
    panel.style.left = 'auto';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    // Apply stored position
    if (position.left !== 'auto' && position.top !== 'auto') {
      panel.style.left = position.left;
      panel.style.top = position.top;
      panel.setAttribute('data-original-left', position.left);
      panel.setAttribute('data-original-top', position.top);
    } else {
      panel.style.right = position.right || '20px';
      panel.style.bottom = position.bottom || '20px';
      panel.setAttribute('data-original-right', position.right || '20px');
      panel.setAttribute('data-original-bottom', position.bottom || '20px');
    }
  });
  
  // Make panel draggable
  makeElementDraggable(panel, toggleBtn);
  
  // Check premium status and add badge if premium
  isPremiumUser().then(premium => {
    if (premium) {
      const premiumBadge = createElement('span', {
        className: 'premium-badge-small'
      }, 'PRO');
      
      const headerText = header.querySelector('h3');
      if (headerText) {
        headerText.textContent = 'Shortcuts for this site ';
        headerText.appendChild(premiumBadge);
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
  container.textContent = '';
  const loadingEl = createElement('div', { className: 'shortcut-ext-loading' });
  const spinner = createElement('div', { className: 'shortcut-ext-spinner' });
  const loadingText = createElement('p', {}, 'Loading shortcuts...');
  
  loadingEl.appendChild(spinner);
  loadingEl.appendChild(loadingText);
  container.appendChild(loadingEl);
  
  const currentDomain = getCurrentDomain();
  
  // Request shortcuts from background with origin validation
  chrome.runtime.sendMessage({
    action: "getShortcuts",
    origin: window.location.origin
  }, (response) => {
    if (!response || !response.shortcuts) {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'shortcut-ext-empty' }, 'No shortcuts found'));
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
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'shortcut-ext-empty' }, 'No shortcuts found for this site'));
      return;
    }
    
    // Clear container
    container.textContent = '';
    const grid = createElement('div', { className: 'shortcut-ext-grid' });
    
    // Build elements safely
    shortcuts.forEach(shortcut => {
      if (!shortcut.title || !shortcut.url) return;
      
      // Safely create URL path
      let urlPath = '/';
      try {
        urlPath = new URL(shortcut.url).pathname;
      } catch (e) {
        // Keep default path
      }
      
      const isSiteSpecific = shortcut.domains && shortcut.domains.some(domain => 
        isDomainMatch(domain, currentDomain)
      );
      
      // Create item element
      const item = createElement('div', {
        className: `shortcut-ext-item${isSiteSpecific ? ' site-specific' : ''}`,
        'data-title': shortcut.title,
        'data-url': shortcut.url
      });
      
      const link = createElement('a', {
        className: 'shortcut-ext-link',
        href: shortcut.url
      });
      
      const iconWrapper = createElement('div', {
        className: 'shortcut-ext-icon-wrapper',
        style: {
          backgroundColor: getColorFromText(shortcut.title)
        }
      });
      
      if (isSiteSpecific) {
        iconWrapper.appendChild(createElement('span', { className: 'site-badge' }, '★'));
      }
      
      iconWrapper.appendChild(createElement('span', { className: 'shortcut-ext-initials' }, getInitials(shortcut.title)));
      link.appendChild(iconWrapper);
      
      const details = createElement('div', { className: 'shortcut-ext-details' });
      details.appendChild(createElement('span', { className: 'shortcut-ext-title' }, shortcut.title));
      details.appendChild(createElement('span', { className: 'shortcut-ext-url' }, urlPath));
      
      link.appendChild(details);
      item.appendChild(link);
      grid.appendChild(item);
    });
    
    container.appendChild(grid);
    
    // Add click handlers for shortcuts
    container.querySelectorAll('.shortcut-ext-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (url) {
          // Validate URL before opening
          chrome.runtime.sendMessage({
            action: "validateUrl", 
            url,
            origin: window.location.origin
          }, (response) => {
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
    chrome.runtime.sendMessage({
      action: "getShortcuts",
      origin: window.location.origin
    }, (response) => {
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

// Initialize with user consent via chrome.storage flag
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    // Check user consent first
    chrome.storage.sync.get(['panelEnabled'], async (result) => {
      const consentGiven = result.panelEnabled !== false; // Default to true if not set
      if (consentGiven && !(await isBlacklistedDomain()) && await shouldInjectUI()) {
        createShortcutPanel();
      }
    });
  });
} else {
  // If DOM already loaded
  chrome.storage.sync.get(['panelEnabled'], async (result) => {
    const consentGiven = result.panelEnabled !== false; // Default to true if not set
    if (consentGiven) {
      Promise.all([isBlacklistedDomain(), shouldInjectUI()])
        .then(([isBlacklisted, shouldInject]) => {
          if (!isBlacklisted && shouldInject) {
            createShortcutPanel();
          }
        });
    }
  });
}