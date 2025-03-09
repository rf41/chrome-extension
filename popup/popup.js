/**
 * Popup script for Smart Shortcut Panel
 * Handles the options button click and displays extension information
 */

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
  const memberStatusEl = document.getElementById('memberStatus');
  const totalShortcutsEl = document.getElementById('totalShortcuts');
  const totalDomainsEl = document.getElementById('totalDomains');
  
  memberStatusEl.textContent = 'Free';
  totalShortcutsEl.textContent = '0';
  totalDomainsEl.textContent = '0';
  
  checkLicenseStatus()
    .then(licenseInfo => {
      console.log("License check result:", licenseInfo);
      
      if (licenseInfo.isActive) {
        memberStatusEl.textContent = 'Premium';
        memberStatusEl.classList.add('premium-badge');
      }
    })
    .catch(error => {
      console.error("License check failed:", error);
    })
    .finally(() => {
      loadShortcutsAndDomains();
    });
  
  function checkLicenseStatus() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['premiumStatus'], (syncData) => {
        if (syncData.premiumStatus && syncData.premiumStatus.active === true) {
          resolve({ isActive: true, source: 'premium-status' });
          return;
        }
        
        chrome.storage.sync.get(['license', 'licenseKey'], (licenseData) => {
          if (licenseData.license && licenseData.license.status === 'active') {
            resolve({ isActive: true, source: 'sync-storage' });
            return;
          }
          
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
          
          chrome.storage.local.get(['license', 'licenseKey'], (localData) => {
            if (localData.license && localData.license.status === 'active') {
              resolve({ isActive: true, source: 'local-storage' });
              return;
            }
            
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
            
            chrome.storage.sync.get(['userData'], (userData) => {
              if (userData.userData && userData.userData.premium === true) {
                resolve({ isActive: true, source: 'userData' });
              } else {
                resolve({ isActive: false, source: 'no-data' });
              }
            });
          });
        });
      });
    });
  }
  
  function loadShortcutsAndDomains() {
    chrome.runtime.sendMessage({action: "getShortcuts"}, function(response) {
      console.log("Shortcuts response:", response);
      if (response && response.success && response.shortcuts) {
        totalShortcutsEl.textContent = response.shortcuts.length || '0';
      
        const uniqueDomains = new Set();
        
        response.shortcuts.forEach(shortcut => {
          if (shortcut.url) {
            try {
              const url = new URL(shortcut.url);
              uniqueDomains.add(url.hostname);
            } catch (e) {
              console.warn("Invalid URL in shortcut:", shortcut.url);
            }
          }
        });
        
        console.log("Unique target domains:", uniqueDomains);
        totalDomainsEl.textContent = uniqueDomains.size;
      }
    });
    
    fallbackToStorageData();
  }
  
  function fallbackToStorageData() {
    chrome.storage.sync.get(null, (syncData) => {
      console.log("Sync storage data:", syncData);
      
      if (totalShortcutsEl.textContent === '0' && syncData.customShortcuts && Array.isArray(syncData.customShortcuts)) {
        totalShortcutsEl.textContent = syncData.customShortcuts.length;
        
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
    
    chrome.storage.local.get(null, (localData) => {
      console.log("Local storage data:", localData);
      
      if (totalShortcutsEl.textContent === '0' && 
          localData.customShortcuts && Array.isArray(localData.customShortcuts)) {
        totalShortcutsEl.textContent = localData.customShortcuts.length;
        
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
      
      if (totalShortcutsEl.textContent === '0') {
        let shortcutCount = 0;
        const uniqueDomains = new Set();
        
        for (const key in localData) {
          const item = localData[key];
          if (item && typeof item === 'object' && item.command && item.url) {
            shortcutCount++;
            
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