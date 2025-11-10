// content.js
console.log("WA Sender Free: Content script loaded.");

/* ===========================
   Overlay blocker (paste near top of content.js)
   =========================== */

(function setupAutomationOverlay() {
  if (window.__waAutomationOverlayInstalled) return;
  window.__waAutomationOverlayInstalled = true;

  const OVERLAY_ID = 'wa-automation-overlay-v1';

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    // Basic styles - fullscreen, high z-index, center message
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647'; // very high
    overlay.style.background = 'rgba(255,255,255,0.0)'; // transparent background
    overlay.style.pointerEvents = 'auto'; // capture pointer events
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.userSelect = 'none';
    overlay.style.webkitUserSelect = 'none';
    overlay.style.backdropFilter = 'blur(2px)'; // optional soft blur

    // Inner panel (message + spinner)
    const panel = document.createElement('div');
    panel.style.background = 'rgba(0,0,0,0.75)';
    panel.style.color = '#fff';
    panel.style.padding = '14px 18px';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
    panel.style.display = 'flex';
    panel.style.gap = '12px';
    panel.style.alignItems = 'center';
    panel.style.fontFamily = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    panel.style.fontSize = '14px';
    panel.style.maxWidth = '80%';
    panel.style.textAlign = 'left';

    // spinner
    const spinner = document.createElement('div');
    spinner.style.width = '20px';
    spinner.style.height = '20px';
    spinner.style.border = '3px solid rgba(255,255,255,0.25)';
    spinner.style.borderTop = '3px solid #ffffff';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'waOverlaySpin 1s linear infinite';

    // message
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>Proses otomatis berjalan</strong><div style="font-weight:400; font-size:12px; opacity:0.9; margin-top:4px;">Jangan mengklik atau mengubah halaman sampai selesai.</div>`;

    panel.appendChild(spinner);
    panel.appendChild(msg);
    overlay.appendChild(panel);

    // block events (pointer/keyboard/contextmenu)
    const block = (e) => {
      e.stopPropagation();
      e.preventDefault();
      return false;
    };

    overlay.addEventListener('click', block, true);
    overlay.addEventListener('mousedown', block, true);
    overlay.addEventListener('mouseup', block, true);
    overlay.addEventListener('pointerdown', block, true);
    overlay.addEventListener('pointerup', block, true);
    overlay.addEventListener('touchstart', block, true);
    overlay.addEventListener('touchend', block, true);
    overlay.addEventListener('wheel', block, { passive: false, capture: true });
    overlay.addEventListener('contextmenu', block, true);

    // keyboard blocker - prevent accidental keypresses
    function keyBlocker(e) {
      // Allow SHIFT + ENTER to pass through for newlines
      if (e.shiftKey && e.key === 'Enter') {
        return true; // Do not block
      }
      // Block all other keys
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
    overlay._keyBlocker = keyBlocker;
    document.addEventListener('keydown', keyBlocker, true);
    document.addEventListener('keypress', keyBlocker, true);

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes waOverlaySpin {
        from { transform: rotate(0deg); } to { transform: rotate(360deg); }
      }
    `;
    overlay.appendChild(style);

    document.documentElement.appendChild(overlay);
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    // remove keyboard blockers
    if (overlay._keyBlocker) {
      document.removeEventListener('keydown', overlay._keyBlocker, true);
      document.removeEventListener('keypress', overlay._keyBlocker, true);
    }
    overlay.remove();
  }

  // expose helpers to window so main script can call
  window.__waShowOverlay = createOverlay;
  window.__waHideOverlay = removeOverlay;
})();

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
    const boxes = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    for (const box of boxes) {
      const title = box.getAttribute('title') || '';
      // If it doesn't have a title or the title doesn't contain "Search" or "Cari", it's likely the message box
      if (!title.match(/search|cari/i)) {
        return box;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Message box not found (after filtering search inputs)");
}    /**
 * Tunggu sampai WhatsApp benar-benar siap (logo WhatsApp muncul)
 * agar tidak tergantung delay waktu.
 */
async function waitForWhatsAppReady(timeout = 60000) {
  const startTime = Date.now();

  console.log("Menunggu WhatsApp Web siap...");

  while (Date.now() - startTime < timeout) {
    const waLogo = document.querySelector(
      'span[aria-hidden="false"][aria-label="WhatsApp"][data-icon="wa-wordmark-refreshed"]'
    );

    if (waLogo && waLogo.offsetParent !== null) {
      console.log("✅ WhatsApp sudah siap digunakan.");
      return true;
    }

    // Cek juga apakah tampilan error koneksi muncul
    const reconnectBanner = document.querySelector('div[role="alert"]');
    if (reconnectBanner && reconnectBanner.textContent.match(/reconnecting|memuat ulang/i)) {
      console.warn("⚠️ WhatsApp masih mencoba terhubung ulang...");
    }

    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error("❌ WhatsApp tidak siap setelah 60 detik.");
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
  } else if (request.action === "showOverlay") {
    window.__waShowOverlay?.();
    sendResponse({ status: "overlay shown" });
  } else if (request.action === "hideOverlay") {
    window.__waHideOverlay?.();
    sendResponse({ status: "overlay hidden" });
  } else if (request.action === "ping") {
    sendResponse({ status: "pong" });
  }
  return true;
});

async function insertMessageText(messageBox, messageText) {
  console.log("insertMessageText: messageText to insert:", messageText); // Added logging
  console.log("insertMessageText: inserting formatted text...");

  messageBox.focus();
  await delay(500);

  // --- New code for clearing existing text ---
  console.log("insertMessageText: Clearing existing text in message box...");
  messageBox.innerHTML = ''; // Clear contenteditable div
  messageBox.innerText = ''; // Ensure text is also cleared
  await delay(500); // Give some time for the text to clear
  console.log("insertMessageText: Existing text cleared.");
  // --- End of new code ---

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

  // --- New code for text verification ---
  const expectedTextHtml = messageText.replace(/\n/g, '<br>');
  const verificationStartTime = Date.now();
  const verificationTimeout = 5000; // 5 seconds timeout for verification

  while (Date.now() - verificationStartTime < verificationTimeout) {
    // Use innerHTML for comparison as WhatsApp uses <br> for newlines
    if (messageBox.innerHTML.includes(expectedTextHtml)) {
      console.log("insertMessageText: Message text successfully verified in the box.");
      return;
    }
    await delay(100); // Check every 100ms
  }
  console.warn("insertMessageText: Message text verification failed within timeout.");
  // --- End of new code ---
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
    await waitForWhatsAppReady(); // Wait for WhatsApp to be ready
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
      console.log("handleAttachment: Caption box found:", !!captionBox); // Added logging

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

