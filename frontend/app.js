/**
 * LUCKY SPIN WHEEL - FRONTEND APP
 * Redesigned: 13 Digit Boxes for Phone Number Draw
 */

// API Configuration
const API_BASE = window.location.origin + '/api';

// State
let companies = [];
let selectedCompanies = [];
let isSpinning = false;
let stats = {
    eligible: 0,
    winners: 0
};
let spinIntervals = [];
let currentWinner = null;
let currentPrizeName = null;
let isStopping = false;

// Characters for spinning animation
const CHARS = '0123456789';
const TOTAL_BOXES = 13;

// DOM Elements
const elements = {
    companyCheckboxes: document.getElementById('companyCheckboxes'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    spinBtn: document.getElementById('spinBtn'),
    viewWinnersBtn: document.getElementById('viewWinnersBtn'),
    winnerModal: document.getElementById('winnerModal'),
    modalWinnerText: document.getElementById('modalWinnerText'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    goToWinnersBtn: document.getElementById('goToWinnersBtn'),
    sep1: document.getElementById('sep1'),
    sep2: document.getElementById('sep2'),
    confettiCanvas: document.getElementById('confettiCanvas'),
    boxes: Array.from({ length: TOTAL_BOXES }, (_, i) => document.getElementById(`box${i + 1}`))
};

// ============================================
// API FUNCTIONS
// ============================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

async function loadCompanies() {
    const result = await fetchAPI('/companies');
    if (result.success && result.data) {
        companies = result.data.map(c => c.name);
        renderCompanyCheckboxes();
    }
}

async function loadStats() {
    const result = await fetchAPI('/stats');
    if (result.success && result.stats) {
        stats = {
            eligible: result.stats.totalEligible,
            winners: result.stats.totalWinners
        };
    }
}

async function loadEligibleCount() {
    const companiesParam = selectedCompanies.length > 0
        ? `?companies=${selectedCompanies.join(',')}`
        : '';

    const result = await fetchAPI(`/employees/eligible${companiesParam}`);
    if (result.success) {
        stats.eligible = result.total;
    }
}

async function executeSpin() {
    const result = await fetchAPI('/spin', {
        method: 'POST',
        body: JSON.stringify({
            companies: selectedCompanies
        })
    });
    return result;
}

async function syncSettings() {
    if (isSpinning) return;
    const result = await fetchAPI('/settings/companies');
    if (result.success) {
        const allowed = result.data;
        // If allowed is set (length > 0), use it. Else use all companies (if we have them).
        if (allowed && allowed.length > 0) {
            selectedCompanies = allowed;
        } else if (companies.length > 0) {
            selectedCompanies = [...companies];
        }
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function renderCompanyCheckboxes() {
    if (companies.length === 0) {
        elements.companyCheckboxes.innerHTML = `
            <div class="no-data">
                <p>Belum ada data. <a href="admin/admin.html">Import di Admin →</a></p>
            </div>
        `;
        return;
    }

    elements.companyCheckboxes.innerHTML = companies.map(company => `
        <label class="company-checkbox">
            <input type="checkbox" value="${company}" checked>
            <span>${company}</span>
        </label>
    `).join('');

    // Add event listeners
    const checkboxes = elements.companyCheckboxes.querySelectorAll('input');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', handleCompanyChange);
    });

    // Initially select all
    selectedCompanies = [...companies];
    loadEligibleCount();
}

function handleCompanyChange() {
    const checkboxes = elements.companyCheckboxes.querySelectorAll('input:checked');
    selectedCompanies = Array.from(checkboxes).map(cb => cb.value);
    loadEligibleCount();
}

function selectAllCompanies() {
    const checkboxes = elements.companyCheckboxes.querySelectorAll('input');
    checkboxes.forEach(cb => cb.checked = true);
    selectedCompanies = [...companies];
    loadEligibleCount();
}

function deselectAllCompanies() {
    const checkboxes = elements.companyCheckboxes.querySelectorAll('input');
    checkboxes.forEach(cb => cb.checked = false);
    selectedCompanies = [];
    loadEligibleCount();
}



function setBoxValue(index, value) {
    const box = elements.boxes[index];
    if (box) {
        box.querySelector('.combo-value').textContent = value;
    }
}

function setAllBoxesValue(code) {
    if (code) {
        // Pad code to TOTAL_BOXES length if shorter
        const padded = code.padEnd(TOTAL_BOXES, '?');
        for (let i = 0; i < TOTAL_BOXES; i++) {
            setBoxValue(i, padded[i] || '?');
        }
    }
}

function resetBoxes() {
    elements.boxes.forEach(box => {
        box.querySelector('.combo-value').textContent = '?';
        box.classList.remove('winner', 'spinning', 'hidden-box');
        box.style.display = '';
        box.style.opacity = '';
        box.style.transform = '';
    });
    // Restore separators
    if (elements.sep1) elements.sep1.style.display = '';
    if (elements.sep2) elements.sep2.style.display = '';
}

function getRandomChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
}

// ============================================
// SPIN ANIMATION - 4 BOXES SPINNING
// ============================================

async function toggleSpin() {
    if (isStopping) return; // Ignore clicks during stop sequence

    if (!isSpinning) {
        // STATE: START SPINNING
        if (stats.eligible === 0) {
            alert('Tidak ada peserta yang eligible untuk diundi! Pastikan sudah import data di Admin Panel.');
            return;
        }

        // UI Update to "STOP" state
        isSpinning = true;
        elements.spinBtn.classList.add('stop');
        elements.spinBtn.innerHTML = `
            <span class="btn-icon">🛑</span>
            <span class="btn-text">STOP!</span>
        `;

        resetBoxes();

        // Start spinning animation on all boxes
        elements.boxes.forEach(box => box.classList.add('spinning'));

        // Spinning interval - randomly change characters
        spinIntervals = elements.boxes.map((box, i) => {
            return setInterval(() => {
                setBoxValue(i, getRandomChar());
            }, 50 + (i * 10));
        });

        try {
            // Execute spin on backend immediately to get winner
            const result = await executeSpin();

            if (!result.success) {
                throw new Error(result.error || 'Gagal melakukan spin');
            }

            currentWinner = result.winner;
            currentPrizeName = result.prizeName;

        } catch (error) {
            console.error('Spin error:', error);
            alert('Error: ' + error.message);
            stopSpinNow(true); // Force stop on error
        }

    } else {
        // STATE: STOP SPINNING (MANUAL TRIGGER)
        if (!currentWinner) {
            // Winner not ready yet (network delay), show loading or wait
            // We just keep spinning until winner arrives
            return;
        }

        isStopping = true;
        elements.spinBtn.disabled = true; // Disable button during reveal

        const winnerCode = currentWinner.nomor_undian;
        const codeLen = winnerCode.length;

        // Stop boxes one by one with delay (slot machine effect)
        // Only reveal boxes up to the winner code length
        for (let i = 0; i < codeLen; i++) {
            await sleep(300 + (i * 60));

            // Stop this box's interval
            if (spinIntervals[i]) clearInterval(spinIntervals[i]);

            // Set final value with animation
            elements.boxes[i].classList.remove('spinning');
            setBoxValue(i, winnerCode[i]);
            elements.boxes[i].classList.add('winner');

            // Play a subtle effect
            elements.boxes[i].style.transform = 'scale(1.1)';
            await sleep(80);
            elements.boxes[i].style.transform = '';
        }

        // Hide unused boxes (beyond winner code length) with fade-out
        for (let i = codeLen; i < TOTAL_BOXES; i++) {
            if (spinIntervals[i]) clearInterval(spinIntervals[i]);
            elements.boxes[i].classList.remove('spinning');
            elements.boxes[i].style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            elements.boxes[i].style.opacity = '0';
            elements.boxes[i].style.transform = 'scale(0.5)';
        }

        // Hide separator 2 if code is shorter than 9 digits (no group 3)
        if (codeLen <= 8 && elements.sep2) {
            elements.sep2.style.transition = 'opacity 0.3s ease';
            elements.sep2.style.opacity = '0';
        }
        // Hide separator 1 if code is shorter than 5 digits (no group 2)
        if (codeLen <= 4 && elements.sep1) {
            elements.sep1.style.transition = 'opacity 0.3s ease';
            elements.sep1.style.opacity = '0';
        }

        // After fade, fully hide unused boxes
        await sleep(400);
        for (let i = codeLen; i < TOTAL_BOXES; i++) {
            elements.boxes[i].style.display = 'none';
        }
        if (codeLen <= 8 && elements.sep2) elements.sep2.style.display = 'none';
        if (codeLen <= 4 && elements.sep1) elements.sep1.style.display = 'none';

        // Show winner modal after all boxes revealed
        await sleep(600);
        showWinnerModal(currentWinner, currentPrizeName);

        // Reset State
        isSpinning = false;
        isStopping = false;
        currentWinner = null;
        currentPrizeName = null;

        // Reset Button UI
        elements.spinBtn.disabled = false;
        elements.spinBtn.classList.remove('stop');
        elements.spinBtn.innerHTML = `
            <span class="btn-icon">🎲</span>
            <span class="btn-text">PUTAR UNDIAN</span>
        `;

        // Refresh stats
        loadStats();
        loadEligibleCount();
    }
}

function stopSpinNow(isError = false) {
    // Helper to force stop (e.g. on error)
    spinIntervals.forEach(interval => clearInterval(interval));
    spinIntervals = [];
    isSpinning = false;
    isStopping = false;
    currentWinner = null;
    currentPrizeName = null;
    elements.boxes.forEach(box => {
        box.classList.remove('spinning', 'winner', 'hidden-box');
        box.style.display = '';
        box.style.opacity = '';
        box.style.transform = '';
    });
    if (elements.sep1) { elements.sep1.style.display = ''; elements.sep1.style.opacity = ''; }
    if (elements.sep2) { elements.sep2.style.display = ''; elements.sep2.style.opacity = ''; }

    elements.spinBtn.disabled = false;
    elements.spinBtn.classList.remove('stop');
    elements.spinBtn.innerHTML = `
            <span class="btn-icon">🎲</span>
            <span class="btn-text">PUTAR UNDIAN</span>
        `;
}

function formatPhoneNumber(number) {
    // Format: xxxx-xxxx-xxxxx
    if (!number) return number;
    const clean = number.replace(/\D/g, '');
    if (clean.length <= 4) return clean;
    if (clean.length <= 8) return clean.slice(0, 4) + '-' + clean.slice(4);
    return clean.slice(0, 4) + '-' + clean.slice(4, 8) + '-' + clean.slice(8);
}

function showWinnerModal(winner, prize) {
    const formattedPhone = formatPhoneNumber(winner.nomor_undian);
    const prizeText = prize ? ` MENDAPATKAN <span class="winner-hl">${prize}</span>` : '';

    elements.modalWinnerText.innerHTML = `SELAMAT <span class="phone-hl" style="display: block; font-size: 4rem; font-weight: 800; color: var(--accent-gold); text-shadow: 0 0 15px rgba(255, 215, 0, 0.4); margin: 1.5rem 0; letter-spacing: 2px;">${formattedPhone}</span> ATAS NAMA <span class="winner-hl">${winner.nama_karyawan}</span> DARI <span class="winner-hl">${winner.perusahaan}</span>${prizeText}`;

    elements.winnerModal.classList.add('active');

    // Start confetti
    startConfetti();
}

function closeWinnerModal() {
    elements.winnerModal.classList.remove('active');
    stopConfetti();
}

// ============================================
// CONFETTI ANIMATION
// ============================================

let confettiAnimationId = null;
let confettiParticles = [];

function startConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#ffd700', '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff8c00'];

    // Create particles
    for (let i = 0; i < 200; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 12 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 4 + 2,
            speedX: Math.random() * 3 - 1.5,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 12 - 6
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettiParticles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();

            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            if (p.y > canvas.height) {
                p.y = -p.size;
                p.x = Math.random() * canvas.width;
            }
        });

        confettiAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }

    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiParticles = [];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function goToWinners() {
    window.location.href = 'winners.html';
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadCompanies();
    loadStats();

    // Button events
    elements.spinBtn.addEventListener('click', toggleSpin);
    elements.viewWinnersBtn.addEventListener('click', goToWinners);
    elements.selectAllBtn.addEventListener('click', selectAllCompanies);
    elements.deselectAllBtn.addEventListener('click', deselectAllCompanies);
    elements.closeModalBtn.addEventListener('click', closeWinnerModal);
    elements.goToWinnersBtn.addEventListener('click', () => {
        closeWinnerModal();
        goToWinners();
    });

    // Close modal on outside click
    elements.winnerModal.addEventListener('click', (e) => {
        if (e.target === elements.winnerModal) {
            closeWinnerModal();
        }
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeWinnerModal();
        }
        if ((e.key === ' ' || e.key === 'Enter') && !isSpinning) {
            if (!elements.winnerModal.classList.contains('active')) {
                e.preventDefault();
                toggleSpin();
            }
        }
    });

    // Handle window resize for confetti
    window.addEventListener('resize', () => {
        if (confettiAnimationId) {
            elements.confettiCanvas.width = window.innerWidth;
            elements.confettiCanvas.height = window.innerHeight;
        }
    });

    // Initial sync
    syncSettings().then(() => loadEligibleCount());
});

// Auto-refresh stats every 5 seconds (faster to catch settings changes)
setInterval(() => {
    if (!isSpinning) {
        loadStats();
        syncSettings().then(() => loadEligibleCount());
    }
}, 5000);
