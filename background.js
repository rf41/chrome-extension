/**
 * Background service worker for Smart Shortcut Panel
 * Listens for shortcut commands and opens the saved URLs
 */

const DEFAULT_URL = "chrome://newtab";

// Add encryption utilities
const ENCRYPTION_KEY_STORAGE_NAME = 'secure_storage_key';
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_SALT_LENGTH = 16;
const ENCRYPTION_ITERATIONS = 100000;

// Generate a secure encryption key or retrieve existing one
async function getEncryptionKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([ENCRYPTION_KEY_STORAGE_NAME], async (result) => {
      if (result[ENCRYPTION_KEY_STORAGE_NAME]) {
        // Key exists, use it
        resolve(result[ENCRYPTION_KEY_STORAGE_NAME]);
      } else {
        // Generate a new encryption key (32 random bytes encoded as base64)
        const keyArray = new Uint8Array(32);
        crypto.getRandomValues(keyArray);
        const newKey = btoa(String.fromCharCode.apply(null, keyArray));
        
        // Store the key and return it
        chrome.storage.local.set({ [ENCRYPTION_KEY_STORAGE_NAME]: newKey }, () => {
          resolve(newKey);
        });
      }
    });
  });
}

// Encrypt sensitive data
async function encryptData(data) {
  try {
    const keyMaterial = await getEncryptionKey();
    
    // Create salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(ENCRYPTION_SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LENGTH));
    
    // Derive key using PBKDF2
    const keyData = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(keyMaterial),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ENCRYPTION_ITERATIONS,
        hash: 'SHA-256'
      },
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encodedData
    );
    
    // Combine the salt, IV, and encrypted data
    const encryptedData = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
    encryptedData.set(salt, 0);
    encryptedData.set(iv, salt.length);
    encryptedData.set(new Uint8Array(encryptedContent), salt.length + iv.length);
    
    // Return as Base64 string
    return btoa(String.fromCharCode.apply(null, encryptedData));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

// Decrypt sensitive data
async function decryptData(encryptedBase64) {
  try {
    const keyMaterial = await getEncryptionKey();
    
    // Convert from Base64 to byte array
    const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract salt, IV, and encrypted content
    const salt = encryptedBytes.slice(0, ENCRYPTION_SALT_LENGTH);
    const iv = encryptedBytes.slice(ENCRYPTION_SALT_LENGTH, ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH);
    const encryptedContent = encryptedBytes.slice(ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH);
    
    // Derive key using PBKDF2
    const keyData = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(keyMaterial),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ENCRYPTION_ITERATIONS,
        hash: 'SHA-256'
      },
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedContent
    );
    
    // Parse and return the decrypted data
    return JSON.parse(new TextDecoder().decode(decryptedContent));
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.warn("Blocked non-http(s) protocol:", url.protocol);
      return false;
    }
    
    const highRiskPatterns = [
      'evil.com', 'malware.com', 'phishing.', 'virus.', 'trojan.',
      'account-verify.', 'secure-login.', 'verification-required.',
      'wallet-validate.', 'crypto-verify.',
      'invoice-attached.', 'secure-file.',
    ];
    
    for (const pattern of highRiskPatterns) {
      if (url.hostname.includes(pattern) || url.pathname.includes(pattern)) {
        console.warn("Blocked high-risk domain/path:", pattern, "in", url.toString());
        return false;
      }
    }
    
    const ipAddressPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipAddressPattern.test(url.hostname)) {
      console.warn("Blocked IP address as hostname:", url.hostname);
      return false;
    }
    
    const subdomainCount = (url.hostname.match(/\./g) || []).length;
    if (subdomainCount > 5) {
      console.warn("Blocked URL with excessive subdomains:", url.hostname);
      return false;
    }
    
    if (url.hostname.length > 100) {
      console.warn("Blocked excessively long hostname:", url.hostname);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn("Invalid URL format:", urlString);
    return false;
  }
}

let lastCommandTime = 0;
const COMMAND_COOLDOWN_MS = 1000; 

function checkUrlSafety(url) {
  return new Promise((resolve) => {
    if (!isValidUrl(url)) {
      resolve({isSafe: false, message: "URL failed safety check"});
      return;
    }
    
    resolve({isSafe: true, message: "URL passed safety checks"});
  });
}

function sanitizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    parsedUrl.hash = '';
    
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return DEFAULT_URL; 
    }
    
    return parsedUrl.toString();
  } catch (error) {
    console.warn("URL sanitization failed:", error);
    return DEFAULT_URL;
  }
}

function getShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["customShortcuts"], (result) => {
      resolve(result.customShortcuts || []);
    });
  });
}

