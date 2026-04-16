// 1. Variabel Global
let selectedFile;
let myChart;

// 2. Simpan file saat dipilih lewat input
document.getElementById('upload-excel').addEventListener('change', function(e) {
    selectedFile = e.target.files[0];
    console.log("File terpilih:", selectedFile.name);
});

// 3. Jalankan proses saat tombol klik
document.getElementById('btn-proses').addEventListener('click', function() {
    if (!selectedFile) {
        alert("Pilih file Excel dulu ya!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Panggil fungsi pengolah data
        prosesDataExcel(jsonData);
    };
    reader.readAsArrayBuffer(selectedFile);
});

// 4. Fungsi Utama Pengolahan Data
function prosesDataExcel(data) {
    const tbody = document.querySelector('#table-rekap tbody');
    tbody.innerHTML = ""; // Bersihkan tabel
    
    let totalVol = 0;
    const rekapCustomer = {}; 
    const rekapKategori = {};

    // Gunakan DocumentFragment agar RAM tidak berat saat render ribuan baris
    const fragment = document.createDocumentFragment();

    data.forEach(item => {
        // --- IDENTIFIKASI KOLOM (Otomatis mencari yang mirip) ---
        const namaCustomer = item['nama customer'] || item['PELANGGAN'] || item['Outlet'] || "Tanpa Nama";
        const namaProduk = item['nama produk'] || item['NAMA BARANG'] || item['Produk'] || "-";
        const tglRaw = item['tgl transaksi'] || item['TANGGAL'] || item['Tanggal'] || "-";
const tgl = formatTanggalExcel(tglRaw); // Diubah di sini
        const jumlah = parseInt(item['jumlah orderan']) || parseInt(item['QTY']) || parseInt(item['Jumlah']) || 0;
        const kategori = item['kategori'] || "Lain-lain";

        totalVol += jumlah;
        
        // Simpan ke rekap untuk Grafik Top 10 Customer
        if (!rekapCustomer[namaCustomer]) {
            rekapCustomer[namaCustomer] = { volume: 0 };
        }
        rekapCustomer[namaCustomer].volume += jumlah;

        // Hitung kategori untuk dashboard atas
        if (!rekapKategori[kategori]) { rekapKategori[kategori] = 0; }
        rekapKategori[kategori] += jumlah;

        // --- BUAT BARIS TABEL ---
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${namaCustomer}</strong></td>
            <td>${namaProduk}</td>
            <td>${tgl}</td>
            <td>${jumlah.toLocaleString('id-ID')}</td>
        `;
        fragment.appendChild(row);
    });

    // Tempel semua baris sekaligus (Ini yang bikin ANTI-LAG)
    tbody.appendChild(fragment);

    // Update Angka Ringkasan di atas
    document.getElementById('total-transaksi').innerText = data.length.toLocaleString('id-ID');
    document.getElementById('total-volume').innerText = totalVol.toLocaleString('id-ID');
    document.getElementById('total-kategori').innerText = Object.keys(rekapKategori).length;

    // Jalankan Grafik Top 10 Customer
    renderCharts(rekapCustomer);
}

// 5. Fungsi Grafik (Top 10 Customer)
function renderCharts(rekapCustomer) {
    const ctx = document.getElementById('transaksiChart').getContext('2d');
    
    // Hapus chart lama jika ada
    if (myChart) { myChart.destroy(); }

    // Sortir data untuk mengambil Top 10 saja agar grafik tidak kepenuhan
    const sortedData = Object.keys(rekapCustomer)
        .map(nama => ({ name: nama, volume: rekapCustomer[nama].volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(d => d.name),
            datasets: [{
                label: 'Total Volume Pengambilan',
                data: sortedData.map(d => d.volume),
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: '#27ae60',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar agar nama outlet terbaca
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Top 10 Pelanggan Terbesar' }
            }
        }
    });
}

// 6. Fitur Filter Pencarian (Versi Anti-Lag / Debounce)
let timeoutPencarian;

document.getElementById('input-cari').addEventListener('input', function() {
    const kataKunci = this.value.toLowerCase();
    
    // Hapus timer sebelumnya agar tidak bentrok
    clearTimeout(timeoutPencarian);

    // Beri jeda 300ms setelah Bapak berhenti mengetik baru sistem mencari
    // Ini biar browser tidak 'ngos-ngosan' setiap Bapak tekan tombol
    timeoutPencarian = setTimeout(() => {
        const rows = document.querySelectorAll('#table-rekap tbody tr');
        
        // Sembunyikan tabel sementara agar proses filter lebih ringan
        const tbody = document.querySelector('#table-rekap tbody');
        tbody.style.display = 'none'; 

        rows.forEach(row => {
            const teksBaris = row.innerText.toLowerCase();
            // Gunakan display 'none' dan '' (default)
            row.style.display = teksBaris.includes(kataKunci) ? "" : "none";
        });

        // Tampilkan kembali tabel setelah selesai filter
        tbody.style.display = ''; 
    }, 300); 
});
// Fungsi untuk mengubah angka Excel menjadi format tanggal Indonesia (DD/MM/YYYY)
function formatTanggalExcel(serial) {
    // Jika datanya bukan angka (sudah string tanggal), kembalikan apa adanya
    if (isNaN(serial)) return serial;

    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}