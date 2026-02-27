const XLSX = require('xlsx');
const path = require('path');

class PrizeImporter {
    constructor() {
        // Define column mapping variations for smart detection
        this.columnMappings = {
            nomor: ['nomor', 'no', 'number', 'urutan', 'id', 'no.', 'nomor urut'],
            hadiah: ['hadiah', 'prize', 'barang', 'item', 'nama_hadiah', 'nama hadiah']
        };
    }

    parseExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

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
                rows: rawData.slice(1)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    detectColumns(headers) {
        const mapping = {
            nomor: null,
            hadiah: null
        };

        const normalizedHeaders = headers.map((h, index) => ({
            original: h,
            normalized: String(h).toLowerCase().trim().replace(/[_\s]+/g, '_'),
            index: index
        }));

        for (const [field, variations] of Object.entries(this.columnMappings)) {
            for (const header of normalizedHeaders) {
                const headerNorm = header.normalized;
                for (const variation of variations) {
                    const variationNorm = variation.toLowerCase().replace(/[_\s]+/g, '_');
                    if (headerNorm === variationNorm || headerNorm.includes(variationNorm)) {
                        mapping[field] = {
                            columnIndex: header.index
                        };
                        break;
                    }
                }
                if (mapping[field]) break;
            }
        }

        const missingFields = Object.entries(mapping)
            .filter(([_, value]) => value === null)
            .map(([key, _]) => key);

        return {
            mapping: mapping,
            complete: mapping.hadiah !== null, // Only hadiah is strictly required
            missingFields: missingFields
        };
    }

    transformData(rows, mapping) {
        const prizesDetail = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            if (row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            const nomorRaw = mapping.nomor ? row[mapping.nomor.columnIndex] : '';
            const hadiahRaw = mapping.hadiah ? row[mapping.hadiah.columnIndex] : '';

            const nomor = parseInt(String(nomorRaw).replace(/\D/g, ''), 10);
            const hadiah = String(hadiahRaw).trim();

            if (!hadiah) continue; // Skip rows without a prize name

            prizesDetail.push({
                nomor: isNaN(nomor) ? 99999 + i : nomor,
                hadiah: hadiah
            });
        }

        // Sort by nomor to ensure order matches the user intent if they provided numbers out of order
        prizesDetail.sort((a, b) => a.nomor - b.nomor);

        // Extract just the array of prize strings
        const prizes = prizesDetail.map(p => p.hadiah);

        return {
            success: true,
            prizes: prizes
        };
    }
}

module.exports = new PrizeImporter();
