document.addEventListener('DOMContentLoaded', function() {
  // --- Element References ---
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const manualModeContainer = document.getElementById('manual-mode-container');
  const excelModeContainer = document.getElementById('excel-mode-container');
  const manualNumbersTextarea = document.getElementById('manual-numbers');
  const manualMessageTextarea = document.getElementById('manual-message');
  const manualImageAttachmentInput = document.getElementById('manual-image-attachment');
  const manualDocumentAttachmentInput = document.getElementById('manual-document-attachment');
  const imageFilenameSpan = document.getElementById('image-filename');
  const clearImageAttachmentButton = document.getElementById('clear-image-attachment');
  const documentFilenameSpan = document.getElementById('document-filename');
  const clearDocumentAttachmentButton = document.getElementById('clear-document-attachment');
  const excelFileInput = document.getElementById('excel-file');
  const excelPreviewContainer = document.getElementById('excel-preview-container');
  const excelDataTableContainer = document.getElementById('excel-data-table-container');
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
  const templateContentTextarea = document.getElementById('template-content');
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
      clearAttachment('document'); // Clear document attachment if an image is selected
      const reader = new FileReader();
      reader.onload = function(e) {
        currentAttachment = { data: e.target.result, name: file.name, type: file.type, fileType: 'image' };
        chrome.storage.local.set({ currentAttachment: currentAttachment });
        updateAttachmentDisplay();
        console.log('Image attachment stored:', file.name);
      };
      reader.readAsDataURL(file);
    } else {
      clearAttachment('image');
    }
  }

  function handleDocumentFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      clearAttachment('image'); // Clear image attachment if a document is selected
      const reader = new FileReader();
      reader.onload = function(e) {
        currentAttachment = { data: e.target.result, name: file.name, type: file.type, fileType: 'document' };
        chrome.storage.local.set({ currentAttachment: currentAttachment });
        updateAttachmentDisplay();
        console.log('Document attachment stored:', file.name);
      };
      reader.readAsDataURL(file);
    } else {
      clearAttachment('document');
    }
  }

  function handleExcelFile(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Get data as array of arrays
        parseExcelData(json);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function parseExcelData(excelData) {
    if (excelData.length === 0) {
      messagesToSend = [];
      return;
    }
    const headers = excelData[0].map(h => h.trim());
    const dataRows = excelData.slice(1);

    messagesToSend = dataRows.map(row => {
      const message = {};
      headers.forEach((header, index) => {
        message[header] = row[index] ? String(row[index]).trim() : '';
      });
      if (message.number) {
        message.number = normalizePhoneNumber(message.number);
      }
      return message;
    });
    console.log('Parsed Excel data:', messagesToSend);
    Swal.fire({
      icon: 'success',
      title: 'Berhasil!',
      text: `${messagesToSend.length} pesan dimuat dari Excel.`,
      confirmButtonText: 'OK'
    });
    displayExcelPreview(messagesToSend);
  }

  function displayExcelPreview(data) {
    if (data.length === 0) {
      excelPreviewContainer.style.display = 'none';
      excelDataTableContainer.innerHTML = '';
      return;
    }

    excelPreviewContainer.style.display = 'block';
    let tableHtml = '<table style="width:100%; border-collapse: collapse;"><thead><tr>';

    // Headers
    const headers = Object.keys(data[0]);
    headers.forEach(header => {
      tableHtml += `<th style="border: 1px solid var(--color-border); padding: 8px; text-align: left; background-color: var(--color-surface-alt);">${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Rows (limit to first 5 for preview)
    data.slice(0, 5).forEach(row => {
      tableHtml += '<tr>';
      headers.forEach(header => {
        tableHtml += `<td style="border: 1px solid var(--color-border); padding: 8px;">${row[header]}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    excelDataTableContainer.innerHTML = tableHtml;
  }

  function clearExcelPreview() {
    excelPreviewContainer.style.display = 'none';
    excelDataTableContainer.innerHTML = '';
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
        // For manual mode, attachment is taken from currentAttachment
        file: currentAttachment ? currentAttachment.name : null
      }));
    } else if (selectedMode === 'excel') {
      if (messagesToSend.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          text: 'Harap impor file Excel.',
          confirmButtonText: 'OK'
        });
        return;
      }
      messagesToSend = messagesToSend.map(msg => ({
        ...msg,
        file: currentAttachment ? currentAttachment.name : null
      }));
    } else {
      // This 'else' block was missing its closing brace.
      // The code below was incorrectly outside of it.
    }

    if (messagesToSend.length === 0) {
      Swal.fire('Peringatan!', 'Tidak ada pesan untuk dikirim.', 'warning');
      return;
    }

    console.log('Preparing to send messages:', messagesToSend);
    
    // Initial UI update for sending process
    updateProgressUI(
      'Memulai pengiriman...',
      0,
      messagesToSend.length,
      true // isSendingActive
    );

    chrome.runtime.sendMessage({
      action: "sendMessages",
      messages: messagesToSend,
      attachment: currentAttachment // Pass the currentAttachment object
    });
  }

  function updateProgressUI(status, currentIndex, totalMessages, isSendingActive) {
    const allSections = document.querySelectorAll('.section');
    const modeSelectionSection = document.querySelector('.section:first-of-type');

    if (isSendingActive) {
      document.querySelectorAll('.section').forEach(el => el.classList.add('hidden')); 
      allSections.forEach(el => el.classList.add('hidden'));
      manualModeContainer.classList.add('hidden');
      sendMessagesButton.classList.add('hidden');
      progressContainer.classList.remove('hidden');
      cancelSendingButton.classList.remove('hidden');
      resultsContainer.classList.add('hidden'); // Hide results when sending starts
      
      progressText.textContent = `Mengirim ${currentIndex} dari ${totalMessages} pesan...`;
      progressBar.style.width = `${(currentIndex / totalMessages) * 100}%`;
      currentStatus.textContent = `Status: ${status}`;
    } else {
      allSections.forEach(el => el.classList.remove('hidden'));
      
      // Explicitly re-apply the correct mode visibility
      const selectedMode = document.querySelector('input[name="mode"]:checked').value;
      manualModeContainer.classList.toggle('hidden', selectedMode !== 'manual');
      excelModeContainer.classList.toggle('hidden', selectedMode !== 'excel');

      sendMessagesButton.classList.remove('hidden');
      progressContainer.classList.add('hidden');
      cancelSendingButton.classList.add('hidden');
      // Show results if there are any
      chrome.runtime.sendMessage({ action: "getSendingResults" }, (results) => {
        displaySendingResults(results);
      });
    }
  }

  function displaySendingResults(results) {
    successfulList.innerHTML = '';
    failedList.innerHTML = '';

    if (!results || (results.success.length === 0 && results.failed.length === 0)) {
      resultsContainer.classList.add('hidden');
      return;
    }

    resultsContainer.classList.remove('hidden');
    successfulCount.textContent = results.success.length;
    failedCount.textContent = results.failed.length;

    results.success.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.number}`;
      successfulList.appendChild(li);
    });

    results.failed.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.number} - Error: ${item.error || 'Unknown'}`;
      failedList.appendChild(li);
    });
  }

  // --- Persistence Logic ---

  function savePopupState() {
    const state = {
      manualNumbers: manualNumbersTextarea.value,
      manualMessage: manualMessageTextarea.value,
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
        
        const selectedMode = state.selectedMode || 'manual';
        document.querySelector(`input[name="mode"][value="${selectedMode}"]`).checked = true;
        
        document.querySelector(`input[name="mode"][value="${selectedMode}"]`).dispatchEvent(new Event('change'));
      }
      if (result.currentAttachment) {
        currentAttachment = result.currentAttachment;
        updateAttachmentDisplay();
      }
      updatePreview(); // Initial preview update
    });
  }

  function setupEventListeners() {
    modeRadios.forEach(radio => radio.addEventListener('change', () => {
      manualModeContainer.classList.toggle('hidden', radio.value !== 'manual');
      excelModeContainer.classList.toggle('hidden', radio.value !== 'excel');
      templateManagementSection.classList.toggle('hidden', radio.value === 'excel');
      if (radio.value !== 'excel') {
        clearExcelPreview();
      }
      savePopupState(); // Save state when mode changes
    }));

    manualImageAttachmentInput.addEventListener('change', handleImageFileSelect);
    clearImageAttachmentButton.addEventListener('click', () => clearAttachment('image'));
    manualDocumentAttachmentInput.addEventListener('change', handleDocumentFileSelect);
    clearDocumentAttachmentButton.addEventListener('click', () => clearAttachment('document'));
    excelFileInput.addEventListener('change', (event) => {
      handleExcelFile(event);
      if (!event.target.files[0]) { // If file is cleared
        clearExcelPreview();
      }
    });
    sendMessagesButton.addEventListener('click', prepareAndSendMessages);
    cancelSendingButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "cancelSending" });
      currentStatus.textContent = 'Pengiriman dibatalkan.'; // Immediate feedback
      updateProgressUI('Pengiriman dibatalkan.', 0, 0, false); // Hide progress UI
    });
    clearResultsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "clearSendingResults" }, (response) => {
        if (response && response.status === "cleared") {
          displaySendingResults({ success: [], failed: [] }); // Clear UI
        }
      });
    });

    // Add listeners to save state on input
    manualNumbersTextarea.addEventListener('input', savePopupState);
    manualMessageTextarea.addEventListener('input', savePopupState);

    // --- Template Management Event Listeners ---
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
    console.log("Popup received message:", request); // Added logging
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

        // Gunakan ikon Font Awesome
        docPreview.innerHTML = `
          <div class="doc-preview-icon">
            <i class="fas fa-file"></i>
          </div>
          <div class="doc-preview-name">${currentAttachment.name}</div>
        `;

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
  loadTemplates(); // Load templates on popup initialization
  
  // Set initial state of accordions to collapsed
  imageAttachmentAccordionContent.classList.add('collapsed');
  documentAttachmentAccordionContent.classList.add('collapsed');
  
  chrome.runtime.sendMessage({ action: "getSendingStatus" }, (response) => {
    if (response) {
      updateProgressUI(
        response.status,
        response.currentIndex + (response.isSendingActive ? 1 : 0), // +1 for 1-based indexing if active
        response.totalMessages,
        response.isSendingActive
      );
    } else {
      // If no active sending process, ensure UI is clean
      updateProgressUI('', 0, 0, false);
    }
  });

  // Request and display sending results on load
  chrome.runtime.sendMessage({ action: "getSendingResults" }, (results) => {
    displaySendingResults(results);
  });
});