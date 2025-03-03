/**
 * Background service worker for the Custom Shortcut Extension
 * Listens for shortcut commands and opens the saved URL
 */

// Default URL to open if none is saved
const DEFAULT_URL = "https://example.com";

// URL validation function
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow http and https protocols (block javascript:, data:, file:, etc)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.error("Blocked non-http(s) protocol:", url.protocol);
      return false;
    }
    
    // Check for potentially dangerous domains (comprehensive phishing protection)
    const suspiciousDomains = [
      // Common malicious domains
      'evil.com', 'malware.com', 'phishing', 'virus', 'trojan',
      
      // Authentication/financial scam patterns
      'login-verification', 'account-verify', 'secure-login',
      'banking-secure', 'verification-required', 'password-reset',
      'auth-confirm', 'wallet-validate', 'crypto-verify',
      
      // Typosquatting common targets
      'paypai', 'amaz0n', 'g00gle', 'faceb00k', 'appl3', 'microsofft',
      'instagran', 'netfilx', 'twiter', 'linkedln', 'youtubee',
      
      // Suspicious terminology
      'free-gift', 'prize-won', 'lucky-winner', 'claim-reward',
      'urgent-action', 'account-suspended', 'unusual-activity',
      'security-alert', 'update-required', 'identity-check',
      
      // Common phishing domains
      'secure-logon', 'signin-verify', 'customer-verify', 'billing-update',
      'account-limited', 'payment-update', 'support-ticket',
      
      // Generic suspicious TLDs
      '.tk', '.top', '.xyz', '.gq', '.ml', '.ga', '.cf',
      
      // Temporary/disposable domains
      'temp-mail', 'disposable', 'tempmail', 'fakeemail', '10minutemail',
      'throwaway', 'guerrillamail',
      
      // Commonly abused domains
      'bit.ly', 'goo.gl', 'tinyurl', 't.co', 'is.gd', 'ow.ly',
      
      // Common tech support scams
      'tech-support', 'helpdesk-alert', 'windows-security',
      'microsoft-support', 'apple-support', 'google-security',
      'browser-update', 'antivirus-expired', 'system-warning',
      
      // Document/attachment scams
      'shared-document', 'invoice-attached', 'resume-download',
      'pdf-view', 'doc-preview', 'secure-file',
      
      // IP address URLs (often suspicious)
      'ip-address'
    ];
    
    // Check hostname against suspicious patterns
    for (const pattern of suspiciousDomains) {
      if (url.hostname.includes(pattern) || url.pathname.includes(pattern)) {
        console.error("Blocked suspicious domain/path:", pattern, "in", url.toString());
        return false;
      }
    }
    
    // Check for IP addresses in hostname (often suspicious)
    const ipAddressPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipAddressPattern.test(url.hostname)) {
      console.error("Blocked IP address as hostname:", url.hostname);
      return false;
    }
    
    // Check for excessive subdomains (potential DNS tunneling or evasion)
    const subdomainCount = (url.hostname.match(/\./g) || []).length;
    if (subdomainCount > 5) {
      console.error("Blocked URL with excessive subdomains:", url.hostname);
      return false;
    }
    
    // Check for excessively long hostnames (potential obfuscation)
    if (url.hostname.length > 100) {
      console.error("Blocked excessively long hostname:", url.hostname);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Invalid URL format:", urlString);
    return false;
  }
}

// Rate limiting mechanism
let lastCommandTime = 0;
const COMMAND_COOLDOWN_MS = 1000; // 1 second cooldown between commands

// Add this new function after isValidUrl
function checkUrlSafety(url, callback) {
  // Basic safety check first
  if (!isValidUrl(url)) {
    callback(false, "URL failed basic safety check");
    return;
  }
  
  // If you want to implement more advanced security in the future,
  // you could add an API call to a web safety service here
  
  callback(true, "URL passed safety checks");
}

// Add this function after isValidUrl and before the event listeners

