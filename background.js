/**
 * Background service worker for the Custom Shortcut Extension
 * Listens for shortcut commands and opens the saved URLs
 */

// Default URL to open if none is saved
const DEFAULT_URL = "https://example.com";

// URL validation function
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow http and https protocols (block javascript:, data:, file:, etc)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.warn("Blocked non-http(s) protocol:", url.protocol);
      return false;
    }
    
    // Higher-risk patterns that warrant blocking
    const highRiskPatterns = [
      // Common malicious domains
      'evil.com', 'malware.com', 'phishing.', 'virus.', 'trojan.',
      
      // Authentication/financial scam patterns
      'account-verify.', 'secure-login.', 'verification-required.',
      'wallet-validate.', 'crypto-verify.',
      
      // Document/attachment scams
      'invoice-attached.', 'secure-file.',
    ];
    
    // Check hostname against high-risk patterns
    for (const pattern of highRiskPatterns) {
      if (url.hostname.includes(pattern) || url.pathname.includes(pattern)) {
        console.warn("Blocked high-risk domain/path:", pattern, "in", url.toString());
        return false;
      }
    }
    
    // Check for IP addresses in hostname (often suspicious)
    const ipAddressPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipAddressPattern.test(url.hostname)) {
      console.warn("Blocked IP address as hostname:", url.hostname);
      return false;
    }
    
    // Check for excessive subdomains (potential DNS tunneling or evasion)
    const subdomainCount = (url.hostname.match(/\./g) || []).length;
    if (subdomainCount > 5) {
      console.warn("Blocked URL with excessive subdomains:", url.hostname);
      return false;
    }
    
    // Check for excessively long hostnames (potential obfuscation)
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

// Rate limiting mechanism
let lastCommandTime = 0;
const COMMAND_COOLDOWN_MS = 1000; // 1 second cooldown between commands

// Check the url safety before opening
function checkUrlSafety(url) {
  return new Promise((resolve) => {
    // Basic safety check
    if (!isValidUrl(url)) {
      resolve({isSafe: false, message: "URL failed safety check"});
      return;
    }
    
    resolve({isSafe: true, message: "URL passed safety checks"});
  });
}

// Sanitize URLs before opening them
function sanitizeUrl(url) {
  try {
    // Parse the URL to ensure it's valid
    const parsedUrl = new URL(url);
    
    // Remove any fragments that could contain JavaScript
    parsedUrl.hash = '';
    
    // Ensure protocol is http or https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return DEFAULT_URL; // Return a safe default if protocol is suspicious
    }
    
    // Return the sanitized URL
    return parsedUrl.toString();
  } catch (error) {
    console.warn("URL sanitization failed:", error);
    return DEFAULT_URL; // Return a safe default on error
  }
}

// Get shortcuts from storage
function getShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["customShortcuts"], (result) => {
      resolve(result.customShortcuts || []);
    });
  });
}

// Open URL in current tab or new tab if none active
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

// Command handler
chrome.commands.onCommand.addListener(async (command) => {
  // Rate limiting check
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_COOLDOWN_MS) {
    console.log("Command ignored due to rate limiting");
    return;
  }
  lastCommandTime = now;

  if (command === "open-custom-url") {
    // Open options page instead of URL
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    // Get shortcuts from storage
    const shortcuts = await getShortcuts();
    const shortcut = shortcuts.find(s => s.command === command);
    
    if (shortcut && shortcut.url) {
      // Check URL safety
      const safetyResult = await checkUrlSafety(shortcut.url);
      
      if (safetyResult.isSafe) {
        // Open the URL
        await openUrl(shortcut.url);
      } else {
        console.warn("URL safety check failed:", safetyResult.message, shortcut.url);
      }
    }
  } catch (error) {
    console.error("Error handling command:", error);
  }
});

// License API credentials - stored securely in background context
const API_CREDENTIALS = {
  consumerKey: 'ck_9eeb9517833188c72cdf4d94dac63f6cbc18ba3c',
  consumerSecret: 'cs_6ac366de7eae5804493d735e58d08b85db8944cb'
};

// Helper function for authorization
function getAuthorizationHeader() {
  return btoa(`${API_CREDENTIALS.consumerKey}:${API_CREDENTIALS.consumerSecret}`);
}

// Function to handle license API requests securely from the background
async function handleLicenseApiRequest(message, sendResponse) {
  try {
    const { endpoint, licenseKey } = message;
    const url = `https://ridwancard.my.id${endpoint}${licenseKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${getAuthorizationHeader()}`,
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
    
    sendResponse({ data });
  } catch (error) {
    console.error('License API request failed:', error);
    sendResponse({ error: error.message });
  }
}

// URL validation function for form validation
function validateUrl(string) {
  // Handle empty strings
  if (!string || string.trim() === '') return false;
  
  // Add protocol if missing
  let url = string.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try { 
    const urlObj = new URL(url);
    // Additional validation - must have a valid hostname with at least one dot
    return urlObj.hostname && urlObj.hostname.includes('.') && 
           // Basic check that hostname follows domain name rules
           /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])+$/.test(urlObj.hostname);
  } catch (_) {
    return false;
  }
}

// CONSOLIDATED message handler for all action types
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate message structure
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
      return true; // Required for async response
    
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
        // Ensure URL is provided
        if (!message.url || typeof message.url !== 'string') {
          sendResponse({
            success: false, 
            isValid: false, 
            error: "No URL provided or invalid URL format"
          });
          return true;
        }
        
        const url = message.url;
        const valid = validateUrl(url);
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
      // Handle license API requests
      handleLicenseApiRequest(message, sendResponse);
      return true; // Keep the message channel open for async response
      
    default:
      console.warn("Unknown message action received:", message.action);
      sendResponse({
        success: false, 
        error: "Unknown action type",
        supportedActions: ["getShortcuts", "openOptions", "validateUrl", "licenseApiRequest"]
      });
      return true;
  }
});

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page when extension is first installed
    chrome.runtime.openOptionsPage();
  }
});
