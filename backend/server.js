const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import modules
const { initializeDatabase, employeeOps, winnerOps, companyOps, settingsOps } = require('./database');
const spinAlgorithm = require('./spinAlgorithm');
const excelImporter = require('./excelImporter');
const prizeImporter = require('./prizeImporter');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel (.xlsx, .xls) yang diizinkan'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    }
});

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Lucky Spin Wheel Backend is running!'
    });
});

// --------------------------------------------
// EMPLOYEE ENDPOINTS
// --------------------------------------------

// Get all employees
app.get('/api/employees', (req, res) => {
    try {
        const filters = {
            perusahaan: req.query.perusahaan,
            isWinner: req.query.isWinner === 'true' ? true :
                req.query.isWinner === 'false' ? false : undefined
        };

        const employees = employeeOps.getAll(filters);
        const count = employeeOps.getCount();

        res.json({
            success: true,
            data: employees,
            total: count.count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get eligible employees (not winners)
app.get('/api/employees/eligible', (req, res) => {
    try {
        let companies = [];
        if (req.query.companies) {
            companies = req.query.companies.split(',').filter(c => c.trim());
        }

        const eligible = employeeOps.getEligible(companies);

        res.json({
            success: true,
            data: eligible,
            total: eligible.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Preview Excel import
app.post('/api/employees/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Tidak ada file yang diupload'
            });
        }

        const result = await excelImporter.preview(req.file.path);

        // Clean up uploaded file after preview
        fs.unlinkSync(req.file.path);

        res.json(result);
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Import employees from Excel
app.post('/api/employees/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Tidak ada file yang diupload'
            });
        }

        // Parse and validate Excel
        const importResult = await excelImporter.import(req.file.path);

        if (!importResult.success) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json(importResult);
        }

        // Insert to database
        const dbResult = employeeOps.bulkInsert(importResult.data);

        // Sync companies
        companyOps.syncFromEmployees();

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: 'Import berhasil',
            stats: {
                ...importResult.stats,
                inserted: dbResult.inserted,
                skipped: dbResult.skipped
            },
            companies: importResult.companies,
            errors: importResult.errors,
            duplicates: importResult.duplicates
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Import prizes
app.post('/api/settings/prizes/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Tidak ada file yang diupload'
            });
        }

        const parseResult = prizeImporter.parseExcel(req.file.path);
        if (!parseResult.success) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json(parseResult);
        }

        const columns = prizeImporter.detectColumns(parseResult.headers);
        if (!columns.complete) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Kolom "Hadiah" wajib ada di file Excel.'
            });
        }

        const dataResult = prizeImporter.transformData(parseResult.rows, columns.mapping);
        if (!dataResult.success) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json(dataResult);
        }

        // Save imported prizes
        settingsOps.set('prizes', dataResult.prizes);

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: `Berhasil mengimpor ${dataResult.prizes.length} daftar hadiah!`,
            prizesCount: dataResult.prizes.length
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete employee
app.delete('/api/employees/:id', (req, res) => {
    try {
        const result = employeeOps.delete(parseInt(req.params.id));

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Karyawan tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Karyawan berhasil dihapus'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear all data
app.delete('/api/employees/clear/all', (req, res) => {
    try {
        employeeOps.clearAll();
        res.json({
            success: true,
            message: 'Semua data berhasil dihapus'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --------------------------------------------
// SPIN ENDPOINTS
// --------------------------------------------

// Execute spin
app.post('/api/spin', (req, res) => {
    try {
        let companies = [];
        if (req.body.companies && Array.isArray(req.body.companies)) {
            companies = req.body.companies.filter(c => c && c.trim());
        }

        let prizeName = req.body.prizeName || null;

        // Get sequential prize from settings based on current winner count
        const prizes = settingsOps.get('prizes') || [];
        if (prizes.length > 0) {
            const currentWinnerCount = winnerOps.getCount().count;
            if (currentWinnerCount < prizes.length) {
                prizeName = prizes[currentWinnerCount];
            }
        }

        // Get eligible participants
        const eligible = employeeOps.getEligible(companies);

        if (eligible.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tidak ada peserta yang eligible untuk spin'
            });
        }

        // Generate animation sequence
        const animationSequence = spinAlgorithm.generateAnimationSequence(eligible, 30);

        // Execute complex spin algorithm
        const spinResult = spinAlgorithm.spin(eligible);

        if (!spinResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Gagal menjalankan algoritma spin'
            });
        }

        // Mark winner in database
        employeeOps.markAsWinner(spinResult.winner.id);

        // Record winner
        winnerOps.add(spinResult.winner.id, prizeName, spinResult.spinHash);

        res.json({
            success: true,
            winner: spinResult.winner,
            animationSequence: animationSequence,
            spinHash: spinResult.spinHash,
            prizeName: prizeName,
            metadata: spinResult.metadata
        });
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get animation sequence only (for preview)
app.get('/api/spin/animation', (req, res) => {
    try {
        let companies = [];
        if (req.query.companies) {
            companies = req.query.companies.split(',').filter(c => c.trim());
        }

        const eligible = employeeOps.getEligible(companies);

        if (eligible.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tidak ada peserta yang eligible'
            });
        }

        const sequence = spinAlgorithm.generateAnimationSequence(eligible, 30);

        res.json({
            success: true,
            sequence: sequence,
            participantCount: eligible.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --------------------------------------------
// WINNER ENDPOINTS
// --------------------------------------------

// Get all winners
app.get('/api/winners', (req, res) => {
    try {
        const winners = winnerOps.getAll();
        const count = winnerOps.getCount();

        res.json({
            success: true,
            data: winners,
            total: count.count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reset winners
app.post('/api/winners/reset', (req, res) => {
    try {
        winnerOps.reset();
        res.json({
            success: true,
            message: 'Daftar pemenang berhasil di-reset'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --------------------------------------------
// COMPANY ENDPOINTS
// --------------------------------------------

// Get all companies
app.get('/api/companies', (req, res) => {
    try {
        // Get companies from employees table
        const companies = companyOps.getFromEmployees();

        res.json({
            success: true,
            data: companies
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --------------------------------------------
// STATS ENDPOINT
// --------------------------------------------

app.get('/api/stats', (req, res) => {
    try {
        const employeeCount = employeeOps.getCount();
        const winnerCount = winnerOps.getCount();
        const companies = companyOps.getFromEmployees();
        const eligible = employeeOps.getEligible([]);

        res.json({
            success: true,
            stats: {
                totalEmployees: employeeCount.count,
                totalWinners: winnerCount.count,
                totalEligible: eligible.length,
                totalCompanies: companies.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --------------------------------------------
// SETTINGS ENDPOINTS
// --------------------------------------------

app.get('/api/settings/companies', (req, res) => {
    try {
        const allowed = settingsOps.get('allowed_companies');
        res.json({ success: true, data: allowed || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/settings/companies', (req, res) => {
    try {
        const companies = req.body.companies || [];
        settingsOps.set('allowed_companies', companies);
        res.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/settings/prizes', (req, res) => {
    try {
        const prizes = settingsOps.get('prizes');
        res.json({ success: true, data: prizes || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/settings/prizes', (req, res) => {
    try {
        const prizes = req.body.prizes || [];
        settingsOps.set('prizes', prizes);
        res.json({ success: true, message: 'Prize settings saved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint tidak ditemukan'
    });
});



// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        // Initialize database first
        await initializeDatabase();

        // Start server
        app.listen(PORT, () => {
            console.log('');
            console.log('🎰 ═══════════════════════════════════════════════');
            console.log('🎰   LUCKY SPIN WHEEL SERVER');
            console.log('🎰 ═══════════════════════════════════════════════');
            console.log(`🌐 Server running at: http://localhost:${PORT}`);
            console.log(`📂 Frontend: http://localhost:${PORT}`);
            console.log(`🔧 Admin: http://localhost:${PORT}/admin/admin.html`);
            console.log(`📡 API: http://localhost:${PORT}/api`);
            console.log('🎰 ═══════════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