// Sanitize URLs before opening them
function sanitizeUrl(url) {
  try {
    // Parse the URL to ensure it's valid
    const parsedUrl = new URL(url);
    
    // Remove any fragments that could contain JavaScript
    parsedUrl.hash = '';
    
    // Ensure protocol is http or https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return 'https://example.com'; // Return a safe default if protocol is suspicious
    }
    
    // Return the sanitized URL
    return parsedUrl.toString();
  } catch (error) {
    console.error("URL sanitization failed:", error);
    return 'https://example.com'; // Return a safe default on error
  }
}

// Check storage permission before accessing
function safelyAccessStorage(callback) {
  // Note: storage is in the required permissions, not optional permissions
  // If you move it to optional, use this check:
  /* 
  chrome.permissions.contains({permissions: ['storage']}, (hasPermission) => {
    if (hasPermission) {
      callback();
    } else {
      console.error("Storage permission not granted");
    }
  });
  */
  
  // Since storage is in required permissions, we can just call the callback
  callback();
}

// Update the chrome.commands.onCommand listener
chrome.commands.onCommand.addListener((command) => {
  // Rate limiting check
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_COOLDOWN_MS) {
    console.log("Command ignored due to rate limiting");
    return; // Ignore command due to rate limiting
  }
  lastCommandTime = now;

  if (command === "open-custom-url") {
    // Open options page instead of URL
    chrome.runtime.openOptionsPage();
  } else {
    safelyAccessStorage(() => {
      // Handle custom shortcuts from user settings
      chrome.storage.sync.get(["customShortcuts"], (result) => {
        if (result.customShortcuts) {
          const shortcut = result.customShortcuts.find(s => s.command === command);
          if (shortcut && shortcut.url) {
            // Check URL safety before opening
            checkUrlSafety(shortcut.url, (isSafe, message) => {
              if (isSafe) {
                // Show notification before opening URL
                /*chrome.notifications.create({
                  type: "basic",
                  iconUrl: "icons/icon128.png", // Ensure this path is correct
                  title: "Opening Shortcut",
                  message: `Opening: ${shortcut.title || shortcut.url}`
                });
                */
                // Then open the URL
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  const sanitizedUrl = sanitizeUrl(shortcut.url);
                  
                  if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, {url: sanitizedUrl})
                      .catch(error => console.error("Failed to update tab:", error));
                  } else {
                    // Fallback: create new tab if no active tab exists
                    chrome.tabs.create({url: sanitizedUrl})
                      .catch(error => console.error("Failed to create tab:", error));
                  }
                });
              } else {
                // Show security warning
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: "icons/icon128.png",
                  title: "Security Warning",
                  message: `Couldn't open shortcut: ${message}`
                });
                console.error("URL safety check failed:", message, shortcut.url);
              }
            });
          }
        }
      });
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getShortcuts") {
    safelyAccessStorage(() => {
      try {
        chrome.storage.sync.get(["customShortcuts"], (result) => {
          try {
            sendResponse({shortcuts: result.customShortcuts || []});
          } catch (error) {
            console.error("Error sending response:", error);
            sendResponse({error: "Failed to retrieve shortcuts"});
          }
        });
      } catch (error) {
        console.error("Storage access error:", error);
        sendResponse({error: "Failed to access storage"});
      }
    });
    return true; // Required for async response
  } 
  else if (message.action === "openOptions") {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error("Failed to open options page:", error);
    }
  }
  else if (message.action === "validateUrl") {
    try {
      const url = message.url;
      const valid = isValidUrl(url);
      let reason = "";
      
      if (!valid) {
        reason = "URL contains suspicious patterns or is improperly formatted";
      }
      
      sendResponse({isValid: valid, reason: reason});
    } catch (error) {
      console.error("URL validation error:", error);
      sendResponse({isValid: false, reason: "Error validating URL"});
    }
    return true; // Required for async response
  }
});

// Listen for install events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page when extension is first installed
    chrome.runtime.openOptionsPage();
  }
});