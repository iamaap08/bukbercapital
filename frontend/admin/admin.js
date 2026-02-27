/**
 * ADMIN PANEL - APPLICATION LOGIC
 */

const API_BASE = window.location.origin + '/api';

// State
let employees = [];
let companies = [];
let currentFile = null;
let previewData = null;

// DOM Elements
const elements = {
    // Stats
    statTotal: document.getElementById('statTotal'),
    statEligible: document.getElementById('statEligible'),
    statWinners: document.getElementById('statWinners'),
    statCompanies: document.getElementById('statCompanies'),

    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    tabImport: document.getElementById('tab-import'),
    tabEmployees: document.getElementById('tab-employees'),
    tabFilter: document.getElementById('tab-filter'),

    // Upload
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),

    // Preview
    previewSection: document.getElementById('previewSection'),
    previewValid: document.getElementById('previewValid'),
    previewDuplicate: document.getElementById('previewDuplicate'),
    previewError: document.getElementById('previewError'),
    previewBody: document.getElementById('previewBody'),
    cancelImportBtn: document.getElementById('cancelImportBtn'),
    confirmImportBtn: document.getElementById('confirmImportBtn'),

    // Import Result
    importResult: document.getElementById('importResult'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    importAnotherBtn: document.getElementById('importAnotherBtn'),

    // Employees Table
    searchInput: document.getElementById('searchInput'),
    filterCompany: document.getElementById('filterCompany'),
    filterStatus: document.getElementById('filterStatus'),
    resetWinnersBtn: document.getElementById('resetWinnersBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    employeeBody: document.getElementById('employeeBody'),
    showingInfo: document.getElementById('showingInfo'),

    showingInfo: document.getElementById('showingInfo'),

    // Filter Tab
    companyFilterList: document.getElementById('companyFilterList'),
    saveFilterBtn: document.getElementById('saveFilterBtn'),
    filterSelectAllBtn: document.getElementById('filterSelectAllBtn'),
    filterDeselectAllBtn: document.getElementById('filterDeselectAllBtn'),

    // Modal
    confirmModal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),

    // Prizes Tab
    prizeUploadArea: document.getElementById('prizeUploadArea'),
    prizeFileInput: document.getElementById('prizeFileInput'),
    prizeImportResult: document.getElementById('prizeImportResult'),
    prizeResultIcon: document.getElementById('prizeResultIcon'),
    prizeResultTitle: document.getElementById('prizeResultTitle'),
    prizeResultMessage: document.getElementById('prizeResultMessage'),
    prizesTableBody: document.getElementById('prizesTableBody'),
    prizesCount: document.getElementById('prizesCount')
};

// ============================================
// API FUNCTIONS
// ============================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

async function loadStats() {
    const result = await fetchAPI('/stats');
    if (result.success) {
        elements.statTotal.textContent = result.stats.totalEmployees;
        elements.statEligible.textContent = result.stats.totalEligible;
        elements.statWinners.textContent = result.stats.totalWinners;
        elements.statCompanies.textContent = result.stats.totalCompanies;
    }
}

async function loadCompanies() {
    const result = await fetchAPI('/companies');
    if (result.success) {
        companies = result.data.map(c => c.name);
        renderCompanyFilter();
    }
}

