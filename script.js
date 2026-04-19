// 1. Variabel Global
let dataAsli = []; 
let rekapBulanan = {}; // Struktur: { Customer: { Produk: { Bulan: Qty } } }
let selectedFile;
let myChart;

// 2. Event Listener Pilih File
document.getElementById('upload-excel').addEventListener('change', function(e) {
    selectedFile = e.target.files[0];
    const fileName = selectedFile ? selectedFile.name : "*Belum ada file dipilih";
    document.getElementById('file-name').textContent = "File: " + fileName;
});
document.getElementById('downloadTemplate').addEventListener('click', function() {
    // Pastikan nama file sesuai dengan yang Bapak upload ke GitHub
    const fileUrl = 'Template_data_transaksi_excel.xlsx'; 
    
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'Template_data_transaksi_excel.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 3. Tombol Proses Data
document.getElementById('btn-proses').addEventListener('click', function() {
    if (!selectedFile) {
        alert("Pilih file Excel dulu ya, Pak!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        siapkanData(jsonData);
    };
    reader.readAsArrayBuffer(selectedFile);
});

// 4. Fungsi Normalisasi Data
function siapkanData(dataRaw) {
    rekapBulanan = {}; 
    let daftarProdukUnik = [];

    dataAsli = dataRaw.map(item => {
        const namaCustomer = item['nama customer'] || item['PELANGGAN'] || item['Outlet'] || "Tanpa Nama";
        const namaProduk = item['nama produk'] || item['NAMA BARANG'] || item['Produk'] || "-";
        const tglRaw = item['tgl transaksi'] || item['TANGGAL'] || item['Tanggal'] || "-";
        const tgl = formatTanggalExcel(tglRaw);
        const jumlah = parseInt(item['jumlah orderan']) || parseInt(item['QTY']) || parseInt(item['Jumlah']) || 0;
        const kategori = item['kategori'] || "Lain-lain";

        if (!daftarProdukUnik.includes(namaProduk)) daftarProdukUnik.push(namaProduk);

        const bulan = tgl.split('/')[1]; 
        
        if (!rekapBulanan[namaCustomer]) rekapBulanan[namaCustomer] = {};
        if (!rekapBulanan[namaCustomer][namaProduk]) rekapBulanan[namaCustomer][namaProduk] = {};
        if (!rekapBulanan[namaCustomer][namaProduk][bulan]) rekapBulanan[namaCustomer][namaProduk][bulan] = 0;
        
        rekapBulanan[namaCustomer][namaProduk][bulan] += jumlah;

        return { namaCustomer, namaProduk, tgl, jumlah, kategori, bulanRaw: bulan };
    });

    isiDropdownProduk(daftarProdukUnik);
    renderDashboard(dataAsli);
}

// 5. Fungsi Isi Dropdown Filter
function isiDropdownProduk(daftar) {
    const dropdown = document.getElementById('filter-produk');
    dropdown.innerHTML = '<option value="">-- Semua Produk --</option>';
    daftar.sort().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        dropdown.appendChild(opt);
    });
}

// 6. Fungsi Render Utama
function renderDashboard(data) {
    const tbody = document.querySelector('#table-rekap tbody');
    tbody.innerHTML = "";
    
    let totalVol = 0;
    const rekapCustomerGrafik = {};
    const rekapKategori = {};
    const grupCustomer = {};

    data.forEach(item => {
        if (!grupCustomer[item.namaCustomer]) grupCustomer[item.namaCustomer] = [];
        grupCustomer[item.namaCustomer].push(item);
        totalVol += item.jumlah;
        if (!rekapKategori[item.kategori]) rekapKategori[item.kategori] = 0;
        rekapKategori[item.kategori] += item.jumlah;
        if (!rekapCustomerGrafik[item.namaCustomer]) rekapCustomerGrafik[item.namaCustomer] = 0;
        rekapCustomerGrafik[item.namaCustomer] += item.jumlah;
    });

    Object.keys(grupCustomer).forEach(customer => {
        const detailData = grupCustomer[customer];
        const totalQtyCustomer = detailData.reduce((sum, i) => sum + i.jumlah, 0);
        
        let statusWarning = false;
        let produkMelonjak = [];
        const produkUnikCust = [...new Set(detailData.map(d => d.namaProduk))];

        produkUnikCust.forEach(prod => {
            const historyBulan = rekapBulanan[customer][prod];
            const listBln = Object.keys(historyBulan).sort().reverse(); 
            const qtySekarang = historyBulan[listBln[0]];
            const blnLalu = listBln.slice(1, 4); 
            
            if (blnLalu.length >= 1) {
                const avgLalu = blnLalu.reduce((s, b) => s + historyBulan[b], 0) / blnLalu.length;
                if (qtySekarang > avgLalu) {
                    statusWarning = true;
                    produkMelonjak.push(`${prod}: ${qtySekarang} (Avg: ${avgLalu.toFixed(0)})`);
                }
            }
        });

        let warningIcon = statusWarning ? `⚠️` : "✅";
        let keteranganStatus = statusWarning ? 
            `<span style="color: #e74c3c; font-weight:bold;">Lonjakan (${produkMelonjak.length} Produk)</span>` : 
            `<span style="color: #27ae60;">Normal</span>`;

        const tr = document.createElement('tr');
        const safeID = customer.replace(/[^a-zA-Z0-9]/g, '-');
        tr.className = "row-customer";
        tr.style.backgroundColor = statusWarning ? "#fff5f5" : "#ffffff";
        tr.innerHTML = `
            <td>${warningIcon} <strong>${customer}</strong></td>
            <td>${produkUnikCust.length} Jenis Produk</td>
            <td>${keteranganStatus}</td>
            <td style="text-align:right;"><strong>${totalQtyCustomer.toLocaleString('id-ID')}</strong></td>
        `;
        
        tr.onclick = () => toggleDetail(safeID);
        tbody.appendChild(tr);

        // Grouping Detail per Produk
        const detailPerProduk = {};
        detailData.forEach(d => {
            if (!detailPerProduk[d.namaProduk]) detailPerProduk[d.namaProduk] = [];
            detailPerProduk[d.namaProduk].push(d);
        });

        const trDetail = document.createElement('tr');
        trDetail.id = `detail-${safeID}`;
        trDetail.style.display = "none";
        
        let detailHtml = `<td colspan="4" style="background: #fdfdfd; padding: 15px; border: 1px solid #ddd;">`;
        Object.keys(detailPerProduk).sort().forEach(namaProd => {
            detailHtml += `
                <div style="margin-bottom: 5px; border-bottom: 1px solid #eee;"><strong>📦 ${namaProd}</strong></div>
                <table style="width:100%; margin-bottom: 10px; font-size: 0.85em;">
                    ${detailPerProduk[namaProd].map(d => `<tr><td>${d.tgl}</td><td style="text-align:right;">${d.jumlah}</td></tr>`).join('')}
                </table>`;
        });
        detailHtml += `</td>`;
        trDetail.innerHTML = detailHtml;
        tbody.appendChild(trDetail);
    });

    document.getElementById('total-transaksi').innerText = data.length.toLocaleString('id-ID');
    document.getElementById('total-volume').innerText = totalVol.toLocaleString('id-ID');
    document.getElementById('total-kategori').innerText = Object.keys(rekapKategori).length;
    renderCharts(rekapCustomerGrafik);
}

// 7. Toggle & Filter
function toggleDetail(id) {
    const el = document.getElementById(`detail-${id}`);
    el.style.display = el.style.display === "none" ? "table-row" : "none";
}

const filterData = () => {
    const produkDipilih = document.getElementById('filter-produk').value;
    const kataKunci = document.getElementById('input-cari').value.toLowerCase();
    const hasil = dataAsli.filter(item => {
        const matchProduk = produkDipilih === "" || item.namaProduk === produkDipilih;
        const matchCari = item.namaCustomer.toLowerCase().includes(kataKunci) || item.namaProduk.toLowerCase().includes(kataKunci);
        return matchProduk && matchCari;
    });
    renderDashboard(hasil);
};

document.getElementById('filter-produk').addEventListener('change', filterData);
document.getElementById('input-cari').addEventListener('input', filterData);

// 8. Fungsi Export
document.getElementById('btn-export-excel').addEventListener('click', () => {
    const wb = XLSX.utils.table_to_book(document.getElementById('table-rekap'));
    XLSX.writeFile(wb, `Monitoring_PBF_${new Date().toLocaleDateString()}.xlsx`);
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Laporan Analisis Distribusi PBF", 14, 15);
    doc.autoTable({ html: '#table-rekap', startY: 25, theme: 'grid' });
    doc.save("Laporan_Monitoring.pdf");
});

// 9. Pendukung
function formatTanggalExcel(serial) {
    if (isNaN(serial)) return serial;
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

function renderCharts(rekap) {
    const ctx = document.getElementById('transaksiChart').getContext('2d');
    if (myChart) myChart.destroy();
    const top10 = Object.keys(rekap).map(k => ({n: k, v: rekap[k]})).sort((a,b)=>b.v-a.v).slice(0,10);
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(d => d.n),
            datasets: [{ label: 'Volume', data: top10.map(d => d.v), backgroundColor: '#2ecc71' }]
        },
        options: { indexAxis: 'y', maintainAspectRatio: false }
    });
}
// ... (Bagian 1 sampai 9 tetap sama) ...

