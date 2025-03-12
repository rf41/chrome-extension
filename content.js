/**
 * Content script for Smart Shortcut Panel extension
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
 * Check if domains match (handles subdomains, wildcards, and www prefix)
 * @param {string} targetDomain - Domain pattern to check
 * @param {string} currentDomain - Current domain
 * @returns {boolean} Whether domains match
 */
function isDomainMatch(targetDomain, currentDomain) {
  if (!targetDomain || !currentDomain) return false;

  const normalizedTarget = targetDomain.toLowerCase().replace(/^www\./, '');
  const normalizedCurrent = currentDomain.toLowerCase().replace(/^www\./, '');
  
  if (normalizedTarget === normalizedCurrent) return true;
  
  if (targetDomain.startsWith('*.')) {
    const baseDomain = targetDomain.substring(2).replace(/^www\./, '');
    return normalizedCurrent === baseDomain || normalizedCurrent.endsWith('.' + baseDomain);
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
    chrome.runtime.sendMessage({action: "getLicenseInfo"}, (response) => {
      if (response && response.success && response.data && response.data.active === true) {
        resolve(true);
      } else {
        resolve(false);
      }
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
  
  Object.keys(props).forEach(key => {
    if (key === 'className') {
      element.className = props[key];
    } else if (key === 'style') {
      Object.assign(element.style, props[key]);
    } else {
      element.setAttribute(key, props[key]);
    }
  });
  
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
  
  if (panel.getAttribute('data-recently-dragged') === 'true') {
    return;
  }
  
  if (panel.classList.contains('shortcut-ext-expanded')) {
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
    panel.classList.add('shortcut-ext-collapsed');
    
    panel.style.margin = '0';
    
    return;
  }
  
  const rect = panel.getBoundingClientRect();
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const expandedWidth = 320;
  const expandedHeight = 460;
  
  const spaceRight = viewportWidth - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = viewportHeight - rect.bottom;
  const spaceTop = rect.top;
  
  let expandDirectionClass;
  
  if (spaceRight >= expandedWidth - rect.width) {
    if (spaceBottom >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-right-down';
    }
    else if (spaceTop >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-right-up';
    }
    else {
      expandDirectionClass = 'expand-right-down';
    }
  }
  else if (spaceLeft >= expandedWidth - rect.width) {
    if (spaceBottom >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-left-down';
    }
    else if (spaceTop >= expandedHeight - rect.height) {
      expandDirectionClass = 'expand-left-up';
    }
    else {
      expandDirectionClass = 'expand-left-down';
    }
  }
  else {
    if (spaceRight >= spaceLeft) {
      expandDirectionClass = (spaceBottom >= spaceTop) ? 'expand-right-down' : 'expand-right-up';
    } else {
      expandDirectionClass = (spaceBottom >= spaceTop) ? 'expand-left-down' : 'expand-left-up';
    }
  }
  
  panel.classList.remove('expand-right-down', 'expand-left-down', 'expand-right-up', 'expand-left-up');
  
  panel.classList.remove('shortcut-ext-collapsed');
  panel.classList.add('shortcut-ext-expanded', expandDirectionClass);
  
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
  
  let leftAdjust = 0;
  let topAdjust = 0;
  
  if (rect.right > viewportWidth - 20) leftAdjust = viewportWidth - 20 - rect.right;
  if (rect.left < 20) leftAdjust = 20 - rect.left;
  if (rect.bottom > viewportHeight - 20) topAdjust = viewportHeight - 20 - rect.bottom;
  if (rect.top < 20) topAdjust = 20 - rect.top;
  if (leftAdjust !== 0 || topAdjust !== 0) {
    const currentLeft = parseInt(rect.left + leftAdjust);
    const currentTop = parseInt(rect.top + topAdjust);
    
    panel.style.left = `${currentLeft}px`;
    panel.style.top = `${currentTop}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    panel.setAttribute('data-original-left', `${currentLeft}px`);
    panel.setAttribute('data-original-top', `${currentTop}px`);
    panel.removeAttribute('data-original-right');
    panel.removeAttribute('data-original-bottom');
    
    savePosition(panel);
  }
}

/**
 * Save panel position to storage
 * @param {HTMLElement} panel - Panel element
 */
function savePosition(panel) {
  const style = window.getComputedStyle(panel);
  const rect = panel.getBoundingClientRect();
  
  let position;
  
  if (style.left !== 'auto' && style.top !== 'auto') {
    position = {
      left: style.left,
      top: style.top,
      right: 'auto',
      bottom: 'auto'
    };
    
    panel.setAttribute('data-original-left', style.left);
    panel.setAttribute('data-original-top', style.top);
    panel.removeAttribute('data-original-right');
    panel.removeAttribute('data-original-bottom');
  } 
  else {
    position = {
      right: style.right,
      bottom: style.bottom,
      left: 'auto',
      top: 'auto'
    };
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
    if (e.button !== 0) return;
    
    if (e.target !== handle && !handle.contains(e.target)) return;
    
    e.preventDefault();
    hasMoved = false;
    
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = element.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    isDragging = true;
    element.classList.add('shortcut-ext-dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
    }
    
    const rect = element.getBoundingClientRect();
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    newLeft = Math.max(20, Math.min(newLeft, viewportWidth - rect.width - 20));
    newTop = Math.max(20, Math.min(newTop, viewportHeight - rect.height - 20));
    
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }
  
  function dragEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    element.classList.remove('shortcut-ext-dragging');
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
    
    if (hasMoved) {
      const rect = element.getBoundingClientRect();
      
      element.setAttribute('data-original-left', element.style.left);
      element.setAttribute('data-original-top', element.style.top);
      element.removeAttribute('data-original-right');
      element.removeAttribute('data-original-bottom');
      
      savePosition(element);
      
      element.setAttribute('data-recently-dragged', 'true');
      
      setTimeout(() => {
        element.removeAttribute('data-recently-dragged');
      }, 300); 

      const preventClick = (e) => {
        e.stopPropagation();
        handle.removeEventListener('click', preventClick);
      };
      
      handle.addEventListener('click', preventClick);
    }
  }
  
  if (window.getComputedStyle(element).position !== 'fixed') {
    element.style.position = 'fixed';
    element.style.right = '20px';
    element.style.bottom = '20px';
  }
  
  handle.addEventListener('mousedown', dragStart);
}

/**
 * Create and insert the shortcuts panel
 */
function createShortcutPanel() {
  if (document.getElementById('shortcut-ext-panel')) return;
  
  const panel = createElement('div', {
    id: 'shortcut-ext-panel',
    className: 'shortcut-ext-panel shortcut-ext-collapsed'
  });
  
  const toggleSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  toggleSvg.setAttribute("width", "24");
  toggleSvg.setAttribute("height", "24");
  toggleSvg.setAttribute("viewBox", "0 0 24 24");
  toggleSvg.setAttribute("fill", "none");
  toggleSvg.setAttribute("stroke", "currentColor");
  toggleSvg.setAttribute("stroke-width", "2");
  toggleSvg.setAttribute("stroke-linecap", "round");
  toggleSvg.setAttribute("stroke-linejoin", "round");
  
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "2");
  rect.setAttribute("y", "4");
  rect.setAttribute("width", "20");
  rect.setAttribute("height", "16");
  rect.setAttribute("rx", "2");
  toggleSvg.appendChild(rect);
  
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
  
  const contentWrapper = createElement('div', {
    className: 'shortcut-ext-content-wrapper'
  });
  
  const header = createElement('div', {
    className: 'shortcut-ext-header'
  });
  
  const headerTitle = createElement('h3', {}, 'Smart Shortcut Panel');
  header.appendChild(headerTitle);
  
  const headerActions = createElement('div', {
    className: 'shortcut-ext-header-actions'
  });
  
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
  
  const shortcutsContainer = createElement('div', {
    id: 'shortcut-ext-shortcuts',
    className: 'shortcut-ext-shortcuts'
  });
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(searchBox);
  contentWrapper.appendChild(shortcutsContainer);
  panel.appendChild(toggleBtn);
  panel.appendChild(contentWrapper);
  
  document.body.appendChild(panel);
  
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    
    panel.style.left = 'auto';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.margin = '0'; 
    
    if (position.left && position.left !== 'auto' && position.top && position.top !== 'auto') {
      panel.style.left = position.left;
      panel.style.top = position.top;
    } else {
      panel.style.right = position.right || '20px';
      panel.style.bottom = position.bottom || '20px';
    }
  });
  
  toggleBtn.addEventListener('click', togglePanel);
  
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "openOptions"});
  });
  
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('shortcut-ext-expanded');
    panel.classList.add('shortcut-ext-collapsed');
  });
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.shortcut-ext-item');
    
    items.forEach(item => {
      const title = (item.getAttribute('data-title') || '').toLowerCase();
      const url = (item.getAttribute('data-url') || '').toLowerCase();
      item.style.display = (title.includes(query) || url.includes(query)) ? 'flex' : 'none';
    });
  });
  
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('shortcut-ext-expanded') && 
        !panel.contains(e.target)) {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    }
  }, true);
  
  chrome.storage.sync.get(['panelPosition'], (result) => {
    const position = result.panelPosition || { right: '20px', bottom: '20px' };
    
    panel.style.left = 'auto';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
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
  
  makeElementDraggable(panel, toggleBtn);
  
  isPremiumUser().then(premium => {
    if (premium) {
      const premiumBadge = createElement('span', {
        className: 'premium-badge-small'
      }, 'Premium');
      
      const headerText = header.querySelector('h3');
      if (headerText) {
        headerText.textContent = 'Smart Shortcut Panel ';
        headerText.appendChild(premiumBadge);
      }
    }
  });
  
  loadShortcuts();
}

/**
 * Load shortcuts from storage and populate the panel
 */
function loadShortcuts() {
  const container = document.getElementById('shortcut-ext-shortcuts');
  if (!container) return;
  
  container.textContent = '';
  const loadingEl = createElement('div', { className: 'shortcut-ext-loading' });
  const spinner = createElement('div', { className: 'shortcut-ext-spinner' });
  const loadingText = createElement('p', {}, 'Loading shortcuts...');
  
  loadingEl.appendChild(spinner);
  loadingEl.appendChild(loadingText);
  container.appendChild(loadingEl);
  
  const currentDomain = getCurrentDomain();
  
  chrome.runtime.sendMessage({
    action: "getShortcuts",
    origin: window.location.origin
  }, (response) => {
    if (!response || !response.shortcuts) {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'shortcut-ext-empty' }, 'No shortcuts found'));
      return;
    }
    
    const domainShortcuts = response.shortcuts.filter(s => 
      s.domains && s.domains.length && 
      s.domains.some(domain => isDomainMatch(domain, currentDomain))
    );
    
    const generalShortcuts = response.shortcuts.filter(s =>
      !s.domains || !s.domains.length
    );
    
    const shortcuts = [...domainShortcuts, ...generalShortcuts];
    
    if (shortcuts.length === 0) {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'shortcut-ext-empty' }, 'No shortcuts found for this site'));
      return;
    }
    
    container.textContent = '';
    const grid = createElement('div', { className: 'shortcut-ext-grid' });
    
    shortcuts.forEach(shortcut => {
      if (!shortcut.title || !shortcut.url) return;
      
      let urlPath = '/';
      try {
        urlPath = new URL(shortcut.url).pathname;
      } catch (e) {
        // Keep default path
      }
      
      const isSiteSpecific = shortcut.domains && shortcut.domains.some(domain => 
        isDomainMatch(domain, currentDomain)
      );
      
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
    
    container.querySelectorAll('.shortcut-ext-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (url) {
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
          !s.domains || !s.domains.length || 
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

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'S') {
    const panel = document.getElementById('shortcut-ext-panel');
    if (panel) {
      togglePanel();
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    chrome.storage.sync.get(['panelEnabled'], async (result) => {
      const consentGiven = result.panelEnabled !== false; 
      if (consentGiven && !(await isBlacklistedDomain()) && await shouldInjectUI()) {
        createShortcutPanel();
      }
    });
  });
} else {
  chrome.storage.sync.get(['panelEnabled'], async (result) => {
    const consentGiven = result.panelEnabled !== false; 
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