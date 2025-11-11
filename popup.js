document.addEventListener('DOMContentLoaded', function() {
  // --- Element References ---
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const manualModeContainer = document.getElementById('manual-mode-container');
  const excelPasteModeContainer = document.getElementById('excel-paste-mode-container'); // Renamed from csvModeContainer
  const manualNumbersTextarea = document.getElementById('manual-numbers');
  const manualMessageTextarea = document.getElementById('manual-message');
  const manualImageAttachmentInput = document.getElementById('manual-image-attachment');
  const manualDocumentAttachmentInput = document.getElementById('manual-document-attachment');
  const imageFilenameSpan = document.getElementById('image-filename');
  const clearImageAttachmentButton = document.getElementById('clear-image-attachment');
  const documentFilenameSpan = document.getElementById('document-filename');
  const clearDocumentAttachmentButton = document.getElementById('clear-document-attachment');
  const excelPasteTextarea = document.getElementById('excel-paste-textarea'); // New
  const excelPastePreviewContainer = document.getElementById('excel-paste-preview-container'); // New
  const excelPastePreviewList = document.getElementById('excel-paste-preview-list'); // New
  const sendMessagesButton = document.getElementById('send-messages');
  const cancelSendingButton = document.getElementById('cancel-sending');
  const progressContainer = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const currentStatus = document.getElementById('current-status');
  const resultsContainer = document.getElementById('results-container');
  const successfulCount = document.getElementById('successful-count');
  const successfulList = document.getElementById('successful-list');
  const failedCount = document.getElementById('failed-count');
  const failedList = document.getElementById('failed-list');
  const clearResultsBtn = document.getElementById('clear-results');

  // --- Template Management Elements ---
  const templateSelect = document.getElementById('template-select');
  const templateNameInput = document.getElementById('template-name');
  const saveTemplateButton = document.getElementById('save-template');
  const deleteTemplateButton = document.getElementById('delete-template');
  const useTemplateButton = document.getElementById('use-template');

  // --- Attachment Accordion Elements ---
  const imageAttachmentAccordionHeader = document.getElementById('image-attachment-accordion-header');
  const imageAttachmentAccordionContent = document.getElementById('image-attachment-accordion-content');
  const documentAttachmentAccordionHeader = document.getElementById('document-attachment-accordion-header');
  const documentAttachmentAccordionContent = document.getElementById('document-attachment-accordion-content');

  let messagesToSend = [];
  let currentAttachment = null; // This will hold the selected image or document data

  // --- Template Management Variables ---
  let templates = [];

  // --- Functions ---

  function loadTemplates() {
    chrome.storage.local.get(['templates'], (result) => {
      templates = result.templates || [];
      const defaultOption = '<option value="">-- Pilih atau Buat Template Baru --</option>';
      templateSelect.innerHTML = defaultOption + templates.map(template => 
        `<option value="${template.id}">${template.name}</option>`
      ).join('');
      clearTemplateForm();
    });
  }

  function clearTemplateForm() {
    templateNameInput.value = '';
    templateSelect.value = '';
    saveTemplateButton.textContent = 'Simpan Pesan sebagai Template';
    deleteTemplateButton.classList.add('hidden');
    useTemplateButton.classList.add('hidden');
  }

  async function saveTemplate() {
    const name = templateNameInput.value.trim();
    const content = manualMessageTextarea.value.trim(); // Read from the main message editor
    const selectedId = templateSelect.value;

    if (!name) {
      Swal.fire('Peringatan!', 'Nama template tidak boleh kosong.', 'warning');
      return;
    }
    if (!content) {
      Swal.fire('Peringatan!', 'Pesan tidak boleh kosong untuk disimpan sebagai template.', 'warning');
      return;
    }

    if (selectedId) {
      // Update existing template
      templates = templates.map(t => t.id === selectedId ? { ...t, name, content } : t);
      Swal.fire('Berhasil!', 'Template berhasil diperbarui!', 'success');
    } else {
      // Add new template
      const newTemplate = { id: Date.now().toString(), name, content };
      templates.push(newTemplate);
      Swal.fire('Berhasil!', 'Template baru berhasil disimpan!', 'success');
    }

    await chrome.storage.local.set({ templates });
    loadTemplates();
  }

  async function deleteTemplate() {
    const selectedId = templateSelect.value;
    if (!selectedId) {
      Swal.fire('Peringatan!', 'Pilih template yang ingin dihapus.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Konfirmasi',
      text: "Anda yakin ingin menghapus template ini?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        templates = templates.filter(t => t.id !== selectedId);
        await chrome.storage.local.set({ templates });
        loadTemplates();
        Swal.fire('Dihapus!', 'Template telah dihapus.', 'success');
      }
    });
  }

  function useTemplate() {
    const selectedId = templateSelect.value;
    if (!selectedId) {
      Swal.fire('Peringatan!', 'Pilih template yang ingin digunakan.', 'warning');
      return;
    }
    const selectedTemplate = templates.find(t => t.id === selectedId);
    if (selectedTemplate) {
      manualMessageTextarea.value = selectedTemplate.content;
      updatePreview(); // Update the preview with the template content
      savePopupState(); // Save the updated message to storage
    }
  }

  function normalizePhoneNumber(phoneNumber) {
    let cleanedNumber = phoneNumber.replace(/\D/g, '');
    if (cleanedNumber.startsWith('0')) {
      cleanedNumber = '62' + cleanedNumber.substring(1);
    } else if (cleanedNumber && !cleanedNumber.startsWith('62')) {
      cleanedNumber = '62' + cleanedNumber;
    }
    return cleanedNumber;
  }

  function updateAttachmentDisplay() {
    if (currentAttachment) {
      if (currentAttachment.fileType === 'image') {
        imageFilenameSpan.textContent = `Selected: ${currentAttachment.name}`;
        clearImageAttachmentButton.style.display = 'inline-block';
        documentFilenameSpan.textContent = '';
        clearDocumentAttachmentButton.style.display = 'none';
      } else if (currentAttachment.fileType === 'document') {
        documentFilenameSpan.textContent = `Selected: ${currentAttachment.name}`;
        clearDocumentAttachmentButton.style.display = 'inline-block';
        imageFilenameSpan.textContent = '';
        clearImageAttachmentButton.style.display = 'none';
      }
    } else {
      imageFilenameSpan.textContent = '';
      clearImageAttachmentButton.style.display = 'none';
      documentFilenameSpan.textContent = '';
      clearDocumentAttachmentButton.style.display = 'none';
    }
    updatePreview();
  }

  function clearAttachment(inputType) {
    currentAttachment = null;
    chrome.storage.local.remove('currentAttachment');
    if (inputType === 'image') {
      manualImageAttachmentInput.value = '';
    } else if (inputType === 'document') {
      manualDocumentAttachmentInput.value = '';
    }
    updateAttachmentDisplay();
  }

  function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      clearAttachment('document');
      const reader = new FileReader();
      reader.onload = function(e) {
        currentAttachment = { data: e.target.result, name: file.name, type: file.type, fileType: 'image' };
        chrome.storage.local.set({ currentAttachment: currentAttachment });
        updateAttachmentDisplay();
      };
      reader.readAsDataURL(file);
    } else {
      clearAttachment('image');
    }
  }

  function handleDocumentFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      clearAttachment('image');
      const reader = new FileReader();
      reader.onload = function(e) {
        currentAttachment = { data: e.target.result, name: file.name, type: file.type, fileType: 'document' };
        chrome.storage.local.set({ currentAttachment: currentAttachment });
        updateAttachmentDisplay();
      };
      reader.readAsDataURL(file);
    } else {
      clearAttachment('document');
    }
  }



  function parseExcelPaste(excelText) {
    messagesToSend = []; // Clear previous messages
    excelPasteTextarea.value = excelText; // Display the pasted text in the textarea

    const lines = excelText.trim().split(/\r?\n/);
    if (lines.length === 0) {
      renderExcelPastePreview([]);
      return;
    }

    // Assuming the first row might be headers, but we'll process all rows as data
    lines.forEach(line => {
      const columns = line.split('\t').map(col => col.trim());
      if (columns.length > 0 && columns[0]) { // Ensure there's at least a number
        const number = normalizePhoneNumber(columns[0]);
        const message = columns.slice(1).join(' ').trim(); // Concatenate remaining columns for message
        messagesToSend.push({ number, message });
      }
    });

    if (messagesToSend.length > 0) {
      Swal.fire('Berhasil!', `${messagesToSend.length} pesan dimuat dari Excel.`, 'success');
    } else {
      Swal.fire('Peringatan!', 'Tidak ada data yang valid ditemukan.', 'warning');
    }
    renderExcelPastePreview(messagesToSend);
  }

  function renderExcelPastePreview(messages) {
    if (!excelPastePreviewContainer || !excelPastePreviewList) return;

    if (messages.length === 0) {
      excelPastePreviewContainer.classList.add('hidden');
      excelPastePreviewList.innerHTML = '';
      return;
    }

    excelPastePreviewList.innerHTML = messages.map(msg => {
      const messageContent = msg.message || '<i>(Pesan kosong)</i>';
      return `<li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border);">
                <strong style="color: var(--color-accent-alt);">${msg.number}</strong><br>
                ${messageContent}
              </li>`;
    }).join('');

    excelPastePreviewContainer.classList.remove('hidden');
  }

  function prepareAndSendMessages() {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;

    if (selectedMode === 'manual') {
      const numbers = manualNumbersTextarea.value.trim().split('\n').filter(n => n);
      const messageText = manualMessageTextarea.value;
      if (numbers.length === 0 || (!messageText && !currentAttachment)) {
        Swal.fire('Peringatan!', 'Harap berikan nomor dan pesan/lampiran.', 'warning');
        return;
      }
      messagesToSend = numbers.map(number => ({
        number: normalizePhoneNumber(number),
        message: messageText,
        file: currentAttachment ? currentAttachment.name : null
      }));
    } else if (selectedMode === 'excel-paste') { // New mode
      if (messagesToSend.length === 0) {
        Swal.fire('Peringatan!', 'Harap paste data Excel terlebih dahulu.', 'warning');
        return;
      }
      // For excel-paste mode, attachments are not supported via the paste itself.
      // If a manual attachment is selected, it will be sent with all pasted messages.
      messagesToSend = messagesToSend.map(msg => ({
        ...msg,
        file: currentAttachment ? currentAttachment.name : null
      }));
    }

    if (messagesToSend.length === 0) {
      Swal.fire('Peringatan!', 'Tidak ada pesan untuk dikirim.', 'warning');
      return;
    }
    
    updateProgressUI('Memulai pengiriman...', 0, messagesToSend.length, true);
    chrome.runtime.sendMessage({
      action: "sendMessages",
      messages: messagesToSend,
      attachment: currentAttachment
    });
  }

  function updateProgressUI(status, currentIndex, totalMessages, isSendingActive) {
    const allSections = document.querySelectorAll('.section');
    const modeSelectionSection = document.querySelector('.section:first-of-type');

    if (isSendingActive) {
      allSections.forEach(el => el.classList.add('hidden'));
      manualModeContainer.classList.add('hidden');
      excelPasteModeContainer.classList.add('hidden'); // Updated
      
      sendMessagesButton.classList.add('hidden');
      progressContainer.classList.remove('hidden');
      cancelSendingButton.classList.remove('hidden');
      resultsContainer.classList.add('hidden');
      
      progressText.textContent = `Mengirim ${currentIndex} dari ${totalMessages} pesan...`;
      progressBar.style.width = `${(currentIndex / totalMessages) * 100}%`;
      currentStatus.textContent = `Status: ${status}`;
    } else {
      allSections.forEach(el => el.classList.remove('hidden'));
      
      // Explicitly re-apply the correct mode visibility
      const selectedMode = document.querySelector('input[name="mode"]:checked').value;
      manualModeContainer.classList.toggle('hidden', selectedMode !== 'manual');
      excelPasteModeContainer.classList.toggle('hidden', selectedMode !== 'excel-paste'); // Updated

      sendMessagesButton.classList.remove('hidden');
      progressContainer.classList.add('hidden');
      cancelSendingButton.classList.add('hidden');
      chrome.runtime.sendMessage({ action: "getSendingResults" }, (results) => {
        displaySendingResults(results);
      });
    }
  }

  function displaySendingResults(results) {
    if (!results || (results.success.length === 0 && results.failed.length === 0)) {
      resultsContainer.classList.add('hidden');
      return;
    }
    resultsContainer.classList.remove('hidden');
    successfulCount.textContent = results.success.length;
    failedCount.textContent = results.failed.length;
    successfulList.innerHTML = results.success.map(item => `<li>${item.number}</li>`).join('');
    failedList.innerHTML = results.failed.map(item => `<li>${item.number} - Error: ${item.error || 'Unknown'}</li>`).join('');
  }

  // --- Persistence Logic ---
  function savePopupState() {
    const state = {
      manualNumbers: manualNumbersTextarea.value,
      manualMessage: manualMessageTextarea.value,
      excelPasteText: excelPasteTextarea.value, // Save pasted text
      selectedMode: document.querySelector('input[name="mode"]:checked').value
    };
    chrome.storage.local.set({ popupState: state });
  }

  function loadPopupState() {
    chrome.storage.local.get(['popupState', 'currentAttachment'], (result) => {
      if (result.popupState) {
        const state = result.popupState;
        manualNumbersTextarea.value = state.manualNumbers || '';
        manualMessageTextarea.value = state.manualMessage || '';
        excelPasteTextarea.value = state.excelPasteText || ''; // Load pasted text
        
        const selectedMode = state.selectedMode || 'manual';
        document.querySelector(`input[name="mode"][value="${selectedMode}"]`).checked = true;
        document.querySelector(`input[name="mode"][value="${selectedMode}"]`).dispatchEvent(new Event('change'));
      }
      if (result.currentAttachment) {
        currentAttachment = result.currentAttachment;
        updateAttachmentDisplay();
      }
      updatePreview(); // Initial preview update
      // If excel-paste mode is selected, re-parse and render preview
      if (document.querySelector('input[name="mode"]:checked').value === 'excel-paste' && excelPasteTextarea.value) {
        parseExcelPaste(excelPasteTextarea.value);
      }
    });
  }

  function setupEventListeners() {
    modeRadios.forEach(radio => radio.addEventListener('change', () => {
      manualModeContainer.classList.toggle('hidden', radio.value !== 'manual');
      excelPasteModeContainer.classList.toggle('hidden', radio.value !== 'excel-paste'); // Updated
      savePopupState();
    }));

    manualImageAttachmentInput.addEventListener('change', handleImageFileSelect);
    clearImageAttachmentButton.addEventListener('click', () => clearAttachment('image'));
    manualDocumentAttachmentInput.addEventListener('change', handleDocumentFileSelect);
    clearDocumentAttachmentButton.addEventListener('click', () => clearAttachment('document'));
    
    excelPasteTextarea.addEventListener('paste', (e) => { // New paste listener
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const text = clipboardData.getData('text/plain');
      parseExcelPaste(text);
      savePopupState(); // Save state after paste
    });
    sendMessagesButton.addEventListener('click', prepareAndSendMessages);
    cancelSendingButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "cancelSending" });
    });
    clearResultsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "clearSendingResults" }, (response) => {
        if (response && response.status === "cleared") {
          displaySendingResults({ success: [], failed: [] });
        }
      });
    });

    manualNumbersTextarea.addEventListener('input', savePopupState);
    manualMessageTextarea.addEventListener('input', savePopupState);

    saveTemplateButton.addEventListener('click', saveTemplate);
    deleteTemplateButton.addEventListener('click', deleteTemplate);
    useTemplateButton.addEventListener('click', useTemplate);
    templateSelect.addEventListener('change', () => {
      const selectedId = templateSelect.value;
      if (selectedId) {
        const selectedTemplate = templates.find(t => t.id === selectedId);
        if (selectedTemplate) {
          templateNameInput.value = selectedTemplate.name;
          saveTemplateButton.textContent = 'Perbarui Template';
          deleteTemplateButton.classList.remove('hidden');
          useTemplateButton.classList.remove('hidden');
        }
      } else {
        clearTemplateForm();
      }
    });

    imageAttachmentAccordionHeader.addEventListener('click', () => {
      imageAttachmentAccordionContent.classList.toggle('collapsed');
      imageAttachmentAccordionHeader.classList.toggle('collapsed');
    });
    documentAttachmentAccordionHeader.addEventListener('click', () => {
      documentAttachmentAccordionContent.classList.toggle('collapsed');
      documentAttachmentAccordionHeader.classList.toggle('collapsed');
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateProgress") {
      updateProgressUI(request.status, request.currentIndex + 1, request.totalMessages, request.isSendingActive);
    }
  });

  // --- Text Editor Logic ---
  function wrapText(textarea, openTag, closeTag) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    if (selectedText) {
      textarea.value = `${before}${openTag}${selectedText}${closeTag}${after}`;
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = end + openTag.length;
    } else {
      textarea.value = `${before}${openTag}${closeTag}${after}`;
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length;
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setupTextEditor() {
    const toolbarContainer = document.querySelector('#editor-tab .text-editor-toolbar');
    const toolbarButtons = toolbarContainer.querySelectorAll('.toolbar-button');

    toolbarButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const format = button.dataset.format;
        let openTag, closeTag;
        switch (format) {
          case 'bold': openTag = '*'; closeTag = '*'; break;
          case 'italic': openTag = '_'; closeTag = '_'; break;
          case 'strike': openTag = '~'; closeTag = '~'; break;
          case 'mono': openTag = '```'; closeTag = '```'; break;
        }
        if (openTag && closeTag) {
          wrapText(manualMessageTextarea, openTag, closeTag);
        }
      });
    });
  }

  function updatePreview() {
    const attachmentContainer = document.getElementById('attachment-preview-container');
    const textContainer = document.getElementById('text-preview-container');
    let text = manualMessageTextarea.value;

    // Clear previous content
    attachmentContainer.innerHTML = '';
    textContainer.innerHTML = '';

    // Render attachment preview
    if (currentAttachment) {
      if (currentAttachment.fileType === 'image') {
        const img = document.createElement('img');
        img.src = currentAttachment.data;
        attachmentContainer.appendChild(img);
      } else if (currentAttachment.fileType === 'document') {
        const docPreview = document.createElement('div');
        docPreview.className = 'doc-preview';
        docPreview.innerHTML = `<div class="doc-preview-icon">📄</div><div class="doc-preview-name">${currentAttachment.name}</div>`;
        attachmentContainer.appendChild(docPreview);
      }
    }

    // Render text preview
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    text = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
    text = text.replace(/_(.*?)_/g, '<i>$1</i>');
    text = text.replace(/~(.*?)~/g, '<s>$1</s>');
    text = text.replace(/```(.*?)```/g, '<tt>$1</tt>');
    text = text.replace(/\n/g, '<br>');
    textContainer.innerHTML = text;
  }

  function setupEditorTabs() {
    const tabButtons = document.querySelectorAll('.editor-tabs .tab-button');
    const tabContents = document.querySelectorAll('.tab-content-wrapper .tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const tabId = button.dataset.tab + '-tab';
        document.getElementById(tabId).classList.add('active');
        if (button.dataset.tab === 'preview') {
          updatePreview();
        }
      });
    });
    manualMessageTextarea.addEventListener('input', updatePreview);
  }

  // --- Initialization ---
  setupEventListeners();
  setupTextEditor();
  setupEditorTabs();
  loadPopupState();
  loadTemplates();
  
  // Set initial state of accordions to collapsed
  imageAttachmentAccordionContent.classList.add('collapsed');
  documentAttachmentAccordionContent.classList.add('collapsed');
  
  chrome.runtime.sendMessage({ action: "getSendingStatus" }, (response) => {
    if (response) {
      updateProgressUI(response.status, response.currentIndex + (response.isSendingActive ? 1 : 0), response.totalMessages, response.isSendingActive);
    } else {
      updateProgressUI('', 0, 0, false);
    }
  });
  chrome.runtime.sendMessage({ action: "getSendingResults" }, (results) => {
    displaySendingResults(results);
  });
});