async function loadEmployees() {
    const params = new URLSearchParams();

    if (elements.filterCompany.value) {
        params.append('perusahaan', elements.filterCompany.value);
    }
    if (elements.filterStatus.value) {
        params.append('isWinner', elements.filterStatus.value === '1' ? 'true' : 'false');
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/employees?${queryString}` : '/employees';

    const result = await fetchAPI(endpoint);
    if (result.success) {
        employees = result.data;
        renderEmployees();
    }
}

async function deleteEmployee(id) {
    const result = await fetchAPI(`/employees/${id}`, { method: 'DELETE' });
    if (result.success) {
        loadEmployees();
        loadStats();
    } else {
        alert('Gagal menghapus: ' + result.error);
    }
}

async function clearAllEmployees() {
    const result = await fetchAPI('/employees/clear/all', { method: 'DELETE' });
    if (result.success) {
        loadEmployees();
        loadStats();
        loadCompanies();
    } else {
        alert('Gagal menghapus: ' + result.error);
    }
}

async function resetWinners() {
    const result = await fetchAPI('/winners/reset', { method: 'POST' });
    if (result.success) {
        loadEmployees();
        loadStats();
        alert('Daftar pemenang berhasil di-reset! Semua karyawan kembali eligible.');
    } else {
        alert('Gagal mereset: ' + result.error);
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

async function previewFile(file) {
    showProgress();

    const formData = new FormData();
    formData.append('file', file);

    try {
        updateProgress(30, 'Membaca file...');

        const response = await fetch(`${API_BASE}/employees/preview`, {
            method: 'POST',
            body: formData
        });

        updateProgress(70, 'Memproses data...');

        const result = await response.json();

        updateProgress(100, 'Selesai!');

        await sleep(500);

        if (result.success) {
            previewData = result;
            showPreview(result);
        } else {
            showResult(false, 'Gagal Memproses File', result.error || 'Format file tidak valid');
        }
    } catch (error) {
        showResult(false, 'Error', error.message);
    }
}

async function confirmImport() {
    if (!currentFile) return;

    showProgress();

    const formData = new FormData();
    formData.append('file', currentFile);

    try {
        updateProgress(30, 'Mengupload file...');

        const response = await fetch(`${API_BASE}/employees/import`, {
            method: 'POST',
            body: formData
        });

        updateProgress(70, 'Menyimpan data...');

        const result = await response.json();

        updateProgress(100, 'Selesai!');

        await sleep(500);

        if (result.success) {
            showResult(
                true,
                'Import Berhasil!',
                `${result.stats.inserted} data berhasil diimport, ${result.stats.skipped} dilewati`
            );
            loadStats();
            loadCompanies();
            loadEmployees();
        } else {
            showResult(false, 'Import Gagal', result.error);
        }
    } catch (error) {
        showResult(false, 'Error', error.message);
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function switchTab(tabName) {
    // Update nav items
    elements.navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Load data if employees tab
    if (tabName === 'employees') {
        loadEmployees();
    }
    if (tabName === 'filter') {
        loadFilterSettings();
    }
    if (tabName === 'prizes') {
        loadPrizes();
    }
}

async function loadFilterSettings() {
    // Ensure companies are loaded
    if (companies.length === 0) await loadCompanies();

    // Load settings
    const result = await fetchAPI('/settings/companies');
    let allowed = [];
    if (result.success) {
        allowed = result.data;
    }

    const isAllByDefault = allowed.length === 0;

    const html = companies.map(company => {
        const isChecked = isAllByDefault || allowed.includes(company);
        return `
            <label class="company-checkbox" style="display: flex; align-items: center; gap: 0.5rem; color: white; cursor: pointer; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <input type="checkbox" value="${company}" ${isChecked ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-gold);">
                <span style="font-size: 1rem;">${company}</span>
            </label>
        `;
    }).join('');

    elements.companyFilterList.innerHTML = html;
}

async function saveFilterSettings() {
    const checkboxes = elements.companyFilterList.querySelectorAll('input:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);

    const result = await fetchAPI('/settings/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: selected })
    });

    if (result.success) {
        alert('Pengaturan filter berhasil disimpan! Halaman undian akan menggunakan filter ini.');
    } else {
        alert('Gagal menyimpan: ' + result.error);
    }
}

// ============================================
// PRIZES EXCEL IMPORT FUNCTIONS
// ============================================

async function loadPrizes() {
    const result = await fetchAPI('/settings/prizes');
    if (result.success && result.data) {
        renderPrizesTable(result.data);
    }
}

function renderPrizesTable(prizes) {
    if (!prizes || prizes.length === 0) {
        elements.prizesTableBody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; color: var(--text-muted);">Belum ada data hadiah</td>
            </tr>
        `;
        elements.prizesCount.textContent = '0';
        return;
    }

    elements.prizesTableBody.innerHTML = prizes.map((prize, idx) => `
        <tr>
            <td style="text-align: center; font-variant-numeric: tabular-nums;">${idx + 1}</td>
            <td style="font-weight: 500;">${prize}</td>
        </tr>
    `).join('');

    elements.prizesCount.textContent = prizes.length;
}

