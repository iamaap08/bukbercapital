const XLSX = require('xlsx');
const path = require('path');

/**
 * SMART EXCEL IMPORTER
 * Auto-detects columns and validates data
 */

class ExcelImporter {
    constructor() {
        // Possible column name variations for smart detection
        this.columnMappings = {
            nama_karyawan: [
                'nama', 'nama_karyawan', 'name', 'employee_name',
                'nama karyawan', 'nama lengkap', 'fullname', 'full_name',
                'employee', 'karyawan', 'peserta', 'nama peserta'
            ],
            nomor_undian: [
                'nomor_undian', 'nomor undian', 'no_undian', 'no undian',
                'kode', 'code', 'ticket', 'tiket', 'nomor', 'no',
                'lottery_number', 'raffle_number', 'id_undian', 'kupon'
            ],
            perusahaan: [
                'perusahaan', 'company', 'perusahaan', 'pt', 'nama_perusahaan',
                'nama perusahaan', 'company_name', 'organization', 'organisasi',
                'instansi', 'unit', 'divisi', 'cabang', 'branch'
            ]
        };
    }

    /**
     * Parse Excel file and return structured data
     */
    parseExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const rawData = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: ''
            });

            if (rawData.length < 2) {
                throw new Error('File Excel kosong atau hanya memiliki header');
            }

            return {
                success: true,
                headers: rawData[0],
                rows: rawData.slice(1),
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
     * Smart detect column mapping
     */
    detectColumns(headers) {
        const mapping = {
            nama_karyawan: null,
            nomor_undian: null,
            perusahaan: null
        };

        const normalizedHeaders = headers.map((h, index) => ({
            original: h,
            normalized: String(h).toLowerCase().trim().replace(/[_\s]+/g, '_'),
            index: index
        }));

        // Find best match for each required field
        for (const [field, variations] of Object.entries(this.columnMappings)) {
            for (const header of normalizedHeaders) {
                const headerNorm = header.normalized;

                for (const variation of variations) {
                    const variationNorm = variation.toLowerCase().replace(/[_\s]+/g, '_');

                    if (headerNorm === variationNorm ||
                        headerNorm.includes(variationNorm) ||
                        variationNorm.includes(headerNorm)) {
                        mapping[field] = {
                            columnIndex: header.index,
                            originalHeader: header.original,
                            matchedVariation: variation
                        };
                        break;
                    }
                }
                if (mapping[field]) break;
            }
        }

        // Check if all required fields found
        const missingFields = Object.entries(mapping)
            .filter(([_, value]) => value === null)
            .map(([key, _]) => key);

        return {
            mapping: mapping,
            complete: missingFields.length === 0,
            missingFields: missingFields,
            availableHeaders: headers
        };
    }

    /**
     * Validate and transform data
     */
    transformData(rows, mapping) {
        const employees = [];
        const errors = [];
        const duplicates = [];
        const seenNomorUndian = new Set();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2; // Account for header row

            // Skip empty rows
            if (row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            const nama = mapping.nama_karyawan
                ? String(row[mapping.nama_karyawan.columnIndex] || '').trim()
                : '';

            const nomor = mapping.nomor_undian
                ? String(row[mapping.nomor_undian.columnIndex] || '').trim().toUpperCase()
                : '';

            const perusahaan = mapping.perusahaan
                ? String(row[mapping.perusahaan.columnIndex] || '').trim()
                : '';

            // Validation
            const rowErrors = [];

            if (!nama) {
                rowErrors.push('Nama karyawan kosong');
            }

            if (!nomor) {
                rowErrors.push('Nomor undian kosong');
            } else if (!/^[A-Z0-9]{4}$/i.test(nomor)) {
                rowErrors.push(`Nomor undian "${nomor}" tidak valid (harus 4 karakter alfanumerik)`);
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
    async import(filePath, customMapping = null) {
        console.log('📂 Starting Excel import...');
        console.log(`📄 File: ${filePath}`);

        // Step 1: Parse Excel
        const parseResult = this.parseExcel(filePath);
        if (!parseResult.success) {
            return {
                success: false,
                step: 'parse',
                error: parseResult.error
            };
        }

        console.log(`📊 Found ${parseResult.totalRows} rows`);

        // Step 2: Detect columns
        let columnMapping;
        if (customMapping) {
            columnMapping = { mapping: customMapping, complete: true };
        } else {
            columnMapping = this.detectColumns(parseResult.headers);
        }

        console.log('🔍 Column detection:', columnMapping);

        if (!columnMapping.complete) {
            return {
                success: false,
                step: 'column_detection',
                error: `Kolom tidak ditemukan: ${columnMapping.missingFields.join(', ')}`,
                detectedMapping: columnMapping.mapping,
                availableHeaders: columnMapping.availableHeaders,
                suggestion: 'Pastikan file Excel memiliki kolom: Nama, Nomor Undian, dan Perusahaan'
            };
        }

        // Step 3: Transform and validate data
        const transformResult = this.transformData(parseResult.rows, columnMapping.mapping);

        console.log(`✅ Valid: ${transformResult.validCount}`);
        console.log(`❌ Errors: ${transformResult.errorCount}`);
        console.log(`🔄 Duplicates: ${transformResult.duplicateCount}`);

        return {
            success: true,
            data: transformResult.employees,
            companies: transformResult.companies,
            stats: {
                totalRows: parseResult.totalRows,
                validCount: transformResult.validCount,
                errorCount: transformResult.errorCount,
                duplicateCount: transformResult.duplicateCount
            },
            errors: transformResult.errors,
            duplicates: transformResult.duplicates,
            columnMapping: columnMapping.mapping
        };
    }

    /**
     * Preview import without saving
     */
    async preview(filePath) {
        const result = await this.import(filePath);

        if (!result.success) {
            return result;
        }

        // Return preview with sample data
        return {
            success: true,
            preview: true,
            sampleData: result.data.slice(0, 10),
            companies: result.companies,
            stats: result.stats,
            errors: result.errors.slice(0, 10),
            duplicates: result.duplicates.slice(0, 10),
            columnMapping: result.columnMapping
        };
    }
}

module.exports = new ExcelImporter();
