/**
 * Popup script for the Custom Shortcut Extension
 * Handles the options button click and displays extension information
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

/**
 * Initialize popup functionality
 */
function initializePopup() {
  setupOptionsButton();
  displayExtensionInfo();
  displayUserStats();
}

/**
 * Set up options button click handler
 */
function setupOptionsButton() {
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  } else {
    console.warn('Options button element not found in popup');
  }
}

/**
 * Display extension name and version information
 */
function displayExtensionInfo() {
  const versionDiv = document.querySelector('.version-info');
  
  if (versionDiv) {
    chrome.management.getSelf(info => {
      try {
        if (info && info.name && info.version) {
          versionDiv.textContent = `${info.name} v${info.version}`;
        } else {
          versionDiv.textContent = 'Extension info unavailable';
        }
      } catch (error) {
        console.error('Error displaying extension info:', error);
        versionDiv.textContent = 'Extension info error';
      }
    });
  }
}

/**
 * Display user statistics including membership status, shortcuts and domains
 */
function displayUserStats() {
  // Get elements
  const memberStatusEl = document.getElementById('memberStatus');
  const totalShortcutsEl = document.getElementById('totalShortcuts');
  const totalDomainsEl = document.getElementById('totalDomains');
  
  // Set default values
  memberStatusEl.textContent = 'Free';
  totalShortcutsEl.textContent = '0';
  totalDomainsEl.textContent = '0';
  
  // Check license status first using the license API
  checkLicenseStatus()
    .then(licenseInfo => {
      console.log("License check result:", licenseInfo);
      
      // Update UI based on license status
      if (licenseInfo.isActive) {
        memberStatusEl.textContent = 'Premium'; // Keep star symbol
        memberStatusEl.classList.add('premium-badge');
      }
    })
    .catch(error => {
      console.error("License check failed:", error);
      // Continue with other checks even if this fails
    })
    .finally(() => {
      // Continue with shortcuts and other storage checks
      loadShortcutsAndDomains();
    });
  
  // Function to check license status
  function checkLicenseStatus() {
    return new Promise((resolve, reject) => {
      // First check for premiumStatus object - this is the source of truth
      chrome.storage.sync.get(['premiumStatus'], (syncData) => {
        // If we have premiumStatus in storage and it's active, use that
        if (syncData.premiumStatus && syncData.premiumStatus.active === true) {
          resolve({ isActive: true, source: 'premium-status' });
          return;
        }
        
        // Fall back to checking license data
        chrome.storage.sync.get(['license', 'licenseKey'], (licenseData) => {
          // If we have license data in storage, use that
          if (licenseData.license && licenseData.license.status === 'active') {
            resolve({ isActive: true, source: 'sync-storage' });
            return;
          }
          
          // If we have a license key but no license data, check with the API
          if (licenseData.licenseKey) {
            chrome.runtime.sendMessage({
              action: "licenseApiRequest",
              endpoint: "/wp-json/wc/v3/products/licenses/",
              licenseKey: licenseData.licenseKey
            }, response => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              if (response && response.data) {
                // Check if the license is active
                const license = response.data;
                const isActive = license.status === 'active';
                resolve({ isActive, source: 'api', license });
              } else if (response && response.error) {
                reject(new Error(response.error));
              } else {
                resolve({ isActive: false, source: 'api-no-data' });
              }
            });
            return;
          }
          
          // Also check local storage
          chrome.storage.local.get(['license', 'licenseKey'], (localData) => {
            if (localData.license && localData.license.status === 'active') {
              resolve({ isActive: true, source: 'local-storage' });
              return;
            }
            
            // If we have a license key in local but no license data, check with the API
            if (localData.licenseKey) {
              chrome.runtime.sendMessage({
                action: "licenseApiRequest",
                endpoint: "/wp-json/wc/v3/products/licenses/",
                licenseKey: localData.licenseKey
              }, response => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                
                if (response && response.data) {
                  // Check if the license is active
                  const license = response.data;
                  const isActive = license.status === 'active';
                  resolve({ isActive, source: 'api-local', license });
                } else if (response && response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve({ isActive: false, source: 'api-local-no-data' });
                }
              });
              return;
            }
            
            // If we don't have any license data, check for premium status in userData
            chrome.storage.sync.get(['userData'], (userData) => {
              if (userData.userData && userData.userData.premium === true) {
                resolve({ isActive: true, source: 'userData' });
              } else {
                // No license data found anywhere
                resolve({ isActive: false, source: 'no-data' });
              }
            });
          });
        });
      });
    });
  }
  
  // Function to load shortcuts and domains
  function loadShortcutsAndDomains() {
    // Request shortcuts from background script
    chrome.runtime.sendMessage({action: "getShortcuts"}, function(response) {
      console.log("Shortcuts response:", response);
      if (response && response.success && response.shortcuts) {
        // Count shortcuts
        totalShortcutsEl.textContent = response.shortcuts.length || '0';
        
        // Extract unique domain targets from shortcuts
        const uniqueDomains = new Set();
        
        response.shortcuts.forEach(shortcut => {
          if (shortcut.url) {
            try {
              const url = new URL(shortcut.url);
              uniqueDomains.add(url.hostname);
            } catch (e) {
              // Skip invalid URLs
              console.warn("Invalid URL in shortcut:", shortcut.url);
            }
          }
        });
        
        console.log("Unique target domains:", uniqueDomains);
        totalDomainsEl.textContent = uniqueDomains.size;
      }
    });
    
    // Fall back to direct storage access if the message API fails
    fallbackToStorageData();
  }
  
  // Function to fall back to storage data if needed
  function fallbackToStorageData() {
    // Check storage directly for fallback counting
    chrome.storage.sync.get(null, (syncData) => {
      console.log("Sync storage data:", syncData);
      
      // Fallback for shortcuts if message API failed
      if (totalShortcutsEl.textContent === '0' && syncData.customShortcuts && Array.isArray(syncData.customShortcuts)) {
        totalShortcutsEl.textContent = syncData.customShortcuts.length;
        
        // Also try to count domains from shortcuts
        if (totalDomainsEl.textContent === '0') {
          const uniqueDomains = new Set();
          
          syncData.customShortcuts.forEach(shortcut => {
            if (shortcut.url) {
              try {
                const url = new URL(shortcut.url);
                uniqueDomains.add(url.hostname);
              } catch (e) {
                // Skip invalid URLs
              }
            }
          });
          
          totalDomainsEl.textContent = uniqueDomains.size;
        }
      }
    });
    
    // Also check local storage in case data is there
    chrome.storage.local.get(null, (localData) => {
      console.log("Local storage data:", localData);
      
      // Fallback for shortcuts in local storage
      if (totalShortcutsEl.textContent === '0' && 
          localData.customShortcuts && Array.isArray(localData.customShortcuts)) {
        totalShortcutsEl.textContent = localData.customShortcuts.length;
        
        // Also try to count domains from shortcuts
        if (totalDomainsEl.textContent === '0') {
          const uniqueDomains = new Set();
          
          localData.customShortcuts.forEach(shortcut => {
            if (shortcut.url) {
              try {
                const url = new URL(shortcut.url);
                uniqueDomains.add(url.hostname);
              } catch (e) {
                // Skip invalid URLs
              }
            }
          });
          
          totalDomainsEl.textContent = uniqueDomains.size;
        }
      }
      
      // Ultra-fallback for shortcut-like objects
      if (totalShortcutsEl.textContent === '0') {
        let shortcutCount = 0;
        const uniqueDomains = new Set();
        
        for (const key in localData) {
          const item = localData[key];
          if (item && typeof item === 'object' && item.command && item.url) {
            shortcutCount++;
            
            // Extract domain from URL
            try {
              const url = new URL(item.url);
              uniqueDomains.add(url.hostname);
            } catch (e) {
              // Skip invalid URLs
            }
          }
        }
        
        if (shortcutCount > 0) {
          totalShortcutsEl.textContent = shortcutCount;
        }
        
        if (uniqueDomains.size > 0 && totalDomainsEl.textContent === '0') {
          totalDomainsEl.textContent = uniqueDomains.size;
        }
      }
    });
  }
}