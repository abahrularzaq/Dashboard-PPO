// 1. Variabel Global
let selectedFile;

// 2. Simpan file saat dipilih lewat input
document.getElementById('upload-excel').addEventListener('change', function(e) {
    selectedFile = e.target.files[0];
    console.log("File terpilih:", selectedFile.name);
});

// 3. Jalankan proses saat tombol "Btn Proses" diklik
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
        
        // Kirim data ke fungsi pengolah
        prosesDataExcel(jsonData);
    };
    reader.readAsArrayBuffer(selectedFile);
});

// 4. Fungsi Utama Pengolahan Data
function prosesDataExcel(data) {
    // Bersihkan tabel sebelum diisi data baru
    document.querySelector('#table-rekap tbody').innerHTML = "";
    
    let totalVol = 0;
    const rekapProduk = {};
    const rekapKategori = {};

    data.forEach(item => {
        // Ambil data dari kolom Excel (Pastikan Nama Kolom Sesuai!)
        const namaProduk = item['nama produk'] || "Tidak Diketahui";
        const kategori = item['kategori'] || "Tanpa Kategori";
        const jumlah = parseInt(item['jumlah orderan']) || 0;

        totalVol += jumlah;
        
        // Rekap per Produk
        if (!rekapProduk[namaProduk]) {
            rekapProduk[namaProduk] = { volume: 0, frekuensi: 0, kat: kategori };
        }
        rekapProduk[namaProduk].volume += jumlah;
        rekapProduk[namaProduk].frekuensi += 1;

        // Rekap per Kategori
        if (!rekapKategori[kategori]) {
            rekapKategori[kategori] = 0;
        }
        rekapKategori[kategori] += jumlah;
    });

    // Update Angka di Ringkasan (UI)
    document.getElementById('total-transaksi').innerText = data.length;
    document.getElementById('total-volume').innerText = totalVol;
    document.getElementById('total-kategori').innerText = Object.keys(rekapKategori).length;

    // Update Isi Tabel
    const tbody = document.querySelector('#table-rekap tbody');
    Object.keys(rekapProduk).forEach(nama => {
        const row = `<tr>
            <td>${nama} <br><small style="color: #666;">(${rekapProduk[nama].kat})</small></td>
            <td>${rekapProduk[nama].volume}</td>
            <td>${rekapProduk[nama].frekuensi} kali</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    // Jalankan Grafik
    renderCharts(rekapKategori);
}

// 5. Fungsi Grafik
function renderCharts(rekapKategori) {
    const ctx = document.getElementById('transaksiChart').getContext('2d');
    
    // Hapus chart lama agar tidak tumpang tindih
    if (window.myChart) { window.myChart.destroy(); }

    window.myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(rekapKategori),
            datasets: [{
                label: 'Volume per Kategori',
                data: Object.values(rekapKategori),
                backgroundColor: ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Proporsi Transaksi Berdasarkan Kategori' }
            }
        }
    });
}