const XLSX = require('xlsx');
const path = require('path');

/**
 * BASIC EXCEL IMPORTER
 * Reads blindly from row 2 (index 1) onwards.
 * Col A = Nama, Col B = Nomor, Col C = Perusahaan
 */

class ExcelImporter {
    /**
     * Parse Excel file and return structured data
     */
    parseExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON (array of arrays to guarantee column order A,B,C)
            const rawData = XLSX.utils.sheet_to_json(sheet, {
                header: 1, // Returns 2D array
                defval: ''
            });

            if (rawData.length < 2) {
                throw new Error('File Excel kosong atau hanya memiliki header');
            }

            return {
                success: true,
                rows: rawData, // includes header row at index 0
                totalRows: rawData.length - 1,
                sheetName: sheetName
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate and transform data (Using hardcoded columns)
     * Col A (0): Nama Karyawan
     * Col B (1): Nomor Undian
     * Col C (2): Perusahaan
     */
    transformData(rows) {
        const employees = [];
        const errors = [];
        const duplicates = [];
        const seenNomorUndian = new Set();

        // Loop array dari index 1 (baris ke-2 di excel, skip header)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 1; // Excel row number (1-based index)

            // Skip empty rows
            if (row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Fixed columns based on array index from sheet_to_json(header: 1)
            const nama = String(row[0] || '').trim();
            // Excel sering menghapus angka 0 di depan nomor HP (disimpan sebagai number)
            // Contoh: 08123456789 → 8123456789 di Excel
            // Fix: jika berupa angka tanpa awalan 0, tambahkan 0 di depan
            let nomorRaw = String(row[1] || '').trim().replace(/[\s\-\.]/g, '');
            if (/^[1-9][0-9]{8,11}$/.test(nomorRaw)) {
                nomorRaw = '0' + nomorRaw; // Kembalikan angka 0 yang hilang
            }
            const nomor = nomorRaw;
            const perusahaan = String(row[2] || '').trim();

            // Validation
            const rowErrors = [];

            if (!nama) {
                rowErrors.push('Nama karyawan kosong');
            }

            if (!nomor) {
                rowErrors.push('Nomor HP kosong');
            } else if (!/^0[0-9]{9,12}$/.test(nomor)) {
                rowErrors.push(`Nomor HP "${nomor}" tidak valid (harus 10-13 digit dimulai dengan 0)`);
            }

            if (!perusahaan) {
                rowErrors.push('Perusahaan kosong');
            }

            // Check for duplicates
            if (nomor && seenNomorUndian.has(nomor)) {
                duplicates.push({
                    row: rowNumber,
                    nomor_undian: nomor,
                    nama_karyawan: nama
                });
                continue;
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNumber,
                    errors: rowErrors,
                    data: { nama, nomor, perusahaan }
                });
                continue;
            }

            seenNomorUndian.add(nomor);
            employees.push({
                nama_karyawan: nama,
                nomor_undian: nomor,
                perusahaan: perusahaan
            });
        }

        // Extract unique companies
        const companies = [...new Set(employees.map(e => e.perusahaan))];

        return {
            employees: employees,
            companies: companies,
            validCount: employees.length,
            errorCount: errors.length,
            duplicateCount: duplicates.length,
            errors: errors,
            duplicates: duplicates
        };
    }

    /**
     * Main import function
     */
    async import(filePath) {
        // 1. Parse Excel
        const parseResult = this.parseExcel(filePath);
        if (!parseResult.success) {
            return parseResult;
        }

        // 2. Transform and Validate Data (skipping the header row blindly)
        const dataResult = this.transformData(parseResult.rows);

        return {
            success: true,
            data: dataResult.employees,
            sampleData: dataResult.employees.slice(0, 10),  // ← tambahkan baris ini
            companies: dataResult.companies,
            errors: dataResult.errors,
            duplicates: dataResult.duplicates,
            stats: {
                totalRows: parseResult.totalRows,
                validCount: dataResult.validCount,
                errorCount: dataResult.errorCount,
                duplicateCount: dataResult.duplicateCount
            },
            mapping: null, // Removed smart mapping as per user request
            sheetName: parseResult.sheetName
        };
    }

    /**
     * Preview function for the frontend
     */
    async preview(filePath) {
        // Just run the same logic as import for preview
        return this.import(filePath);
    }
}

module.exports = new ExcelImporter();
