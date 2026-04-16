/**
 * Fungsi Utama Pencarian Pelanggan
 */
function cariPelanggan() {
    const input = document.getElementById('searchInput').value.trim().toUpperCase();
    const view = document.getElementById('singleView');

    if (typeof dataPelanggan === 'undefined') {
        alert("Error: Data pelanggan belum terhubung.");
        return;
    }

    if (input === "") {
        alert("Silakan ketik nama apotek/RS terlebih dahulu.");
        return;
    }

    // Mencari data yang mengandung kata kunci
    const keys = Object.keys(dataPelanggan);
    const matchedKey = keys.find(key => key.includes(input));

    if (matchedKey) {
        const result = dataPelanggan[matchedKey];
        view.style.display = 'block';
        
        // Isi Data ke Tampilan
        document.getElementById('viewNama').innerText = matchedKey;
        
        const sisa = hitungSisaHari(result.Masa_Berlaku_Ijin_Outlet);
        let warna = "black";
        let statusTeks = `(${sisa} hari lagi)`;

        if (sisa <= 0) {
            warna = "red";
            statusTeks = "(IZIN SUDAH HABIS!)";
        } else if (sisa < 30) {
            warna = "red";
            statusTeks = `(${sisa} hari lagi - SEGERA URUS!)`;
        } else if (sisa < 90) {
            warna = "orange";
            statusTeks = `(${sisa} hari lagi - Ingatkan Outlet)`;
        }

        const tglTeks = result.Masa_Berlaku_Ijin_Outlet || "Tidak ada data";
        document.getElementById('viewTglIzin').innerHTML = `${tglTeks} <b style="color:${warna}">${statusTeks}</b>`;
        
        document.getElementById('viewApj').innerText = result.Nama_APJ || "-";
        document.getElementById('viewNoSia').innerText = result.No_Ijin_Outlet || "-";
        document.getElementById('viewLimit').innerText = result.Limit_Kredit || "-"; 
        document.getElementById('viewPemakaian').innerText = result.Total_Piutang || "-";
        
        document.getElementById('historyBody').innerHTML = "<tr><td colspan='4'>Data transaksi sedang dikembangkan...</td></tr>";
        
    } else {
        alert("Data tidak ditemukan!");
        view.style.display = 'none';
    }
}

/**
 * Fungsi Pembantu Hitung Hari
 */
function hitungSisaHari(tglString) {
    if (!tglString || tglString === "Data Tidak Ada" || tglString === "None") return 0;
    
    const tglTarget = new Date(tglString);
    const tglSekarang = new Date();
    
    tglTarget.setHours(0, 0, 0, 0);
    tglSekarang.setHours(0, 0, 0, 0);

    const selisihMilidetik = tglTarget - tglSekarang;
    return Math.ceil(selisihMilidetik / (1000 * 60 * 60 * 24));
}