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

// Create the shortcuts panel
function createShortcutPanel() {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'shortcut-ext-panel';
  panel.className = 'shortcut-ext-panel shortcut-ext-collapsed';

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
    <h3>Your Shortcuts</h3>
    <button id="shortcut-ext-close" class="shortcut-ext-close" title="Close Panel">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

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
  panel.appendChild(panelHeader);
  panel.appendChild(searchBox);
  panel.appendChild(shortcutsContainer);

  // Add panel to the page
  document.body.appendChild(panel);

  // Add toggle functionality
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('shortcut-ext-collapsed');
    panel.classList.toggle('shortcut-ext-expanded');

    // Load shortcuts when panel is expanded
    if (panel.classList.contains('shortcut-ext-expanded')) {
      loadShortcuts();
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

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && panel.classList.contains('shortcut-ext-expanded')) {
      panel.classList.remove('shortcut-ext-expanded');
      panel.classList.add('shortcut-ext-collapsed');
    }
  });
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
    if (response && response.shortcuts && response.shortcuts.length > 0) {
      // Filter shortcuts by domain if applicable
      const allShortcuts = response.shortcuts;

      // Group shortcuts: domain-specific first, then general shortcuts
      const domainShortcuts = allShortcuts.filter(s => {
        if (!s.domains || !s.domains.length) return false;
        return s.domains.some(domain => isDomainMatch(domain, currentDomain));
      });

      const generalShortcuts = allShortcuts.filter(s =>
        !s.domains || !s.domains.length
      );

      // Combine shortcuts with domain-specific ones first
      const sortedShortcuts = [...domainShortcuts, ...generalShortcuts];

      // Create shortcuts grid
      let shortcutsHtml = '<div class="shortcut-ext-grid">';

      //if (domainShortcuts.length > 0) {
        //shortcutsHtml += `<div class="shortcut-ext-section">
          //<h4>For ${currentDomain}</h4>
        //</div>`;
      //}

      // Replace response.shortcuts with sortedShortcuts to fix the issue
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
      shortcutsHtml += '<div class="shortcut-ext-footer">';
      shortcutsHtml += '<button id="shortcut-ext-options" class="shortcut-ext-option-btn">Manage Shortcuts</button>';
      shortcutsHtml += '</div>';

      shortcutsContainer.innerHTML = shortcutsHtml;

      // Add click handler for links
      document.querySelectorAll('.shortcut-ext-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const url = e.currentTarget.getAttribute('data-url');
          window.location.href = url;
        });
      });

      // Add click handler for options button
      document.getElementById('shortcut-ext-options').addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "openOptions"});
      });
    } else {
      shortcutsContainer.innerHTML = `
        <div class="shortcut-ext-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
          <p>No shortcuts configured yet.</p>
          <div class="shortcut-ext-footer">
            <button id="shortcut-ext-options" class="shortcut-ext-option-btn">Add Shortcuts</button>
          </div>
        </div>
      `;

      // Add click handler for options button
      document.getElementById('shortcut-ext-options').addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "openOptions"});
      });
    }
  });
}

// Initialize the panel when the page is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createShortcutPanel);
} else {
  createShortcutPanel();
}

// Add keyboard shortcut to toggle panel (Alt+Shift+S)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'S') {
    const panel = document.getElementById('shortcut-ext-panel');
    if (panel) {
      panel.classList.toggle('shortcut-ext-collapsed');
      panel.classList.toggle('shortcut-ext-expanded');

      // Load shortcuts when panel is expanded
      if (panel.classList.contains('shortcut-ext-expanded')) {
        loadShortcuts();
      }
    }
  }
});