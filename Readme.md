# Custom Shortcut Extension

A Chrome extension for creating custom keyboard shortcuts and accessing site-specific shortcuts through a floating panel.

![Extension Banner](images/banner.png)

## Overview

Custom Shortcut Extension allows users to:
- Create keyboard shortcuts to quickly navigate to frequently visited websites
- Access domain-specific shortcuts through a floating panel
- Configure a central hub of shortcuts for improved browsing productivity

## Features

- **Domain-Specific Shortcut Panels**: The extension intelligently displays shortcuts only on relevant domains
- **Configurable Keyboard Shortcuts**: Set up to 10 custom keyboard shortcuts for your most accessed sites
- **Visual Shortcut Panel**: Easy-access floating widget for quick navigation
- **Search Functionality**: Quickly filter shortcuts in the panel
- **Customizable Panel Position**: Position the panel where it works best for you

## Screenshots

![Main Interface](images/screenshot1.png)
*Main configuration interface showing shortcut management*

![Floating Panel](images/screenshot2.png)
*Floating panel on a website with custom shortcuts*

![Keyboard Configuration](images/screenshot3.png)
*Keyboard shortcut configuration interface*

## Technical Requirements

- **Chrome Version**: Compatible with Google Chrome 88+
- **Manifest Version**: Built with Manifest V3 for enhanced security and performance
- **Platform Support**: Windows, macOS, Linux, and ChromeOS
- **Performance Impact**: Minimal resource usage with efficient background processing
- **Extension Size**: Less than 2MB

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store page (link will be available after publication)
2. Click "Add to Chrome"
3. Follow the prompts to complete installation

### Manual Installation (Developer Mode)
1. Download the latest release ZIP file
2. Extract the ZIP file to a folder on your computer
3. Open Chrome and navigate to [`chrome://extensions/`](chrome://extensions/)
4. Enable "Developer mode" (toggle in top-right)
5. Click "Load unpacked" and select the extracted folder
6. The extension is now installed and ready to use

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

For full privacy policy details, visit our [website](https://customshortcut.example.com/privacy).

## Accessibility Features

Custom Shortcut Extension is designed to be accessible for all users:

- **Keyboard Navigation**: All features are fully accessible via keyboard
- **Screen Reader Support**: Compatible with popular screen readers
- **High Contrast Mode**: UI elements maintain visibility in high contrast mode
- **Customizable Panel Size**: Panel size can be adjusted for easier visibility
- **Keyboard-first Operation**: Core functionality designed around keyboard shortcuts

## Error Handling

The extension includes robust error handling:
- **Network Issues**: Graceful degradation when connectivity is limited
- **Permission Changes**: Adaptive responses to permission changes
- **User Feedback**: Clear error messages with troubleshooting guidance
- **Recovery Options**: Automatic recovery from common error conditions
- **Logging**: Detailed console logs for troubleshooting (developer mode)

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

**Q: Does this extension work in Incognito mode?**  
A: Yes, but you need to explicitly enable it in the extension settings.

**Q: Will my shortcuts sync across devices?**  
A: Yes, if you have Chrome Sync enabled, your shortcuts will sync across your Chrome browsers.

**Q: Can I import/export my shortcuts?**  
A: Yes, the Options page includes import/export functionality.

**Q: Does this work with Chrome profiles?**  
A: Yes, shortcuts are specific to each Chrome profile.

**Q: How many shortcuts can I create?**  
A: You can create up to 10 global shortcuts with keyboard commands and unlimited shortcuts in the floating panel.

**Q: Does this extension collect any analytics?**  
A: No, we do not collect any usage data or analytics.

**Q: Will this extension slow down my browsing?**  
A: The extension is designed for minimal performance impact and only activates on domains where you've configured shortcuts.

## Support & Feedback

If you encounter any issues or have suggestions for improvements:
- Open an issue on our GitHub repository: [github.com/customshortcut/extension](https://github.com/customshortcut/extension)
- Email our support team: support@customshortcut.example.com
- Visit our support forum: [customshortcut.example.com/support](https://customshortcut.example.com/support)

We aim to respond to all inquiries within 24-48 hours.

## For Developers

### Contributing
We welcome contributions to improve Custom Shortcut Extension:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Structure
- `manifest.json`: Extension configuration
- `background.js`: Background service worker
- `content.js`: Content script for webpage integration
- `options/`: Options page UI and logic
- `popup/`: Browser action popup UI and logic

## Version History

**Version 1.0** - March 3, 2025
- Initial release with core functionality
- Custom keyboard shortcuts
- Domain-specific floating panels
- Shortcut management interface

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Icon design by Alex Design Studio
- UI components from Material Design
- Special thanks to our beta testers: Jane Doe, John Smith, and the Chrome Extensions community
- Inspiration from productivity tools like Alfred and Raycast

---

*This extension is not affiliated with or endorsed by Google Chrome or Alphabet Inc. Custom Shortcut Extension is committed to maintaining compatibility with Chrome's latest standards and best practices.*