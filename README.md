# Dashboard Monitoring PBF

Dashboard Monitoring PBF adalah aplikasi berbasis **Streamlit** untuk memantau transaksi obat selama periode tertentu, melakukan analisa tren, serta mendeteksi lonjakan pembelian secara dini melalui mekanisme **Early Warning**.

Aplikasi ini dirancang agar tim operasional, APJ, dan manajemen dapat:
- melihat ringkasan transaksi secara cepat,
- memfilter data secara fleksibel,
- mendeteksi anomali pembelian,
- mengekspor hasil analisa,
- dan bertanya langsung ke **AI Chat** berdasarkan data yang sedang difilter.

## Fitur Utama

- **Upload data transaksi Excel** (`.xlsx` / `.xls`)
- **Filter periode analisa** berdasarkan tanggal transaksi
- **Filter data spesifik** berdasarkan customer dan produk
- **Skala Early Warning (1-5)** untuk mendeteksi lonjakan transaksi terhadap rata-rata 3 bulan terakhir
- **Ringkasan KPI**: total transaksi, total volume, jumlah produk
- **Grafik Top Customer** berdasarkan volume
- **Analisa kategori (Audit APJ)** dengan kontribusi volume per kategori
- **Deteksi lonjakan (Early Warning)** dalam tabel prioritas
- **Export data terfilter** ke format Excel dan PDF
- **AI Chat analitik** yang membaca data aktif sesuai filter saat ini
- **UI modern** dengan tampilan yang user-friendly
- **Panel sidebar informatif** termasuk waktu **WIB (GMT+7)**

## Teknologi yang Digunakan

- Python
- Streamlit
- Pandas
- Plotly
- Openpyxl / XlsxWriter
- ReportLab

## Struktur Data Input

File transaksi minimal memiliki kolom berikut:

- `customer` (atau variasi: `pelanggan`, `outlet`, `nama customer`)
- `produk` (atau variasi: `nama barang`, `nama produk`)
- `jumlah` (atau variasi: `qty`, `jumlah orderan`)
- `tanggal` (atau variasi: `tgl transaksi`, `tgl`)

Kolom opsional yang direkomendasikan:
- `kategori` (untuk analisa Audit APJ)

> Catatan: Sistem melakukan normalisasi nama kolom otomatis agar lebih fleksibel terhadap variasi template.

## Instalasi

Pastikan Python sudah terpasang (disarankan Python 3.10+), lalu jalankan:

```bash
pip install -r requirements.txt
```

## Menjalankan Aplikasi

```bash
streamlit run app.py
```

Setelah dijalankan, buka URL lokal yang ditampilkan oleh Streamlit di terminal.

## Alur Penggunaan

1. Upload file transaksi pada sidebar.
2. Atur **Skala Early Warning** sesuai tingkat sensitivitas.
3. Pilih **periode analisa**.
4. Gunakan filter **customer** dan **produk** untuk fokus analisa.
5. Tinjau:
   - KPI ringkasan,
   - grafik customer,
   - analisa kategori,
   - tabel early warning.
6. Klik **Siapkan File Export** lalu unduh Excel/PDF.
7. Gunakan **AI Chat** untuk pertanyaan analitik lanjutan.

## Panduan Skala Early Warning

Skala memengaruhi ambang deteksi lonjakan terhadap rata-rata 3 bulan terakhir:

- Skala 1: `1.00x` (paling sensitif)
- Skala 2: `1.10x`
- Skala 3: `1.25x` (default)
- Skala 4: `1.40x`
- Skala 5: `1.60x` (paling ketat)

## Contoh Pertanyaan AI Chat

- "Tolong beri ringkasan data saat ini"
- "Top produk terbesar apa saja?"
- "Top customer berdasarkan volume"
- "Ada warning lonjakan apa saja?"
- "Berapa jumlah produk Paracetamol?"
- "Analisa kategori sekarang"

AI Chat akan menjawab berdasarkan data yang sudah difilter, bukan seluruh data mentah.

## Export Laporan

- **Excel**: seluruh data terfilter dalam satu sheet
- **PDF**: ringkasan data terfilter (dibatasi untuk efisiensi tampilan)

## Troubleshooting Singkat

- **Kolom wajib tidak lengkap**  
  Pastikan file memuat kolom customer, produk, jumlah, dan tanggal.

- **Analisa kategori tidak muncul**  
  Pastikan kolom `kategori` tersedia di data.

- **Aplikasi terasa berat**  
  Gunakan filter lebih spesifik dan aktifkan detail customer hanya saat diperlukan.

## Pengembangan Lanjutan (Saran)

- Integrasi database untuk data historis otomatis
- Multi-user login dan hak akses
- Notifikasi otomatis (email/WA) saat warning tinggi
- Model prediksi kebutuhan stok berdasarkan tren

---

Jika dibutuhkan, README ini bisa dikembangkan menjadi dokumentasi operasional lengkap (SOP penggunaan harian + panduan audit APJ).
