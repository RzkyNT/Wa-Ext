// background.js

let cancelRequested = false; // Global flag for cancellation

// Global state for sending process
let isSendingActive = false;
let currentProgressIndex = 0;
let totalMessagesToSend = 0;
let currentStatusMessage = '';
let sendingResults = { success: [], failed: [] }; // Global variable to store sending results

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request);
  if (request.action === "sendMessages") {
    cancelRequested = false; // Reset on new sending process
    isSendingActive = true; // Set sending active
    currentProgressIndex = 0;
    totalMessagesToSend = request.messages.length;
    currentStatusMessage = 'Memulai pengiriman...';
    sendingResults = { success: [], failed: [] }; // Clear results on new session
    chrome.storage.local.set({ sendingResults }); // Save initial empty results
    startSendingProcess(request.messages, request.attachment);
    sendResponse({status: "started"});
  } else if (request.action === "cancelSending") {
    cancelRequested = true;
    isSendingActive = false; // Set sending inactive
    currentStatusMessage = "Pengiriman Dibatalkan.";
    console.log("Sending process cancellation requested.");
    showNotification("Dibatalkan", "Pengiriman pesan dibatalkan.");
    // Optionally, send a final update to popup
    chrome.runtime.sendMessage({
      action: "updateProgress",
      status: currentStatusMessage,
      currentIndex: currentProgressIndex,
      totalMessages: totalMessagesToSend,
      isSendingActive: isSendingActive
    }).catch(() => {}); // Catch error if popup is closed
  } else if (request.action === "getSendingStatus") {
    // Respond with current sending status
    sendResponse({
      isSendingActive: isSendingActive,
      currentIndex: currentProgressIndex,
      totalMessages: totalMessagesToSend,
      status: currentStatusMessage
    });
    return true; // Keep the message channel open for async responses
  } else if (request.action === "getSendingResults") {
    chrome.storage.local.get(['sendingResults'], (result) => {
      sendResponse(result.sendingResults || { success: [], failed: [] });
    });
    return true; // Keep the message channel open for async responses
  } else if (request.action === "clearSendingResults") {
    sendingResults = { success: [], failed: [] };
    chrome.storage.local.set({ sendingResults }, () => {
      sendResponse({ status: "cleared" });
    });
    return true; // Keep the message channel open for async responses
  }
  return true; // Keep the message channel open for async responses
});