function openUrl(url) {
  const sanitizedUrl = sanitizeUrl(url);
  
  return new Promise((resolve, reject) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      try {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, {url: sanitizedUrl})
            .then(resolve)
            .catch(reject);
        } else {
          chrome.tabs.create({url: sanitizedUrl})
            .then(resolve)
            .catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_COOLDOWN_MS) {
    console.log("Command ignored due to rate limiting");
    return;
  }
  lastCommandTime = now;

  if (command === "open-custom-url") {
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const shortcuts = await getShortcuts();
    const shortcut = shortcuts.find(s => s.command === command);
    
    if (shortcut && shortcut.url) {
      const safetyResult = await checkUrlSafety(shortcut.url);
      
      if (safetyResult.isSafe) {
        await openUrl(shortcut.url);
      } else {
        console.warn("URL safety check failed:", safetyResult.message, shortcut.url);
      }
    }
  } catch (error) {
    console.error("Error handling command:", error);
  }
});

// Centralized License API Configuration and Functions
const LICENSE_API_CONFIG = {
  baseUrl: 'https://ridwancard.my.id',
  endpoints: {
    middleware: '/v1/api.php',
    activate: '?action=activate',
    validate: '?action=validate',
    deactivate: '?action=deactivate'
  }
};

/**
 * Make a request to the license API middleware
 * @param {string} action - The API action (activate, validate, deactivate)
 * @param {string} licenseKey - The license key
 * @returns {Promise<Object>} The API response
 */
