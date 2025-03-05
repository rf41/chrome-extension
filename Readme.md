# Custom Shortcut Extension

A Chrome extension for creating custom keyboard shortcuts and accessing site-specific shortcuts through a floating panel.

## Overview

Custom Shortcut Extension allows users to:
- Access domain-specific favorite menu through a floating panel
- The floating panel only show on spesific websites that have favorite menu
- Create keyboard shortcuts to quickly navigate to favorite menu on websites
- Configure a central hub of shortcuts for improved browsing productivity

## Features

- **Domain-Specific Shortcut Panels**: The extension intelligently displays shortcuts only on relevant domains
- **Configurable Keyboard Shortcuts**: Set up to 10 custom keyboard shortcuts for your most accessed menu on websites
- **Visual Shortcut Panel**: Easy-access floating widget for quick navigation
- **Search Functionality**: Quickly filter shortcuts in the panel
- **Customizable Panel Position**: Position the panel where it works best for you

## Getting Started

After installation, the extension will automatically open the options page. If not:

1. Click the extension icon in your toolbar
2. Select "Options" from the popup

### Creating Your First Shortcut

1. On the Options page, go to the "Custom Shortcuts" tab
2. Enter a title for your shortcut (e.g., "Google Search")
3. Enter the URL (e.g., "https://google.com")
4. Select a Command ID from the dropdown
5. Click "Add Custom Shortcut"
6. The domain is automatically set based on the URL you entered
7. Your shortcut is now active for that specific domain

### Configuring Keyboard Shortcuts (Optional)

To assign keyboard combinations to your shortcuts:

1. Click "Configure Keyboard Shortcuts" on the Options page
2. Find "Custom Shortcut Extension" in the list
3. Locate your shortcut command IDs
4. Click the pencil icon to record your desired key combination
5. Press your preferred key combination (e.g., Ctrl+Shift+1)
6. Click "OK" to save

## Using the Extension

### Using Keyboard Shortcuts

After configuring keyboard shortcuts, simply press your assigned combination to navigate directly to the associated website.

### Using the Floating Panel

1. The floating panel automatically appears on websites where you've configured shortcuts
2. Click the floating icon to expand the panel
3. Click on any shortcut to navigate to that site
4. Use the search box to filter shortcuts if you have many

### Managing Your Shortcuts

On the Options page, you can:
- Edit existing shortcuts
- Delete unwanted shortcuts
- Set up domain-specific shortcuts (limited to 5 per domain)

## Privacy Policy

### Data Collection
This extension does not collect, transmit, or store any personal data on external servers. All your shortcut configurations are stored locally in your browser using Chrome's storage API.

### Data Storage
- **What we store**: Only the shortcut data that you explicitly create (titles, URLs, domains, keyboard configurations)
- **Where it's stored**: Exclusively in your browser's local storage
- **How long it's stored**: Until you delete the data or uninstall the extension

### Permissions Used
- **Storage**: To save your shortcut configurations locally
- **Commands**: To enable keyboard shortcuts functionality
- **ActiveTab**: To interact with the current tab for shortcut operations

### GDPR Compliance
This extension is GDPR compliant as it:
- Does not collect personal data
- Does not use cookies
- Does not share any data with third parties
- Provides full user control over all stored data

### Data Deletion
To delete all data stored by this extension:
1. Right-click the extension icon
2. Select "Remove from Chrome..."
3. Confirm removal

## Troubleshooting

### Keyboard Shortcuts Not Working?
- Ensure you've configured shortcuts at [`chrome://extensions/shortcuts`](chrome://extensions/shortcuts)
- Check for conflicts with other extensions or system shortcuts
- Try restarting Chrome

### Floating Panel Not Appearing?
- The panel only appears on domains where you've set up shortcuts
- Refresh the page after adding new shortcuts
- Check if you have domain restrictions set correctly

### Performance Issues
- Disable and re-enable the extension
- Check if you have too many shortcuts configured (recommended limit: 50)
- Ensure Chrome is updated to the latest version

### Other Issues
- Clear browser cache and reload the page
- Check the console for error messages (right-click > Inspect > Console)
- Try reinstalling the extension

## Frequently Asked Questions

**Q: How many shortcuts can I create?**  
A: You can create up to 10 global shortcuts with keyboard commands and with maksimum 5 shortcuts in the floating panel for one spesific website.

**Q: Does this extension collect any analytics?**  
A: No, we do not collect any usage data or analytics.

**Q: Will this extension slow down my browsing?**  
A: The extension is designed for minimal performance impact and only activates on domains where you've configured shortcuts.

*This extension is not affiliated with or endorsed by Google Chrome or Alphabet Inc. Custom Shortcut Extension is committed to maintaining compatibility with Chrome's latest standards and best practices.*