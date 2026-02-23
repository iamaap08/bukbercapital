# Lucky Spin Wheel

Website undian berhadiah dengan sistem frontend-backend terintegrasi.

## 🎯 Fitur

- **4 Kotak Kombinasi** - Tampilan nomor undian dengan animasi slot machine
- **Filter Perusahaan** - Checkbox untuk memilih perusahaan yang ikut undian
- **Algoritma Kompleks** - 5-layer randomization algorithm
- **Admin Panel** - Import data Excel dan kelola karyawan
- **Winner Exclusion** - Pemenang tidak bisa menang lagi

## 🚀 Cara Menjalankan

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Jalankan Server

```bash
npm start
```

### 3. Akses Website

- **Main Page**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin/admin.html
- **Winners List**: http://localhost:3000/winners.html

## 📊 Format Excel untuk Import

File Excel harus memiliki kolom:
| Nama Karyawan | Nomor Undian | Perusahaan |
|---------------|--------------|------------|
| John Doe | A1B2 | PT. ABC |
| Jane Smith | C3D4 | PT. XYZ |

**Catatan:**
- Nomor undian harus 4 karakter alfanumerik
- Sistem akan auto-detect nama kolom

## 🔧 Algoritma Spin

Menggunakan 5-layer randomization:

1. **Cryptographic Seed** - crypto.randomBytes + timestamp + process entropy
2. **Triple Fisher-Yates Shuffle** - 3x shuffle dengan seed berbeda
3. **Weighted Entropy Pool** - Hash-based entropy untuk setiap peserta
4. **Chaotic Selection** - Logistic map chaos function
5. **Hash Verification** - SHA-256 audit trail

## 📁 Struktur Project

```
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── database.js
│   ├── spinAlgorithm.js
│   └── excelImporter.js
│
├── frontend/
│   ├── index.html
│   ├── winners.html
│   ├── styles.css
│   ├── app.js
│   └── admin/
│       ├── admin.html
│       ├── admin.css
│       └── admin.js
│
└── README.md
```

## 🎨 Tech Stack

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Excel Parser**: xlsx

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/employees | Get all employees |
| POST | /api/employees/import | Import from Excel |
| POST | /api/spin | Execute spin |
| GET | /api/winners | Get all winners |
| GET | /api/companies | Get all companies |
| GET | /api/stats | Get statistics |