async function startSendingProcess(messages, attachment) {
  console.log("Starting sending process...");
  const [tab] = await chrome.tabs.query({active: true, url: "https://web.whatsapp.com/*"});

  if (!tab) {
    showNotification("Error", "Please open and select the WhatsApp Web tab.");
    isSendingActive = false;
    currentStatusMessage = "Error: WhatsApp Web tab not found.";
    chrome.runtime.sendMessage({
      action: "updateProgress",
      status: currentStatusMessage,
      currentIndex: currentProgressIndex,
      totalMessages: totalMessagesToSend,
      isSendingActive: isSendingActive
    }).catch(() => {});
    return;
  }

  totalMessagesToSend = messages.length; // Ensure this is set for initial progress

  try {
    // Step 1: Iterate through each message and send directly
    for (let i = 0; i < totalMessagesToSend; i++) {
      currentProgressIndex = i; // Update current index
      if (cancelRequested) {
        console.log("Sending cancelled by user.");
        showNotification("Dibatalkan", "Pengiriman pesan dibatalkan.");
        currentStatusMessage = "Pengiriman Dibatalkan.";
        isSendingActive = false;
        chrome.runtime.sendMessage({
          action: "updateProgress",
          status: currentStatusMessage,
          currentIndex: currentProgressIndex,
          totalMessages: totalMessagesToSend,
          isSendingActive: isSendingActive
        }).catch(() => {}); // Catch error if popup is closed
        return;
      }

      const message = messages[i];
      const currentNumber = message.number;
      currentStatusMessage = `Mengirim ke ${currentNumber}...`;

      chrome.runtime.sendMessage({
        action: "updateProgress",
        currentIndex: currentProgressIndex,
        totalMessages: totalMessagesToSend,
        status: currentStatusMessage,
        isSendingActive: isSendingActive
      }).catch(() => {}); // Catch error if popup is closed

            console.log(`Navigating to chat with: ${currentNumber}`);
            await chrome.tabs.update(tab.id, {url: `https://web.whatsapp.com/send?phone=${currentNumber}`});
            
            // Ensure the tab is active and focused before proceeding with content script operations
            await chrome.tabs.update(tab.id, {active: true, highlighted: true});
            console.log(`Tab ${tab.id} activated and highlighted.`);
      
            // Wait for the tab to finish loading
            await new Promise(resolve => {
              const listener = (tabId, info) => {
                if (info.status === 'complete' && tabId === tab.id) {
                  chrome.tabs.onUpdated.removeListener(listener);
                  console.log("Tab updated and loaded.");
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(listener);
            });
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for chat to open

      // Show overlay in content script for the newly loaded tab
      await sendMessageToContentScript(tab.id, { action: "showOverlay" });

      console.log(`Sending message to content script for number: ${currentNumber}`);
      const sentMessage = await sendMessageToContentScript(tab.id, {
        action: "sendMessage", // New action for direct sending
        message: message.message,
        attachment: attachment || null // Use the single attachment for all messages
      });
      console.log(`Response from 'sendMessage' for ${currentNumber}:`, sentMessage);

      if (!sentMessage || sentMessage.status !== "ok") {
        const errorMessage = sentMessage.error || "Unknown error";
        console.warn(`Failed to send message to ${currentNumber}: ${errorMessage}`);
        sendingResults.failed.push({ number: currentNumber, message: message.message, error: errorMessage });
        chrome.storage.local.set({ sendingResults }); // Save updated results
        showNotification("Peringatan", `Gagal mengirim ke ${currentNumber}: ${errorMessage}`);
        currentStatusMessage = `Gagal mengirim ke ${currentNumber}: ${errorMessage}`;
        chrome.runtime.sendMessage({
          action: "updateProgress",
          currentIndex: currentProgressIndex,
          totalMessages: totalMessagesToSend,
          status: currentStatusMessage,
          isSendingActive: isSendingActive
        }).catch(() => {}); // Catch error if popup is closed
      } else {
        sendingResults.success.push({ number: currentNumber, message: message.message });
        chrome.storage.local.set({ sendingResults }); // Save updated results
        showNotification("Sukses", `Pesan terkirim ke ${currentNumber}`);
        currentStatusMessage = `Terkirim ke ${currentNumber}`;
        chrome.runtime.sendMessage({
          action: "updateProgress",
          currentIndex: currentProgressIndex,
          totalMessages: totalMessagesToSend,
          status: currentStatusMessage,
          isSendingActive: isSendingActive
        }).catch(() => {}); // Catch error if popup is closed
      }

      await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between messages
    }

    showNotification("Selesai", "Pengiriman semua pesan selesai!");
    currentStatusMessage = "Pengiriman Selesai.";
    isSendingActive = false;
    chrome.runtime.sendMessage({
      action: "updateProgress",
      status: currentStatusMessage,
      currentIndex: totalMessagesToSend,
      totalMessages: totalMessagesToSend,
      isSendingActive: isSendingActive
    }).catch(() => {}); // Catch error if popup is closed

  } catch (e) {
    console.error("Error during sending process:", e);
    showNotification("Error", "Terjadi kesalahan: " + e.message);
    currentStatusMessage = `Terjadi Kesalahan: ${e.message}`;
    isSendingActive = false;
    chrome.runtime.sendMessage({
      action: "updateProgress",
      status: currentStatusMessage,
      currentIndex: currentProgressIndex,
      totalMessages: totalMessagesToSend,
      isSendingActive: isSendingActive
    }).catch(() => {}); // Catch error if popup is closed
  } finally {
    isSendingActive = false; // Reset flag
    // Hide overlay in content script
    await sendMessageToContentScript(tab.id, { action: "hideOverlay" });
  }
}

function sendMessageToContentScript(tabId, message) {
  return new Promise(async (resolve) => { // Made async to use await
    try {
      // First, ensure the content script is injected.
      // This will inject the script if it's not already present in the tab.
      // It's safe to call multiple times; Chrome will only inject once per tab session.
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log(`Content script injected into tab ${tabId}.`);

      // Now send the message
      chrome.tabs.sendMessage(tabId, message, (res) => {
        if (chrome.runtime.lastError) {
          console.error("Message sending failed after injection:", chrome.runtime.lastError);
          resolve({ status: "error", error: chrome.runtime.lastError.message });
        } else {
          resolve(res);
        }
      });
    } catch (e) {
      console.error("Error injecting or sending message to content script:", e);
      resolve({ status: "error", error: e.message });
    }
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: title,
    message: message
  });
}