async function makeLicenseApiRequest(action, licenseKey) {
  if (!action || !licenseKey) {
    throw new Error('Action and license key are required');
  }

  const url = `${LICENSE_API_CONFIG.baseUrl}${LICENSE_API_CONFIG.endpoints.middleware}`;
  const params = new URLSearchParams({
    action: action,
    license_key: licenseKey,
    instance: chrome.runtime.id
  });
  
  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Server responded with status: ${response.status}`);
  }

  const text = await response.text();
  let data;

  try {
    if (text.includes('<b>Warning</b>') || text.includes('<br />')) {
      const jsonMatch = text.match(/(\{.*\})/);
      if (jsonMatch && jsonMatch[1]) {
        data = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Server returned HTML error with no valid JSON');
      }
    } else {
      data = JSON.parse(text);
    }
  } catch (e) {
    console.error('Failed to parse response:', e);
    throw new Error('Failed to parse server response');
  }

  return data;
}

/**
 * Check if a license key is valid
 * @param {string} licenseKey - The license key to verify
 * @returns {Promise<Object>} The API response
 */
async function verifyLicenseKey(licenseKey) {
  try {
    const data = await makeLicenseApiRequest('activate', licenseKey);

    if (data && data.success === true) {
      // Encrypt the premium status before storing
      const premiumStatus = {
        active: true,
        activatedOn: new Date().toISOString(),
        licenseKey: licenseKey,
        expiresOn: data.data?.expires_at || null,
        timesActivated: data.data?.times_activated || 0,
        timesActivatedMax: data.data?.times_activated_max || 1,
        remainingActivations: data.data?.remaining_activations || 1,
        lastVerified: new Date().toISOString()
      };
      
      const encryptedStatus = await encryptData(premiumStatus);
      
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({
          'encryptedPremiumStatus': encryptedStatus
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      return data;
    } else {
      let errorMessage = 'License verification failed';
      if (data.message) {
        errorMessage = data.message;
      }
      
      const premiumStatus = {
        active: false,
        licenseKey: licenseKey,
        activationAttempted: new Date().toISOString(),
        reason: errorMessage
      };
      
      const encryptedStatus = await encryptData(premiumStatus);
      
      await new Promise((resolve) => {
        chrome.storage.sync.set({
          'encryptedPremiumStatus': encryptedStatus
        }, resolve);
      });
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('License verification error:', error);
    throw error;
  }
}

/**
 * Refresh a license with the API
 * @param {string} licenseKey - The license key to refresh
 * @returns {Promise<Object>} The API response with updated storage status
 */
async function refreshLicense(licenseKey) {
  try {
    const data = await makeLicenseApiRequest('validate', licenseKey);
    
    // Get and decrypt current premium status
    const encryptedStatus = await new Promise(resolve => {
      chrome.storage.sync.get(['encryptedPremiumStatus'], result => {
        resolve(result.encryptedPremiumStatus);
      });
    });
    
    let premiumStatus = null;
    if (encryptedStatus) {
      premiumStatus = await decryptData(encryptedStatus);
    }
    
    if (data && data.success === true) {
      // Update and encrypt the premium status
      const updatedStatus = {
        active: true,
        activatedOn: premiumStatus?.activatedOn || new Date().toISOString(),
        licenseKey: licenseKey,
        expiresOn: data.data?.expires_at || null,
        lastVerified: new Date().toISOString(),
        timesActivated: data.data?.times_activated || 1,
        timesActivatedMax: data.data?.times_activated_max || null
      };
      
      const newEncryptedStatus = await encryptData(updatedStatus);
      
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({
          'encryptedPremiumStatus': newEncryptedStatus
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } else {
      let errorMessage = 'License is no longer valid';
      if (data.message) {
        errorMessage = data.message;
      }
      
      // Update and encrypt the deactivated status
      const deactivatedStatus = {
        active: false,
        licenseKey: licenseKey,
        deactivatedOn: new Date().toISOString(),
        reason: errorMessage
      };
      
      const newEncryptedStatus = await encryptData(deactivatedStatus);
      
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({
          'encryptedPremiumStatus': newEncryptedStatus
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    
    // Get the updated encrypted status
    const newEncryptedStatus = await new Promise(resolve => {
      chrome.storage.sync.get(['encryptedPremiumStatus'], result => {
        resolve(result.encryptedPremiumStatus);
      });
    });
    
    // Decrypt for sending in response
    const decryptedStatus = await decryptData(newEncryptedStatus);
    
    return {
      apiResponse: data,
      updatedStatus: { premiumStatus: decryptedStatus }
    };
  } catch (error) {
    console.error('License refresh error:', error);
    throw error;
  }
}

/**
 * Deactivate a license with the API
 * @param {string} licenseKey - The license key to deactivate
 * @returns {Promise<Object>} The API response with local deactivation status
 */
async function deactivateLicense(licenseKey) {
  try {
    const data = await makeLicenseApiRequest('deactivate', licenseKey);
    
    await new Promise((resolve) => {
      chrome.storage.sync.remove(['encryptedPremiumStatus'], resolve);
    });
    
    return {
      apiResponse: data,
      localDeactivation: true
    };
  } catch (error) {
    console.error('License deactivation error:', error);
    
    await new Promise((resolve) => {
      chrome.storage.sync.remove(['encryptedPremiumStatus'], resolve);
    });
    
    return {
      apiResponse: { success: false, message: error.message },
      localDeactivation: true
    };
  }
}

/**
 * Get current license information from storage
 * @returns {Promise<Object>} The current license information
 */
async function getLicenseInfo() {
  return new Promise(async (resolve) => {
    chrome.storage.sync.get(['encryptedPremiumStatus'], async (result) => {
      if (result.encryptedPremiumStatus) {
        try {
          const decryptedStatus = await decryptData(result.encryptedPremiumStatus);
          resolve(decryptedStatus || { active: false });
        } catch (error) {
          console.error('Failed to decrypt license info:', error);
          resolve({ active: false, error: 'Decryption failed' });
        }
      } else {
        resolve({ active: false });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !message.action) {
    console.error("Invalid message format received");
    sendResponse({success: false, error: "Invalid message format"});
    return true;
  }

  switch (message.action) {
    case "getShortcuts":
      getShortcuts()
        .then(shortcuts => sendResponse({success: true, shortcuts}))
        .catch(error => {
          console.error("Error retrieving shortcuts:", error);
          sendResponse({
            success: false, 
            error: "Failed to retrieve shortcuts",
            details: error.message
          });
        });
      return true;
    
    case "openOptions":
      try {
        chrome.runtime.openOptionsPage();
        sendResponse({success: true});
      } catch (error) {
        console.error("Failed to open options page:", error);
        sendResponse({
          success: false, 
          error: "Failed to open options page",
          details: error.message
        });
      }
      return true;
    
    case "validateUrl":
      try {
        if (!message.url || typeof message.url !== 'string') {
          sendResponse({
            success: false, 
            isValid: false, 
            error: "No URL provided or invalid URL format"
          });
          return true;
        }
        
        const url = message.url;
        const valid = isValidUrl(url);  // Changed from validateUrl to isValidUrl
        const reason = valid ? "" : "URL contains suspicious patterns or is improperly formatted";
        
        sendResponse({
          success: true,
          isValid: valid, 
          reason: reason
        });
      } catch (error) {
        console.error("URL validation error:", error);
        sendResponse({
          success: false,
          isValid: false, 
          error: "Error validating URL",
          details: error.message
        });
      }
      return true;
      
    case "licenseApiRequest":
      if (!message.action || !message.licenseKey) {
        sendResponse({ success: false, error: "Invalid license API request" });
        return true;
      }
      
      const action = message.endpoint.includes('activate') ? 'activate' : 
                    message.endpoint.includes('validate') ? 'validate' : 
                    message.endpoint.includes('deactivate') ? 'deactivate' : '';
      
      if (!action) {
        sendResponse({ success: false, error: "Invalid license action" });
        return true;
      }
      
      makeLicenseApiRequest(action, message.licenseKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case "verifyLicenseKey":
      verifyLicenseKey(message.licenseKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case "refreshLicense":
      refreshLicense(message.licenseKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case "deactivateLicense":
      deactivateLicense(message.licenseKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case "getLicenseInfo":
      getLicenseInfo()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      console.warn("Unknown message action received:", message.action);
      sendResponse({
        success: false, 
        error: "Unknown action type",
        supportedActions: ["getShortcuts", "openOptions", "validateUrl", "licenseApiRequest", 
                          "verifyLicenseKey", "refreshLicense", "deactivateLicense", "getLicenseInfo"]
      });
      return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
