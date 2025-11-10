document.addEventListener('DOMContentLoaded', function() {
  // --- Element References ---
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const manualModeContainer = document.getElementById('manual-mode-container');
  const csvModeContainer = document.getElementById('csv-mode-container');
  const manualNumbersTextarea = document.getElementById('manual-numbers');
  const manualMessageTextarea = document.getElementById('manual-message');
  const manualImageAttachmentInput = document.getElementById('manual-image-attachment');
  const manualDocumentAttachmentInput = document.getElementById('manual-document-attachment');
  const imageFilenameSpan = document.getElementById('image-filename');
  const clearImageAttachmentButton = document.getElementById('clear-image-attachment');
  const documentFilenameSpan = document.getElementById('document-filename');
  const clearDocumentAttachmentButton = document.getElementById('clear-document-attachment');
  const csvFileInput = document.getElementById('csv-file');
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
  const templateManagementSection = document.getElementById('template-management-section');

  let messagesToSend = [];
  let currentAttachment = null; // This will hold the selected image or document data

  // --- Template Management Variables ---
  let templates = [];
  let currentEditingTemplateId = null;

  // --- Functions ---

  function loadTemplates() {
    chrome.storage.local.get(['templates'], (result) => {
      templates = result.templates || [];
      templateSelect.innerHTML = '<option value="">-- Pilih Template --</option>';
      templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        templateSelect.appendChild(option);
      });
      clearTemplateForm();
    });
  }

  function clearTemplateForm() {
    templateNameInput.value = '';
    templateContentTextarea.value = '';
    templateSelect.value = '';
    currentEditingTemplateId = null;
    saveTemplateButton.textContent = 'Simpan Template'; // Reset button text
    saveTemplateButton.classList.remove('hidden'); // Show save button
    deleteTemplateButton.classList.add('hidden'); // Hide delete button
    useTemplateButton.classList.add('hidden'); // Hide use button
  }

  async function saveTemplate() {
    const name = templateNameInput.value.trim();
    const content = templateContentTextarea.value.trim();

    if (!name || !content) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan!',
        text: 'Nama dan isi template tidak boleh kosong.',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (currentEditingTemplateId) {
      // Update existing template
      templates = templates.map(t => t.id === currentEditingTemplateId ? { ...t, name, content } : t);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Template berhasil diperbarui!',
        confirmButtonText: 'OK'
      });
    } else {
      // Add new template
      const newTemplate = { id: Date.now().toString(), name, content };
      templates.push(newTemplate);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Template berhasil ditambahkan!',
        confirmButtonText: 'OK'
      });
    }

    await chrome.storage.local.set({ templates });
    loadTemplates();
    clearTemplateForm();
  }

  async function deleteTemplate() {
    const selectedId = templateSelect.value;
    if (!selectedId) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan!',
        text: 'Pilih template yang ingin dihapus.',
        confirmButtonText: 'OK'
      });
      return;
    }

    Swal.fire({
      title: 'Konfirmasi',
      text: 'Anda yakin ingin menghapus template ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        templates = templates.filter(t => t.id !== selectedId);
        await chrome.storage.local.set({ templates });
        loadTemplates();
        clearTemplateForm();
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Template berhasil dihapus.',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  function useTemplate() {
    const selectedId = templateSelect.value;
    if (!selectedId) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan!',
        text: 'Pilih template yang ingin digunakan.',
        confirmButtonText: 'OK'
      });
      return;
    }
    const selectedTemplate = templates.find(t => t.id === selectedId);
    if (selectedTemplate) {
      manualMessageTextarea.value = selectedTemplate.content;
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

  function handleCsvFile(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        parseCsv(e.target.result);
      };
      reader.readAsText(file);
    }
  }

  function parseCsv(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      messagesToSend = [];
      return;
    }
    const headers = lines.shift().split(',').map(h => h.trim());
    messagesToSend = lines.map(line => {
      const values = line.split(',');
      const message = {};
      headers.forEach((header, index) => {
        message[header] = values[index] ? values[index].trim() : '';
      });
      if (message.number) {
        message.number = normalizePhoneNumber(message.number);
      }
      // Note: CSV import does not currently support attachments directly.
      // Attachments are handled via manual input only.
      return message;
    });
    console.log('Parsed CSV data:', messagesToSend);
    Swal.fire({
      icon: 'success',
      title: 'Berhasil!',
      text: `${messagesToSend.length} pesan dimuat dari CSV.`,
      confirmButtonText: 'OK'
    });
  }

  function prepareAndSendMessages() {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;

    if (selectedMode === 'manual') {
      const numbers = manualNumbersTextarea.value.trim().split('\n').filter(n => n);
      const messageText = manualMessageTextarea.value;
      if (numbers.length === 0 || !messageText) {
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          text: 'Harap berikan nomor dan pesan.',
          confirmButtonText: 'OK'
        });
        return;
      }
      messagesToSend = numbers.map(number => ({
        number: normalizePhoneNumber(number),
        message: messageText,
        // For manual mode, attachment is taken from currentAttachment
        file: currentAttachment ? currentAttachment.name : null
      }));
    } else {
      if (messagesToSend.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          text: 'Harap impor file CSV.',
          confirmButtonText: 'OK'
        });
        return;
      }
      // For CSV mode, attachments are not supported via CSV file itself.
      // If a manual attachment is selected, it will be sent with all CSV messages.
      messagesToSend = messagesToSend.map(msg => ({
        ...msg,
        file: currentAttachment ? currentAttachment.name : null
      }));
    }

    if (messagesToSend.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan!',
        text: 'Tidak ada pesan untuk dikirim.',
        confirmButtonText: 'OK'
      });
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
    if (isSendingActive) {
      document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
      sendMessagesButton.classList.add('hidden');
      progressContainer.classList.remove('hidden');
      cancelSendingButton.classList.remove('hidden');
      resultsContainer.classList.add('hidden'); // Hide results when sending starts
      
      progressText.textContent = `Mengirim ${currentIndex} dari ${totalMessages} pesan...`;
      progressBar.style.width = `${(currentIndex / totalMessages) * 100}%`;
      currentStatus.textContent = `Status: ${status}`;
    } else {
      document.querySelectorAll('.section').forEach(el => el.classList.remove('hidden'));
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
    });
  }

  function setupEventListeners() {
    modeRadios.forEach(radio => radio.addEventListener('change', () => {
      manualModeContainer.classList.toggle('hidden', radio.value !== 'manual');
      csvModeContainer.classList.toggle('hidden', radio.value !== 'csv');
      templateManagementSection.classList.toggle('hidden', radio.value === 'csv'); // Hide template section in CSV mode
      savePopupState(); // Save state when mode changes
    }));

    manualImageAttachmentInput.addEventListener('change', handleImageFileSelect);
    clearImageAttachmentButton.addEventListener('click', () => clearAttachment('image'));
    manualDocumentAttachmentInput.addEventListener('change', handleDocumentFileSelect);
    clearDocumentAttachmentButton.addEventListener('click', () => clearAttachment('document'));
    csvFileInput.addEventListener('change', handleCsvFile);
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
          templateContentTextarea.value = selectedTemplate.content;
          currentEditingTemplateId = selectedId;
          saveTemplateButton.textContent = 'Perbarui Template'; // Change button text
          saveTemplateButton.classList.remove('hidden'); // Ensure save button is visible
          deleteTemplateButton.classList.remove('hidden'); // Show delete button
          useTemplateButton.classList.remove('hidden'); // Show use button
        }
      } else {
        clearTemplateForm(); // This will reset buttons to default (no template selected)
      }
    });
  }

  // --- Message Listener for Progress Updates ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Popup received message:", request); // Added logging
    if (request.action === "updateProgress") {
      updateProgressUI(
        request.status,
        request.currentIndex + 1, // +1 for 1-based indexing in UI
        request.totalMessages,
        request.isSendingActive
      );
    }
  });

  // --- Initialization ---
  setupEventListeners();
  loadPopupState();
  loadTemplates(); // Load templates on popup initialization
  
  // Request initial sending status from background script
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