async function handlePrizeUpload(file) {
    if (!file) return;

    elements.prizeUploadArea.classList.add('loading');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/settings/prizes/import`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        elements.prizeUploadArea.classList.remove('loading');

        elements.prizeImportResult.classList.remove('hidden');
        if (result.success) {
            elements.prizeResultIcon.textContent = '✅';
            elements.prizeResultTitle.textContent = 'Import Berhasil!';
            elements.prizeResultMessage.textContent = result.message;
            loadPrizes();
        } else {
            elements.prizeResultIcon.textContent = '❌';
            elements.prizeResultTitle.textContent = 'Import Gagal';
            elements.prizeResultMessage.textContent = result.error;
        }

        setTimeout(() => {
            elements.prizeImportResult.classList.add('hidden');
        }, 5000);

    } catch (error) {
        elements.prizeUploadArea.classList.remove('loading');
        elements.prizeImportResult.classList.remove('hidden');
        elements.prizeResultIcon.textContent = '❌';
        elements.prizeResultTitle.textContent = 'Error';
        elements.prizeResultMessage.textContent = error.message;
    }
}

function showProgress() {
    elements.uploadZone.classList.add('hidden');
    elements.previewSection.classList.add('hidden');
    elements.importResult.classList.add('hidden');
    elements.uploadProgress.classList.remove('hidden');
    elements.progressFill.style.width = '0%';
}

function updateProgress(percent, text) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = text;
}

function showPreview(data) {
    elements.uploadProgress.classList.add('hidden');
    elements.previewSection.classList.remove('hidden');

    elements.previewValid.textContent = `${data.stats.validCount} Valid`;
    elements.previewDuplicate.textContent = `${data.stats.duplicateCount} Duplikat`;
    elements.previewError.textContent = `${data.stats.errorCount} Error`;

    // Render preview table
    elements.previewBody.innerHTML = data.sampleData.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.nama_karyawan}</td>
            <td style="font-weight: 700; color: var(--accent-gold); letter-spacing: 2px;">${item.nomor_undian}</td>
            <td>${item.perusahaan}</td>
        </tr>
    `).join('');

    if (data.sampleData.length < data.stats.validCount) {
        elements.previewBody.innerHTML += `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted);">
                    ... dan ${data.stats.validCount - data.sampleData.length} data lainnya
                </td>
            </tr>
        `;
    }
}

function showResult(success, title, message) {
    elements.uploadProgress.classList.add('hidden');
    elements.previewSection.classList.add('hidden');
    elements.importResult.classList.remove('hidden');

    elements.resultIcon.textContent = success ? '✅' : '❌';
    elements.resultTitle.textContent = title;
    elements.resultMessage.textContent = message;

    currentFile = null;
    previewData = null;
}

function resetUpload() {
    elements.uploadZone.classList.remove('hidden');
    elements.uploadProgress.classList.add('hidden');
    elements.previewSection.classList.add('hidden');
    elements.importResult.classList.add('hidden');
    elements.fileInput.value = '';
    currentFile = null;
    previewData = null;
}

function renderCompanyFilter() {
    const options = ['<option value="">Semua Perusahaan</option>'];
    companies.forEach(company => {
        options.push(`<option value="${company}">${company}</option>`);
    });
    elements.filterCompany.innerHTML = options.join('');
}

