// content.js
console.log("WA Sender Free: Content script loaded.");

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function waitForElement(selector, timeout = 20000) {
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

async function waitForMessageBox(timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    // Ambil semua elemen yang bisa diketik
    const boxes = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');

    for (const box of boxes) {
      const placeholder = box.getAttribute('aria-placeholder') || '';
      const tabindex = box.getAttribute('tabindex') || '';
      
      // ❌ Blacklist jika placeholder-nya mengandung "Tanya Meta AI" atau "Cari"
      if (/meta ai|cari/i.test(placeholder) || tabindex === '3') {
        continue;
      }

      // ✅ Jika bukan search bar, maka ini message box yang benar
      return box;
    }

    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Message box not found (filtered out search bar)");
}

// Helper to convert base64 → File and inject
function sendAttachment(base64, filename, mime) {
  const byteString = atob(base64.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) uint8Array[i] = byteString.charCodeAt(i);
  const file = new File([uint8Array], filename, { type: mime });

  const fileInput =
    document.querySelector('input[type="file"][accept^="image"]') ||
    document.querySelector('input[type="file"][accept*="image"]') ||
    document.querySelector('input[type="file"]');



  if (!fileInput) {

    throw new Error("File input element not found for attachment.");

  }

  console.log("Injected file input accept attribute:", fileInput.accept); // Added verification log



  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  console.log(`Injected attachment: ${filename}`);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "sendMessage") {
    console.log("Executing action: sendMessage");
    sendMessage(request.message, request.attachment)
      .then(() => {
        console.log("Action 'sendMessage' completed successfully.");
        sendResponse({ status: "ok" });
      })
      .catch(err => {
        console.error("Error in 'sendMessage':", err);
        const errorMessage = (err && err.message) ? err.message : String(err);
        sendResponse({ status: "error", error: errorMessage || "Unknown error in sendMessage" });
      });
    return true;
  }
});

async function insertMessageText(messageBox, messageText) {
  console.log("insertMessageText: inserting formatted text...");

  messageBox.focus();
  await delay(500);

  const lines = messageText.split('\n');
  const inputEvent = (text) => {
    document.execCommand('insertText', false, text);
    messageBox.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() !== "") {
      inputEvent(line);
    }
    if (i < lines.length - 1) {
      // Simulasikan SHIFT + ENTER untuk newline (bukan hanya "\n")
      const evt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true });
      messageBox.dispatchEvent(evt);
      await delay(100);
      const evtUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true });
      messageBox.dispatchEvent(evtUp);
      await delay(100);
    }
    await delay(50);
  }

  messageBox.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await delay(500);
}


async function handleAttachment(attachment) {
  console.log(`Handling attachment of type ${attachment.fileType || 'unknown'}...`);
  const attachButton = await waitForElement('span[data-icon="plus-rounded"]', 20000);
  attachButton.click();
  await delay(1000);

  let attachmentTypeButtonSelector;
  if (attachment.fileType === 'image') {
    attachmentTypeButtonSelector =
      'div[aria-label="Photos & Videos"], div[aria-label="Gallery"], span[data-icon="attach-image"], input[accept*="image"]';
  } else if (attachment.fileType === 'document') {
    attachmentTypeButtonSelector = 'span[data-icon="document-filled-refreshed"]';
  } else {
    throw new Error("Unsupported attachment fileType: " + attachment.fileType);
  }

  let attachmentTypeButton = await waitForElement(attachmentTypeButtonSelector, 10000);
  if (!attachmentTypeButton) {
    console.warn("Media button not found, trying document fallback.");
    attachmentTypeButtonSelector = 'span[data-icon="document-filled-refreshed"]';
    attachmentTypeButton = await waitForElement(attachmentTypeButtonSelector, 10000);
    if (!attachmentTypeButton)
      throw new Error(`${attachment.fileType} attachment type button not found, even with fallback.`);
  }

  attachmentTypeButton.click();
  await delay(1000);
  sendAttachment(attachment.data, attachment.name, attachment.type);
  await delay(5000);
  console.log("Attachment handled and ready to send.");
}

async function sendMessage(messageText, attachment) {
  console.log("sendMessage: messageText received:", messageText);
  try {
    const messageBox = await waitForMessageBox();
    await delay(500);
    window.focus();
    messageBox.focus();
    await delay(500);

    // 1️⃣ Kirim attachment lebih dulu
    if (attachment && attachment.data) {
      await handleAttachment(attachment);
      console.log("Attachment selesai, menunggu caption box...");
      await delay(2000);

      // 🔍 Cari caption box setelah preview muncul
      const captionBox = document.querySelector('div[contenteditable="true"][data-lexical-text="true"]')
        || document.querySelector('div[contenteditable="true"]._ak1r')
        || document.querySelector('div[contenteditable="true"][role="textbox"]:not([aria-placeholder*="Cari"])');

      if (captionBox) {
        console.log("Caption box ditemukan, mengetik caption...");
        await insertMessageText(captionBox, messageText);
      } else {
        console.warn("Caption box tidak ditemukan, fallback ke message box biasa.");
        await insertMessageText(messageBox, messageText);
      }

      // Klik tombol kirim di modal (preview)
      const sendButton = await waitForElement('span[data-icon="wds-ic-send-filled"]', 20000);
      sendButton.click();
      console.log("Attachment dengan caption terkirim.");
      await delay(2000);
      return; // penting: stop di sini, jangan lanjut ke messageBox
    }

    // 2️⃣ Jika tidak ada attachment, kirim pesan biasa
    await insertMessageText(messageBox, messageText);
    console.log("Text inserted WYSIWYG (tanpa attachment).");

    const sendButton = await waitForElement('span[data-icon="wds-ic-send-filled"]', 20000);
    sendButton.click();
    console.log("Message sent.");
    await delay(2000);
  } catch (error) {
    console.error("sendMessage: Error:", error);
    throw error;
  }
}

