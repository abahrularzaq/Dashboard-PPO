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

    // Validasi: Jangan jalan jika pesan kosong atau data belum diupload
    if (!userMessage) return;
    if (dataAsli.length === 0) {
        alert("Mohon upload dan proses file Excel terlebih dahulu, Pak.");
        return;
    }

    // 1. Logika Keamanan Token
    let activeToken = localStorage.getItem('pbf_dashboard_token');
    if (!activeToken) {
        activeToken = prompt("Masukkan GitHub Token Anda:");
        if (activeToken) localStorage.setItem('pbf_dashboard_token', activeToken);
        else return;
    }

    // Tampilkan pesan user di UI
    const userBubble = document.createElement('div');
    userBubble.className = "message user-msg";
    userBubble.textContent = userMessage;
    historyBox.appendChild(userBubble);
    inputField.value = "";
    historyBox.scrollTop = historyBox.scrollHeight;

    // 2. PROSES DATA AGREGAT (Perbaikan Logika)
    const rekapProduk = {};
    const rekapCustomer = {};
    
    dataAsli.forEach(item => {
        // Mencari kolom kuantitas secara fleksibel
        const qtyRaw = item["Total Volume"] || item["Jumlah Orderan"] || item.jumlah || item.QTY || 0;
        const qty = typeof qtyRaw === 'string' ? Number(qtyRaw.replace(/[^0-9.-]+/g,"")) : Number(qtyRaw);

        // Mencari nama produk dan customer secara fleksibel
        const namaProduk = item["nama produk"] || item["NAMA BARANG"] || item["Produk"] || item.namaProduk || "Produk";
        const namaCustomer = item["nama customer"] || item["PELANGGAN"] || item["Outlet"] || item.namaCustomer || "Customer";

        if (qty > 0) {
            rekapProduk[namaProduk] = (rekapProduk[namaProduk] || 0) + qty;
            rekapCustomer[namaCustomer] = (rekapCustomer[namaCustomer] || 0) + qty;
        }
    });

    // Ringkas data untuk dikirim ke AI (Batasi agar tidak terlalu panjang)
    const teksProduk = Object.entries(rekapProduk).map(([k, v]) => `${k} (${v} qty)`).join(", ");
    const teksCustomer = Object.entries(rekapCustomer).map(([k, v]) => `${k} (${v} qty)`).join(", ");

    // 3. SYSTEM PROMPT
    const systemPrompt = `
    Anda adalah "PBF Expert Assistant". Anda wajib menjawab berdasarkan data statistik di bawah ini.
    
    DATA SAAT INI:
    - Total Baris: ${dataAsli.length}
    - Penjualan Produk: ${teksProduk.slice(0, 1800)}
    - Pembelian Customer: ${teksCustomer.slice(0, 1000)}

    ATURAN:
    1. Jawab hanya terkait PBF, CDOB, atau dashboard ini.
    2. Jika di luar konteks, tolak dengan sopan.
    3. Analisis lonjakan jika ada Qty yang tidak wajar.
    4. Gunakan istilah: APJ, PBF, CDOB, Prekursor, Psikotropika, dan SP.
    5. Jawab langsung dengan angka, jangan suruh user lihat tabel.
    
    [Di akhir jawaban, berikan 1 saran pertanyaan relevan dalam kurung siku].`;

    // Tampilkan Loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = "loading-ai";
    loadingDiv.className = "message bot-msg";
    loadingDiv.innerHTML = "<em>Sedang menganalisis data...</em>";
    historyBox.appendChild(loadingDiv);
    historyBox.scrollTop = historyBox.scrollHeight;

    try {
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${activeToken}`
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                model: "gpt-4o"
            })
        });

        if (response.status === 401) {
            localStorage.removeItem('pbf_dashboard_token');
            throw new Error("Token tidak valid/expired.");
        }

        const data = await response.json();
        const aiReply = data.choices[0].message.content;

        document.getElementById('loading-ai').remove();
        const botBubble = document.createElement('div');
        botBubble.className = "message bot-msg";
        botBubble.innerHTML = aiReply.replace(/\n/g, "<br>");
        historyBox.appendChild(botBubble);
        historyBox.scrollTop = historyBox.scrollHeight;

    } catch (error) {
        if(document.getElementById('loading-ai')) document.getElementById('loading-ai').remove();
        alert("Kesalahan AI: " + error.message);
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