// --- BAGIAN AI ASISTEN (STYLE CHAT MODERN) ---

async function tanyaAI() {
    const inputField = document.getElementById('user-input');
    const historyBox = document.getElementById('chat-history');
    const userMessage = inputField.value.trim();

    if (!userMessage) return;

    // Mengirimkan data yang sudah difilter/diidentifikasi sebagai lonjakan
const dataAnomali = dataAsli
    .filter(d => d.statusLonjakan === "⚠️ Lonjakan") // Mengambil baris yang sudah ditandai sistem kita
    .slice(0, 5); // Ambil 5 teratas agar tidak kepanjangan

const ringkasanAnomali = dataAnomali.length > 0 ? 
    dataAnomali.map(d => `${d.namaCustomer} beli ${d.namaProduk} sebanyak ${d.qty}`).join("; ") : 
    "Tidak ada lonjakan signifikan terdeteksi.";

    // --- LOGIKA TOKEN AMAN ---
    let activeToken = localStorage.getItem('pbf_dashboard_token');

    if (!activeToken) {
        activeToken = prompt("Keamanan: Masukkan GitHub Token Anda untuk mengaktifkan AI (Hanya perlu sekali per perangkat):");
        if (activeToken && activeToken.startsWith('ghp_')) {
            localStorage.setItem('pbf_dashboard_token', activeToken);
        } else {
            alert("Token tidak valid. Pastikan diawali dengan 'ghp_'.");
            return;
        }
    }

    // 1. Tampilkan pesan user (Bubble Style)
    const userBubble = document.createElement('div');
    userBubble.className = "message user-msg";
    userBubble.textContent = userMessage;
    historyBox.appendChild(userBubble);
    
    inputField.value = ""; 
    historyBox.scrollTop = historyBox.scrollHeight;

    // 2. Tambahkan Loading Indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = "loading-ai";
    loadingDiv.className = "message bot-msg";
    loadingDiv.innerHTML = "<em>Sedang menganalisis data...</em>";
    historyBox.appendChild(loadingDiv);
    historyBox.scrollTop = historyBox.scrollHeight;

    // 3. Siapkan Ringkasan Data
    const ringkasan = dataAsli.length > 0 ? 
        dataAsli.slice(0, 10).map(d => `${d.namaCustomer}: ${d.namaProduk}`).join(", ") : 
        "Belum ada data.";

     // Hitung statistik ringkas sebelum panggil AI
const totalTransaksi = dataAsli.length;
const totalQty = dataAsli.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
const topCustomer = dataAsli.length > 0 ? dataAsli[0].namaCustomer : "-";

const systemPrompt = `
    Anda adalah "PBF Expert Assistant". Tugas Anda membantu Apoteker Penanggung Jawab (APJ) menganalisis data distribusi farmasi.
    
     LOGIKA ANALISIS ANOMALI:
    1. Deteksi Lonjakan: Jika ada satu pelanggan membeli produk > 2x lipat dari rata-rata kuantitas biasanya, tandai sebagai "Potensi Penyimpangan".
    2. Konsentrasi Pelanggan: Jika > 50% volume satu jenis obat hanya diserap oleh 1 pelanggan, berikan peringatan risiko ketergantungan distribusi.
    3. Fokus Pengawasan: Berikan perhatian khusus pada nama produk yang mengandung kata kunci (e.g., "Pseudoephedrine", "Dextro", "Diazepam", "Tramadol").
    4. Jika menemukan data anomali, sampaikan dengan format: 
       - ⚠️ TEMUAN: [Nama Pelanggan] - [Produk]
       - Analisis: [Kenapa ini aneh?]
       - Rekomendasi APJ: [Tindakan yang harus diambil sesuai CDOB]

    KONTEKS DASHBOARD SAAT INI:
    - Total Baris Data: ${totalTransaksi}
    - Total Volume (Qty): ${totalQty}
    - Customer Teratas: ${topCustomer}
    - Sampel Data (10 teratas): ${ringkasan}

    ATURAN KETAT:
    1. HANYA jawab pertanyaan terkait data PBF, regulasi farmasi (CDOB), atau cara pakai dashboard ini.
    2. Jika user bertanya di luar konteks (misal: masak, politik, hiburan), jawab: "Maaf Pak, saya fokus membantu Bapak mengawasi distribusi di PBF ini."
    3. Analisis Anomali: Jika ada lonjakan Qty yang tidak wajar, beri peringatan berdasarkan data.
    4. Gunakan istilah teknis seperti: APJ, PBF, CDOB, Prekursor, Psikotropika, dan Surat Pesanan (SP).
    [Di akhir setiap jawaban, berikan 1 saran pertanyaan singkat yang relevan untuk dianalisis selanjutnya]

`;

    try {
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${activeToken}` // Menggunakan token dari localStorage
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                model: "gpt-4o"
            })
        });

        // Jika token salah atau sudah dihapus oleh GitHub (401)
        if (response.status === 401) {
            localStorage.removeItem('pbf_dashboard_token'); // Hapus token rusak dari memori
            throw new Error("Token tidak valid atau telah kedaluwarsa.");
        }

        if (!response.ok) throw new Error("Gagal menghubungi AI.");

        const data = await response.json();
        const aiReply = data.choices[0].message.content;

        document.getElementById('loading-ai').remove();
        
        const botBubble = document.createElement('div');
        botBubble.className = "message bot-msg";
        botBubble.textContent = aiReply;
        historyBox.appendChild(botBubble);
        
        historyBox.scrollTop = historyBox.scrollHeight;

    } catch (error) {
        if(document.getElementById('loading-ai')) document.getElementById('loading-ai').remove();
        const errorDiv = document.createElement('div');
        errorDiv.className = "message bot-msg";
        errorDiv.style.color = "#c0392b";
        errorDiv.textContent = `Error: ${error.message}. Silakan refresh halaman untuk mencoba lagi atau masukkan token baru.`;
        historyBox.appendChild(errorDiv);
        historyBox.scrollTop = historyBox.scrollHeight;
    }
}

// Inisialisasi Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const widget = document.getElementById('ai-widget');
    if (widget) widget.style.display = "none";

    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') tanyaAI();
        });
    }
});

function toggleChat() {
    const widget = document.getElementById('ai-widget');
    const icon = document.getElementById('chat-icon');
    
    if (widget.style.display === "none" || widget.style.display === "") {
        widget.style.display = "flex";
        icon.style.display = "none";
    } else {
        widget.style.display = "none";
        icon.style.display = "flex";
    }
}