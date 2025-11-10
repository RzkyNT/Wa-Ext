// content.js
console.log("WA Sender Free: Content script loaded.");

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "sendMessage") { // Renamed action
    console.log("Executing action: sendMessage");
    sendMessage(request.message, request.attachment) // Pass message and the full attachment object
      .then(() => {
        console.log("Action 'sendMessage' completed successfully.");
        sendResponse({status: "ok"});
      })
      .catch(err => {
        console.error("Error in 'sendMessage':", err);
        // Ensure a string message is always returned
        const errorMessage = (err && err.message) ? err.message : String(err);
        sendResponse({status: "error", error: errorMessage || "Unknown error in sendMessage"});
      });
    return true; // Indicates async response
  }
  // Removed forwardLastMessage logic
});

async function sendMessage(messageText, attachment) { // Renamed and adapted
  try {
    console.log("sendMessage: Waiting for message box...");
    // Updated selector for message box
    const messageBox = await waitForElement('div[contenteditable="true"][role="textbox"]', 20000); // Updated selector
    if (!messageBox) throw new Error("Message box not found.");
    console.log("sendMessage: Message box found.");

    // Attempt to focus the document more robustly
    await delay(500); // Small delay before focusing
    window.focus(); // Attempt to focus the window
    messageBox.focus(); // Explicitly focus the message box
    await delay(500); // Small delay after focusing

    // 1. Always insert text message first
    console.log("sendMessage: Inserting text message...");
    try {
      messageBox.focus(); // Ensure focus before inserting text
      document.execCommand('insertText', false, messageText);
      await delay(1000); // Give WhatsApp UI time to react and show send button
      console.log("sendMessage: Text inserted. Waiting for UI update.");
    } catch (textInsertError) {
      throw new Error(`Failed to insert text: ${textInsertError.message}`);
    }

    // 2. If attachment, handle attachment
    if (attachment && attachment.data) {
      console.log(`sendMessage: Handling attachment of type ${attachment.fileType || 'unknown'}...`);
      try {
        // 1. Find and click the attach button (plus-rounded icon)
        const attachButton = await waitForElement('span[data-icon="plus-rounded"]', 20000); // Increased timeout
        if (!attachButton) throw new Error("Attach button not found.");
        attachButton.click();
        await delay(1000); // Wait for attachment menu to appear

        let attachmentTypeButtonSelector;
        if (attachment.fileType === 'image') {
          attachmentTypeButtonSelector = 'span[data-icon="media-filled-refreshed"]'; // Photos & Videos
        } else if (attachment.fileType === 'document') {
          attachmentTypeButtonSelector = 'span[data-icon="document-filled-refreshed"]'; // Document
        } else {
          throw new Error("Unsupported attachment fileType: " + attachment.fileType);
        }

        // 2. Find and click the specific attachment type button
        const attachmentTypeButton = await waitForElement(attachmentTypeButtonSelector, 10000);
        if (!attachmentTypeButton) throw new Error(`${attachment.fileType} attachment type button not found.`);
        attachmentTypeButton.click();
        await delay(1000); // Wait for file input to be ready

        // 3. Inject the file using the helper function
        console.log('sendAttachment: File MIME type:', attachment.type); // Added logging
        sendAttachment(attachment.data, attachment.name, attachment.type);
        console.log(`Attachment ${attachment.name} injected.`);
        await delay(5000); // Wait for WhatsApp to process the file and show preview

        // No separate attachment send button click needed here,
        // the main send button will handle both message and attachment.

      } catch (attachmentError) {
        const errorMessage = (attachmentError && attachmentError.message) ? attachmentError.message : String(attachmentError);
        throw new Error(`Failed to send attachment: ${errorMessage}`);
      }
    }

    await delay(1000); // General delay before looking for send button

    // 3. Find and click the main send button (for both message and attachment)
    console.log("sendMessage: Waiting for send button...");
    const sendButton = await waitForElement('span[data-icon="wds-ic-send-filled"]', 20000); // Main send button
    if (!sendButton) throw new Error("Send button not found.");
    console.log("sendMessage: Send button found. Clicking...");
    sendButton.click();

    await delay(2000);
    console.log("sendMessage: Message sent.");
  } catch (error) {
    console.error("sendMessage: Error within sendMessage function:", error);
    throw error; // Re-throw to be caught by the listener's catch block
  }
}

function waitForElement(selector, timeout = 20000) { // Default timeout increased
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      reject(`Element not found: ${selector} (timeout after ${timeout / 1000}s)`);
    }, timeout);
  });
}

// Helper function to convert base64 to File and inject into input
function sendAttachment(base64, filename, mime) {
  const byteString = atob(base64.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  const file = new File([uint8Array], filename, { type: mime });

  // Find the hidden file input element
  // This selector might need adjustment based on WhatsApp Web's current DOM
  const fileInput = document.querySelector('input[type="file"]'); 
  if (!fileInput) {
    throw new Error("File input element not found for attachment.");
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
}
