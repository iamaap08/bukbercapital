const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
    ['Nomor', 'Hadiah'],
    [1, 'iPhone 15 Pro Max'],
    [2, 'iPad Air 5'],
    [3, 'Samsung TV 50 inch']
]);

// Adjust column width
ws['!cols'] = [{ wch: 10 }, { wch: 30 }];

XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadiah');

constOutputPath = path.join(__dirname, '../frontend/admin/template_hadiah.xlsx');
XLSX.writeFile(wb, constOutputPath);

console.log('Template created at:', constOutputPath);