function renderEmployees() {
    const searchTerm = elements.searchInput.value.toLowerCase();

    let filtered = employees;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(emp =>
            emp.nama_karyawan.toLowerCase().includes(searchTerm) ||
            emp.nomor_undian.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        elements.employeeBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <div>Tidak ada data karyawan</div>
                </td>
            </tr>
        `;
    } else {
        elements.employeeBody.innerHTML = filtered.map((emp, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${emp.nama_karyawan}</td>
                <td class="nomor-undian">${emp.nomor_undian}</td>
                <td>${emp.perusahaan}</td>
                <td>
                    <span class="status-badge ${emp.is_winner ? 'winner' : 'eligible'}">
                        ${emp.is_winner ? '🏆 Pemenang' : '✓ Eligible'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="confirmDelete(${emp.id}, '${emp.nama_karyawan}')" title="Hapus">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    }

    elements.showingInfo.textContent = `Menampilkan ${filtered.length} dari ${employees.length} data`;
}

function showModal(title, message, onConfirm) {
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.confirmModal.classList.add('active');

    elements.modalConfirmBtn.onclick = () => {
        elements.confirmModal.classList.remove('active');
        onConfirm();
    };
}

function hideModal() {
    elements.confirmModal.classList.remove('active');
}

function confirmDelete(id, name) {
    showModal(
        'Hapus Karyawan',
        `Apakah Anda yakin ingin menghapus "${name}"?`,
        () => deleteEmployee(id)
    );
}

function confirmClearAll() {
    showModal(
        'Hapus Semua Data',
        'Apakah Anda yakin ingin menghapus SEMUA data karyawan dan pemenang? Tindakan ini tidak dapat dibatalkan!',
        () => clearAllEmployees()
    );
}

function confirmResetWinners() {
    showModal(
        'Reset Pemenang',
        'Apakah Anda yakin ingin mereset daftar pemenang? Semua status pemenang akan dihapus dan karyawan bisa menang lagi.',
        () => resetWinners()
    );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadStats();
    loadCompanies();

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });

    // Upload zone click
    elements.uploadZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // File input change
    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFile = file;
            previewFile(file);
        }
    });

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('dragover');
    });

    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('dragover');
    });

    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            currentFile = file;
            previewFile(file);
        } else {
            alert('Hanya file Excel (.xlsx, .xls) yang diizinkan');
        }
    });

    // Preview actions
    elements.cancelImportBtn.addEventListener('click', resetUpload);
    elements.confirmImportBtn.addEventListener('click', confirmImport);
    elements.importAnotherBtn.addEventListener('click', resetUpload);

    // Filter Tab Actions
    if (elements.saveFilterBtn) {
        elements.saveFilterBtn.addEventListener('click', saveFilterSettings);
        elements.filterSelectAllBtn.addEventListener('click', () => {
            elements.companyFilterList.querySelectorAll('input').forEach(cb => cb.checked = true);
        });
        elements.filterDeselectAllBtn.addEventListener('click', () => {
            elements.companyFilterList.querySelectorAll('input').forEach(cb => cb.checked = false);
        });
    }

    // Prizes Tab Actions
    if (elements.prizeUploadArea) {
        elements.prizeUploadArea.addEventListener('click', () => {
            elements.prizeFileInput.click();
        });

        elements.prizeFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handlePrizeUpload(file);
        });

        elements.prizeUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.prizeUploadArea.classList.add('dragover');
        });

        elements.prizeUploadArea.addEventListener('dragleave', () => {
            elements.prizeUploadArea.classList.remove('dragover');
        });

        elements.prizeUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.prizeUploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                handlePrizeUpload(file);
            } else {
                alert('Hanya file Excel (.xlsx, .xls) yang diizinkan');
            }
        });
    }

    // Search and filters
    elements.searchInput.addEventListener('input', renderEmployees);
    elements.filterCompany.addEventListener('change', loadEmployees);
    elements.filterStatus.addEventListener('change', loadEmployees);

    // Clear all
    elements.resetWinnersBtn.addEventListener('click', confirmResetWinners);
    elements.clearAllBtn.addEventListener('click', confirmClearAll);

    // Modal
    elements.modalCancelBtn.addEventListener('click', hideModal);
    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) {
            hideModal();
        }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal();
        }
    });
});

// Auto-refresh stats every 30 seconds
setInterval(loadStats, 30000);
