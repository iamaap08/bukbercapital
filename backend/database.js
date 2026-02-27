const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'data.sqlite');

// Database instance
let db = null;

// Initialize database
async function initializeDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama_karyawan TEXT NOT NULL,
            nomor_undian TEXT UNIQUE NOT NULL,
            perusahaan TEXT NOT NULL,
            is_winner INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS winners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            prize_name TEXT,
            won_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            spin_hash TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_employees_perusahaan ON employees(perusahaan)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_employees_is_winner ON employees(is_winner)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_employees_nomor_undian ON employees(nomor_undian)`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);
    // Default settings if empty
    try {
        const check = db.exec("SELECT * FROM settings WHERE key = 'allowed_companies'");
        if (!check.length || !check[0].values.length) {
            db.run("INSERT INTO settings (key, value) VALUES ('allowed_companies', '[]')");
        }
    } catch (e) { }

    saveDatabase();
    console.log('✅ Database initialized successfully');

    return db;
}

// Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Helper to convert sql.js result to array of objects
function resultToArray(result) {
    if (!result || result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}

// Employee operations
const employeeOps = {
    // Get all employees
    getAll: (filters = {}) => {
        let query = 'SELECT * FROM employees WHERE 1=1';

        if (filters.perusahaan) {
            query += ` AND perusahaan = '${filters.perusahaan.replace(/'/g, "''")}'`;
        }

        if (filters.isWinner !== undefined) {
            query += ` AND is_winner = ${filters.isWinner ? 1 : 0}`;
        }

        query += ' ORDER BY id DESC';

        const result = db.exec(query);
        return resultToArray(result);
    },

    // Get eligible employees (not winners)
    getEligible: (companies = []) => {
        let query = 'SELECT * FROM employees WHERE is_winner = 0';

        if (companies.length > 0) {
            const escaped = companies.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
            query += ` AND perusahaan IN (${escaped})`;
        }

        const result = db.exec(query);
        return resultToArray(result);
    },

    // Get by ID
    getById: (id) => {
        const result = db.exec(`SELECT * FROM employees WHERE id = ${id}`);
        const arr = resultToArray(result);
        return arr.length > 0 ? arr[0] : null;
    },

    // Get by nomor undian
    getByNomorUndian: (nomorUndian) => {
        const result = db.exec(`SELECT * FROM employees WHERE nomor_undian = '${nomorUndian.replace(/'/g, "''")}'`);
        const arr = resultToArray(result);
        return arr.length > 0 ? arr[0] : null;
    },

    // Insert single employee
    insert: (employee) => {
        try {
            db.run(`
                INSERT INTO employees (nama_karyawan, nomor_undian, perusahaan)
                VALUES ('${employee.nama_karyawan.replace(/'/g, "''")}', '${employee.nomor_undian.replace(/'/g, "''")}', '${employee.perusahaan.replace(/'/g, "''")}')
            `);
            saveDatabase();
            return { changes: 1 };
        } catch (e) {
            return { changes: 0, error: e.message };
        }
    },

    // Bulk insert employees
    bulkInsert: (employees) => {
        let inserted = 0;
        let skipped = 0;

        for (const emp of employees) {
            try {
                db.run(`
                    INSERT OR IGNORE INTO employees (nama_karyawan, nomor_undian, perusahaan)
                    VALUES ('${emp.nama_karyawan.replace(/'/g, "''")}', '${emp.nomor_undian.replace(/'/g, "''")}', '${emp.perusahaan.replace(/'/g, "''")}')
                `);

                // Check if insert happened
                const changes = db.getRowsModified();
                if (changes > 0) {
                    inserted++;
                } else {
                    skipped++;
                }
            } catch (e) {
                skipped++;
            }
        }

        saveDatabase();
        return { inserted, skipped };
    },

    // Mark as winner
    markAsWinner: (id) => {
        db.run(`UPDATE employees SET is_winner = 1 WHERE id = ${id}`);
        saveDatabase();
        return { changes: db.getRowsModified() };
    },

    // Delete employee
    delete: (id) => {
        db.run(`DELETE FROM employees WHERE id = ${id}`);
        saveDatabase();
        return { changes: db.getRowsModified() };
    },

    // Clear all employees
    clearAll: () => {
        db.run('DELETE FROM winners');
        db.run('DELETE FROM employees');
        db.run('DELETE FROM companies');
        saveDatabase();
        return { success: true };
    },

    // Get count
    getCount: () => {
        const result = db.exec('SELECT COUNT(*) as count FROM employees');
        const arr = resultToArray(result);
        return arr.length > 0 ? arr[0] : { count: 0 };
    }
};

// Winner operations
const winnerOps = {
    // Get all winners
    getAll: () => {
        const result = db.exec(`
            SELECT w.*, e.nama_karyawan, e.nomor_undian, e.perusahaan
            FROM winners w
            JOIN employees e ON w.employee_id = e.id
            ORDER BY w.won_at ASC
        `);
        return resultToArray(result);
    },

    // Add winner
    add: (employeeId, prizeName, spinHash) => {
        const prizeEscaped = prizeName ? `'${prizeName.replace(/'/g, "''")}'` : 'NULL';
        const hashEscaped = spinHash ? `'${spinHash.replace(/'/g, "''")}'` : 'NULL';

        db.run(`
            INSERT INTO winners (employee_id, prize_name, spin_hash, won_at)
            VALUES (${employeeId}, ${prizeEscaped}, ${hashEscaped}, datetime('now'))
        `);
        saveDatabase();
        return { changes: db.getRowsModified() };
    },

    // Get count
    getCount: () => {
        const result = db.exec('SELECT COUNT(*) as count FROM winners');
        const arr = resultToArray(result);
        return arr.length > 0 ? arr[0] : { count: 0 };
    },

    // Reset all winners (New Session)
    reset: () => {
        try {
            db.run('DELETE FROM winners');
            db.run('UPDATE employees SET is_winner = 0');
            saveDatabase();
            return { changes: db.getRowsModified() };
        } catch (e) {
            throw e;
        }
    }
};

// Company operations
const companyOps = {
    // Get all companies
    getAll: () => {
        const result = db.exec('SELECT * FROM companies WHERE is_active = 1 ORDER BY name');
        return resultToArray(result);
    },

    // Get unique companies from employees
    getFromEmployees: () => {
        const result = db.exec('SELECT DISTINCT perusahaan as name FROM employees ORDER BY perusahaan');
        return resultToArray(result);
    },

    // Add company
    add: (name) => {
        try {
            db.run(`INSERT OR IGNORE INTO companies (name) VALUES ('${name.replace(/'/g, "''")}')`);
            saveDatabase();
            return { changes: db.getRowsModified() };
        } catch (e) {
            return { changes: 0 };
        }
    },

    // Sync companies from employees
    syncFromEmployees: () => {
        const result = db.exec('SELECT DISTINCT perusahaan FROM employees');
        const companies = resultToArray(result);

        for (const c of companies) {
            db.run(`INSERT OR IGNORE INTO companies (name) VALUES ('${c.perusahaan.replace(/'/g, "''")}')`);
        }

        saveDatabase();
        return { synced: companies.length };
    }
};

// Settings operations
const settingsOps = {
    get: (key) => {
        try {
            const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
            const result = stmt.getAsObject([key]);
            stmt.free();
            return result.value ? JSON.parse(result.value) : null;
        } catch (e) { return null; }
    },
    set: (key, value) => {
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
        saveDatabase();
        return true;
    }
};

module.exports = {
    settingsOps,
    initializeDatabase,
    saveDatabase,
    employeeOps,
    winnerOps,
    companyOps,
    getDb: () => db
};
