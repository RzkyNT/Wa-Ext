# WA Sender Free Chrome Extension

This is a Chrome extension for sending WhatsApp messages.

## Installation

You can install this extension using one of the following methods:

### Method 1: Install via `chrome://extensions` (Developer Mode)

This is the recommended method for local development and testing.

1.  **Download the extension:** If you have a `.zip` file, extract its contents to a folder. If you have a `.crx` file, you can skip this step for now, but you'll need the extracted folder later if you want to load it as an unpacked extension.
2.  **Open Chrome Extensions page:**
    *   Open Google Chrome.
    *   Type `chrome://extensions` in the address bar and press Enter.
3.  **Enable Developer Mode:**
    *   In the top right corner of the Extensions page, toggle on the "Developer mode" switch.
4.  **Load the extension:**
    *   Click on the "Load unpacked" button.
    *   Navigate to the folder where you extracted the extension files (the folder containing `manifest.json`).
    *   Select the folder and click "Select Folder".
5.  The extension should now be installed and visible on your `chrome://extensions` page.

### Method 2: Install via CRX File (Drag and Drop)

This method might be restricted by Chrome's security policies, especially for extensions not from the Chrome Web Store.

1.  **Download the `.crx` file:** Ensure you have the `extension.crx` file.
2.  **Open Chrome Extensions page:**
    *   Open Google Chrome.
    *   Type `chrome://extensions` in the address bar and press Enter.
3.  **Drag and Drop:**
    *   Drag the `extension.crx` file from your file explorer directly onto the `chrome://extensions` page.
4.  A prompt will appear asking you to confirm the installation. Click "Add extension".
5.  The extension should now be installed.

### Method 3: Install via ZIP File (Manual Unpack)

This method is similar to Method 1 but starts with a ZIP file.

1.  **Download the `.zip` file:** Ensure you have the `extension_20251114_1028.zip` (or similar) file.
2.  **Extract the ZIP file:** Extract the contents of the `.zip` file to a new folder on your computer. Make sure the `manifest.json` file is directly inside this new folder.
3.  **Follow steps 2-5 from "Method 1: Install via `chrome://extensions` (Developer Mode)"** using the extracted folder.

## Usage

Once installed, click on the extension icon in your Chrome toolbar to open the popup and start using the WA Sender Free extension.