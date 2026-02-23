// Script to create sample Excel file for testing
const XLSX = require('xlsx');
const path = require('path');

// Sample data
const data = [
    { 'Nama Karyawan': 'Ahmad Surya', 'Nomor Undian': 'A1B2', 'Perusahaan': 'PT. ABC Indonesia' },
    { 'Nama Karyawan': 'Budi Santoso', 'Nomor Undian': 'C3D4', 'Perusahaan': 'PT. ABC Indonesia' },
    { 'Nama Karyawan': 'Citra Dewi', 'Nomor Undian': 'E5F6', 'Perusahaan': 'PT. XYZ Mandiri' },
    { 'Nama Karyawan': 'Dian Pratama', 'Nomor Undian': 'G7H8', 'Perusahaan': 'PT. XYZ Mandiri' },
    { 'Nama Karyawan': 'Eko Wijaya', 'Nomor Undian': 'I9J0', 'Perusahaan': 'PT. ABC Indonesia' },
    { 'Nama Karyawan': 'Fitri Handayani', 'Nomor Undian': 'K1L2', 'Perusahaan': 'CV. Maju Jaya' },
    { 'Nama Karyawan': 'Gunawan Setiawan', 'Nomor Undian': 'M3N4', 'Perusahaan': 'CV. Maju Jaya' },
    { 'Nama Karyawan': 'Hendra Kusuma', 'Nomor Undian': 'O5P6', 'Perusahaan': 'PT. XYZ Mandiri' },
    { 'Nama Karyawan': 'Indah Permata', 'Nomor Undian': 'Q7R8', 'Perusahaan': 'PT. ABC Indonesia' },
    { 'Nama Karyawan': 'Joko Susilo', 'Nomor Undian': 'S9T0', 'Perusahaan': 'CV. Maju Jaya' }
];

// Create workbook
const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');

// Write to file
const outputPath = path.join(__dirname, '..', 'sample_data.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Sample Excel file created:', outputPath);
console.log('📊 Total employees:', data.length);
console.log('🏢 Companies:', [...new Set(data.map(d => d.Perusahaan))].join(', '));
