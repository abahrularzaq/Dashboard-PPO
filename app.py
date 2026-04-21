import streamlit as st
import pandas as pd
import plotly.express as px
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from datetime import datetime, timedelta, timezone

# --- 1. KONFIGURASI & CSS ---
st.set_page_config(page_title="Dashboard PBF", layout="wide")

try:
    with open("style.css") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
except FileNotFoundError:
    pass

st.markdown(
    """
    <style>
    .stApp {
        background: linear-gradient(180deg, #f7fbff 0%, #eef7f2 100%);
    }
    .hero-box {
        background: linear-gradient(120deg, #2563eb, #06b6d4, #22c55e);
        color: white;
        padding: 1rem 1.2rem;
        border-radius: 14px;
        margin-bottom: 1rem;
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
    }
    .hero-box h3 {
        margin: 0 0 0.3rem 0;
    }
    .hero-box p {
        margin: 0;
        opacity: 0.95;
    }
    .section-chip {
        display: inline-block;
        background: #e0f2fe;
        color: #0c4a6e;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.4rem;
    }
    [data-testid="stMetric"] {
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid #dbeafe;
        border-radius: 12px;
        padding: 0.75rem;
        box-shadow: 0 6px 16px rgba(14, 116, 144, 0.08);
    }
    .chat-hero {
        background: linear-gradient(120deg, #0ea5e9, #22c55e);
        color: #ffffff;
        border-radius: 14px;
        padding: 0.9rem 1rem;
        margin-bottom: 0.7rem;
        box-shadow: 0 8px 22px rgba(14, 165, 233, 0.22);
    }
    .chat-hero h4 {
        margin: 0 0 0.25rem 0;
    }
    .chat-hero p {
        margin: 0;
        opacity: 0.95;
    }
    .quick-hint {
        font-size: 0.86rem;
        color: #0f172a;
        background: #e2e8f0;
        border-radius: 999px;
        padding: 0.25rem 0.65rem;
        display: inline-block;
        margin-bottom: 0.5rem;
    }
    [data-testid="stChatMessage"] {
        background: transparent;
        border: none;
        padding: 0.1rem 0;
    }
    .assistant-bubble {
        background: #eef6ff;
        border: 1px solid #bfdbfe;
        border-radius: 14px;
        padding: 0.65rem 0.8rem;
        color: #0f172a;
    }
    .user-bubble {
        background: linear-gradient(120deg, #2563eb, #0ea5e9);
        border: 1px solid #1d4ed8;
        border-radius: 14px;
        padding: 0.65rem 0.8rem;
        color: #ffffff;
    }
    .chat-toolbar {
        display: inline-block;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.2rem 0.55rem;
        font-size: 0.82rem;
        color: #334155;
        margin-bottom: 0.4rem;
    }
    .sidebar-hero {
        background: linear-gradient(135deg, #0ea5e9, #2563eb);
        color: #ffffff;
        border-radius: 14px;
        padding: 0.8rem 0.9rem;
        margin-bottom: 0.7rem;
        box-shadow: 0 8px 22px rgba(37, 99, 235, 0.2);
    }
    .sidebar-hero h4 {
        margin: 0 0 0.2rem 0;
        font-size: 1.0rem;
    }
    .sidebar-hero p {
        margin: 0;
        opacity: 0.95;
        font-size: 0.84rem;
    }
    .sidebar-time {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 0.45rem 0.6rem;
        margin-bottom: 0.6rem;
        font-size: 0.82rem;
    }
    .sidebar-note {
        background: #ecfeff;
        color: #0e7490;
        border: 1px solid #a5f3fc;
        border-radius: 10px;
        padding: 0.45rem 0.6rem;
        margin-top: 0.5rem;
        font-size: 0.8rem;
    }
    </style>
    """,
    unsafe_allow_html=True
)

# --- 2. FUNGSI LOGIKA (Optimasi dengan Cache agar Cepat) ---

@st.cache_data
def siapkan_data(df):
    """Fungsi ini hanya dijalankan ulang jika file Excel berubah"""
    # Normalisasi nama kolom
    df.columns = [c.strip().lower() for c in df.columns]
    
    mapping = {
        'pelanggan': 'customer', 'outlet': 'customer', 'nama customer': 'customer',
        'nama barang': 'produk', 'nama produk': 'produk',
        'qty': 'jumlah', 'jumlah orderan': 'jumlah', 'jumlah': 'jumlah',
        'tgl transaksi': 'tanggal', 'tgl': 'tanggal'
    }
    df = df.rename(columns=mapping)
    
    if 'jumlah' in df.columns:
        df['jumlah'] = pd.to_numeric(df['jumlah'], errors='coerce').fillna(0)
    
    if 'tanggal' in df.columns:
        # Gunakan format dayfirst agar lebih cepat dan akurat untuk format Indo
        df['tanggal'] = pd.to_datetime(df['tanggal'], errors='coerce', dayfirst=True)
        df['periode_bulan'] = df['tanggal'].dt.to_period('M').astype(str)
        
    return df

@st.cache_data
def baca_excel(file_bytes):
    """Baca file upload dari bytes agar bisa di-cache dan lebih cepat saat rerun."""
    return pd.read_excel(BytesIO(file_bytes))

def cek_lonjakan(df_cust, faktor_warning=1.0):
    """Deteksi lonjakan jika bulan terbaru > rata-rata 3 bulan sebelumnya."""
    if 'tanggal' not in df_cust.columns:
        return False, []

    data_valid = df_cust.dropna(subset=['tanggal']).copy()
    if data_valid.empty:
        return False, []

    data_valid['periode_dt'] = data_valid['tanggal'].dt.to_period('M').dt.to_timestamp()
    rekap_bulan = data_valid.groupby(['produk', 'periode_dt'])['jumlah'].sum().reset_index()
    produk_melonjak = []
    status_warning = False

    for produk in rekap_bulan['produk'].unique():
        data_prod = rekap_bulan[rekap_bulan['produk'] == produk].sort_values('periode_dt', ascending=False)
        if len(data_prod) >= 4:
            qty_sekarang = data_prod.iloc[0]['jumlah']
            avg_lalu = data_prod.iloc[1:4]['jumlah'].mean()
            
            if qty_sekarang > (avg_lalu * faktor_warning) and avg_lalu > 0:
                status_warning = True
                persen_naik = ((qty_sekarang - avg_lalu) / avg_lalu) * 100
                periode_now = data_prod.iloc[0]['periode_dt'].strftime('%b %Y')
                produk_melonjak.append({
                    "customer": df_cust['customer'].iloc[0],
                    "produk": produk,
                    "periode": periode_now,
                    "qty_sekarang": qty_sekarang,
                    "rata_3_bulan": avg_lalu,
                    "kenaikan_persen": persen_naik
                })
                
    return status_warning, produk_melonjak

@st.cache_data
def hitung_early_warning(df_input, faktor_warning):
    """Hitung early warning secara vectorized agar lebih cepat untuk data besar."""
    if df_input.empty or 'tanggal' not in df_input.columns:
        return pd.DataFrame()

    data_valid = df_input.dropna(subset=['tanggal']).copy()
    if data_valid.empty:
        return pd.DataFrame()

    data_valid['periode_dt'] = data_valid['tanggal'].dt.to_period('M').dt.to_timestamp()
    rekap = (
        data_valid.groupby(['customer', 'produk', 'periode_dt'], as_index=False)['jumlah']
        .sum()
        .sort_values(['customer', 'produk', 'periode_dt'])
    )

    rekap['avg_3_bulan_lalu'] = (
        rekap.groupby(['customer', 'produk'])['jumlah']
        .transform(lambda s: s.shift(1).rolling(window=3, min_periods=3).mean())
    )
    rekap['is_warning'] = rekap['jumlah'] > (rekap['avg_3_bulan_lalu'] * faktor_warning)

    warn = rekap[rekap['is_warning'] & rekap['avg_3_bulan_lalu'].notna()].copy()
    if warn.empty:
        return pd.DataFrame()

    warn['periode'] = warn['periode_dt'].dt.strftime('%b %Y')
    warn['kenaikan_persen'] = ((warn['jumlah'] - warn['avg_3_bulan_lalu']) / warn['avg_3_bulan_lalu']) * 100
    warn = warn.rename(
        columns={
            'jumlah': 'qty_sekarang',
            'avg_3_bulan_lalu': 'rata_3_bulan'
        }
    )
    return warn[['customer', 'produk', 'periode', 'qty_sekarang', 'rata_3_bulan', 'kenaikan_persen']]

@st.cache_data
def export_excel_bytes(df_export):
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df_export.to_excel(writer, index=False, sheet_name="Data_Filtered")
    output.seek(0)
    return output.getvalue()

@st.cache_data
def export_pdf_bytes(df_export):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(40, y, "Laporan Transaksi PBF (Data Terfilter)")
    y -= 20
    pdf.setFont("Helvetica", 9)
    pdf.drawString(40, y, f"Total baris data: {len(df_export)}")
    y -= 20

    kolom_pdf = [c for c in ["tanggal", "customer", "produk", "kategori", "jumlah"] if c in df_export.columns]
    data_pdf = df_export[kolom_pdf].copy()
    if "tanggal" in data_pdf.columns:
        data_pdf["tanggal"] = pd.to_datetime(data_pdf["tanggal"], errors="coerce").dt.strftime("%Y-%m-%d")

    pdf.setFont("Helvetica-Bold", 8)
    header_text = " | ".join(kolom_pdf)
    pdf.drawString(40, y, header_text[:120])
    y -= 14
    pdf.setFont("Helvetica", 8)

    for _, row in data_pdf.head(200).iterrows():
        line = " | ".join([str(row[c]) for c in kolom_pdf])
        pdf.drawString(40, y, line[:120])
        y -= 12
        if y < 40:
            pdf.showPage()
            y = height - 40
            pdf.setFont("Helvetica", 8)

    if len(data_pdf) > 200:
        pdf.setFont("Helvetica-Oblique", 8)
        pdf.drawString(40, y, f"Data dipotong sampai 200 baris dari total {len(data_pdf)} baris.")

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()

def format_angka(nilai):
    return f"{nilai:,.0f}".replace(",", ".")

def buat_ringkasan_filter(df_filter, pilihan_customer, pilihan_produk):
    if df_filter.empty:
        return "Data filter saat ini kosong."
    return (
        f"Filter aktif memuat {len(df_filter):,} transaksi, "
        f"{df_filter['customer'].nunique()} customer, dan "
        f"{df_filter['produk'].nunique()} produk. "
        f"Customer filter: {len(pilihan_customer) if pilihan_customer else 'Semua'}, "
        f"Produk filter: {len(pilihan_produk) if pilihan_produk else 'Semua'}."
    )

def cari_entity_terdekat(prompt_lower, kandidat):
    for item in kandidat:
        if str(item).lower() in prompt_lower:
            return item
    return None

def jawab_pertanyaan_data(prompt, df_filter, df_warning, faktor_warning, filter_info):
    if df_filter is None or df_filter.empty:
        return "Belum ada data terfilter untuk dianalisa. Silakan upload file dan atur filter terlebih dahulu."

    prompt_lower = prompt.lower()
    total_trans = len(df_filter)
    total_qty = df_filter['jumlah'].sum()
    total_customer = df_filter['customer'].nunique()
    total_produk = df_filter['produk'].nunique()

    daftar_produk = sorted(df_filter['produk'].dropna().astype(str).unique().tolist(), key=len, reverse=True)
    daftar_customer = sorted(df_filter['customer'].dropna().astype(str).unique().tolist(), key=len, reverse=True)
    produk_diminta = cari_entity_terdekat(prompt_lower, daftar_produk)
    customer_diminta = cari_entity_terdekat(prompt_lower, daftar_customer)

    if any(k in prompt_lower for k in ["ringkas", "summary", "gambaran", "kondisi data", "overview"]):
        return (
            f"Ringkasan data terfilter: total transaksi {total_trans:,}, total volume {format_angka(total_qty)}, "
            f"customer aktif {total_customer}, produk aktif {total_produk}. {filter_info}"
        )

    if any(k in prompt_lower for k in ["top produk", "produk terbanyak", "produk terlaris"]):
        top_produk = df_filter.groupby('produk', as_index=False)['jumlah'].sum().sort_values('jumlah', ascending=False).head(5)
        if top_produk.empty:
            return "Belum ada data produk pada filter ini."
        isi = ", ".join([f"{r['produk']} ({format_angka(r['jumlah'])})" for _, r in top_produk.iterrows()])
        return f"Top 5 produk pada filter saat ini: {isi}."

    if any(k in prompt_lower for k in ["top customer", "customer terbesar", "pelanggan terbesar"]):
        top_customer = df_filter.groupby('customer', as_index=False)['jumlah'].sum().sort_values('jumlah', ascending=False).head(5)
        if top_customer.empty:
            return "Belum ada data customer pada filter ini."
        isi = ", ".join([f"{r['customer']} ({format_angka(r['jumlah'])})" for _, r in top_customer.iterrows()])
        return f"Top 5 customer berdasarkan volume: {isi}."

    if produk_diminta and any(k in prompt_lower for k in ["berapa", "jumlah", "volume", "transaksi"]):
        df_p = df_filter[df_filter['produk'].astype(str).str.lower() == str(produk_diminta).lower()]
        qty_p = df_p['jumlah'].sum()
        trans_p = len(df_p)
        cust_p = df_p['customer'].nunique()
        return (
            f"Produk {produk_diminta}: total volume {format_angka(qty_p)}, "
            f"jumlah transaksi {trans_p:,}, dibeli oleh {cust_p} customer (sesuai filter aktif)."
        )

    if customer_diminta and any(k in prompt_lower for k in ["berapa", "jumlah", "volume", "transaksi", "produk"]):
        df_c = df_filter[df_filter['customer'].astype(str).str.lower() == str(customer_diminta).lower()]
        qty_c = df_c['jumlah'].sum()
        trans_c = len(df_c)
        prod_c = df_c['produk'].nunique()
        return (
            f"Customer {customer_diminta}: total volume {format_angka(qty_c)}, "
            f"jumlah transaksi {trans_c:,}, dengan {prod_c} produk unik (sesuai filter aktif)."
        )

    if any(k in prompt_lower for k in ["lonjakan", "warning", "anomali"]):
        if df_warning is None or df_warning.empty:
            return f"Tidak ada lonjakan melebihi ambang {faktor_warning:.1f}x dari rata-rata 3 bulan terakhir pada filter aktif."
        top_warn = df_warning.sort_values('kenaikan_persen', ascending=False).head(5)
        isi = ", ".join(
            [
                f"{r['customer']} - {r['produk']} ({r['kenaikan_persen']:.1f}% di {r['periode']})"
                for _, r in top_warn.iterrows()
            ]
        )
        return f"Terdapat {len(df_warning):,} warning. Prioritas tertinggi: {isi}."

    if "kategori" in prompt_lower and 'kategori' in df_filter.columns:
        rekap_kat = df_filter.groupby('kategori', as_index=False)['jumlah'].sum().sort_values('jumlah', ascending=False)
        if rekap_kat.empty:
            return "Belum ada data kategori pada filter aktif."
        isi = ", ".join([f"{r['kategori']} ({format_angka(r['jumlah'])})" for _, r in rekap_kat.iterrows()])
        return f"Analisa kategori (volume): {isi}."

    return (
        "Saya siap analisa detail berdasarkan data terfilter. "
        "Coba tanyakan: ringkasan, top produk, top customer, lonjakan, kategori, "
        "atau sebut nama produk/customer spesifik untuk dihitung."
    )

# --- 3. UI DASHBOARD ---

st.title("🏥 Dashboard Pedagang Besar Farmasi (PBF)")
st.markdown("Monitoring Transaksi Produk Secara Komprehensif  ")
st.markdown(
    """
    <div class="hero-box">
      <h3>⚡ Siap Analisa, Siap Aksi!</h3>
      <p>Pantau transaksi dengan fokus, deteksi lonjakan lebih awal, dan ambil keputusan dengan percaya diri.</p>
    </div>
    """,
    unsafe_allow_html=True
)

with st.sidebar:
    wib_now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7)))
    st.markdown(
        """
        <div class="sidebar-hero">
          <h4>🎛️ Panel Kontrol</h4>
          <p>Atur data, warning, dan ekspor dengan cepat.</p>
        </div>
        """,
        unsafe_allow_html=True
    )
    st.markdown(
        f'<div class="sidebar-time">🕒 WIB (GMT+7): <b>{wib_now.strftime("%d %b %Y, %H:%M:%S")}</b></div>',
        unsafe_allow_html=True
    )
    st.header("Input Data")
    uploaded_file = st.file_uploader("Pilih File Excel", type=["xlsx", "xls"])
    skala_warning = st.select_slider(
        "Skala Early Warning",
        options=[1, 2, 3, 4, 5],
        value=3,
        help="Skala 1 paling sensitif, skala 5 paling ketat."
    )
    faktor_warning_map = {1: 1.00, 2: 1.10, 3: 1.25, 4: 1.40, 5: 1.60}
    faktor_warning = faktor_warning_map[skala_warning]
    st.caption(f"Ambang aktif: {faktor_warning:.2f}x dari rata-rata 3 bulan terakhir.")
    st.markdown(
        '<div class="sidebar-note">Tip: gunakan skala 1-2 untuk deteksi awal yang agresif, skala 4-5 untuk warning prioritas tinggi.</div>',
        unsafe_allow_html=True
    )
    
    try:
        with open("Template_data_transaksi_excel.xlsx", "rb") as f:
            st.download_button("📥 Unduh Template", f, file_name="Template_PBF.xlsx")
    except FileNotFoundError:
        st.warning("File template tidak ditemukan.")

# --- 4. ALUR PROSES UTAMA ---

if uploaded_file:
    with st.spinner("Memproses data transaksi..."):
        file_bytes = uploaded_file.getvalue()
        df_raw = baca_excel(file_bytes)
        df = siapkan_data(df_raw)

    # Pastikan kolom wajib tersedia sebelum analisa
    kolom_wajib = {'customer', 'produk', 'jumlah', 'tanggal'}
    if not kolom_wajib.issubset(df.columns):
        st.error("Kolom wajib tidak lengkap. Pastikan file memuat customer, produk, jumlah, dan tanggal.")
        st.stop()

    # Filter periode analisa
    min_tgl, max_tgl = df['tanggal'].min(), df['tanggal'].max()
    periode_pilih = st.date_input(
        "Periode Analisa",
        value=(min_tgl.date(), max_tgl.date()),
        min_value=min_tgl.date(),
        max_value=max_tgl.date()
    )
    if isinstance(periode_pilih, tuple) and len(periode_pilih) == 2:
        start_date, end_date = periode_pilih
        df = df[(df['tanggal'].dt.date >= start_date) & (df['tanggal'].dt.date <= end_date)]

    # Filter tambahan untuk pencarian spesifik
    st.markdown('<div class="section-chip">🎯 Fokus Analisa</div>', unsafe_allow_html=True)
    st.subheader("Filter Data")
    col_filter_1, col_filter_2 = st.columns(2)
    with col_filter_1:
        pilihan_customer = st.multiselect(
            "Filter Customer",
            options=sorted(df['customer'].dropna().unique().tolist())
        )
    with col_filter_2:
        pilihan_produk = st.multiselect(
            "Filter Produk",
            options=sorted(df['produk'].dropna().unique().tolist())
        )

    if pilihan_customer:
        df = df[df['customer'].isin(pilihan_customer)]
    if pilihan_produk:
        df = df[df['produk'].isin(pilihan_produk)]
    
    # Pesan Asisten
    st.chat_message("assistant").write(
        f"Halo Pak! Saya sudah menganalisa **{len(df)}** transaksi. "
        f"Ada **{df['customer'].nunique()}** customer terdeteksi. "
        "Detail lonjakan bisa dilihat pada tabel di bawah."
    )
    
    # Dashboard Cards
    st.markdown('<div class="section-chip">📌 Ringkasan Cepat</div>', unsafe_allow_html=True)
    total_vol = df['jumlah'].sum() if 'jumlah' in df.columns else 0
    total_trans = len(df)
    total_kat = df['produk'].nunique() if 'produk' in df.columns else 0

    c1, c2, c3 = st.columns(3)
    c1.metric("Total Transaksi", f"{total_trans:,}")
    c2.metric("Total Volume", f"{total_vol:,.0f}")
    c3.metric("Jenis Produk", total_kat)

    # Export data hasil filter
    st.markdown('<div class="section-chip">⬇️ Bagikan Insight</div>', unsafe_allow_html=True)
    st.subheader("Export Data Terfilter")
    if "data_excel" not in st.session_state:
        st.session_state.data_excel = None
    if "data_pdf" not in st.session_state:
        st.session_state.data_pdf = None

    if st.button("Siapkan File Export", use_container_width=True):
        with st.spinner("Menyiapkan file Excel & PDF..."):
            st.session_state.data_excel = export_excel_bytes(df)
            st.session_state.data_pdf = export_pdf_bytes(df)
        st.success("File export siap diunduh.")

    col_export_1, col_export_2 = st.columns(2)
    with col_export_1:
        st.download_button(
            "Export Excel",
            data=st.session_state.data_excel if st.session_state.data_excel else b"",
            file_name="transaksi_pbf_filtered.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            disabled=st.session_state.data_excel is None
        )
    with col_export_2:
        st.download_button(
            "Export PDF",
            data=st.session_state.data_pdf if st.session_state.data_pdf else b"",
            file_name="transaksi_pbf_filtered.pdf",
            mime="application/pdf",
            disabled=st.session_state.data_pdf is None
        )

    # Grafik Top 10 (Agregasi dulu agar ringan)
    st.markdown('<div class="section-chip">📊 Energi Penjualan</div>', unsafe_allow_html=True)
    st.subheader("Grafik Volume per Customer")
    if 'customer' in df.columns:
        top_10 = df.groupby('customer')['jumlah'].sum().nlargest(10).reset_index()
        fig = px.bar(top_10, x='customer', y='jumlah', color='jumlah', title="Top 10 Volume Terbesar")
        st.plotly_chart(fig, use_container_width=True)

    # Analisa kategori untuk audit APJ
    st.divider()
    st.subheader("🧪 Analisa Kategori (Audit APJ)")
    if 'kategori' in df.columns:
        audit_kat = (
            df.groupby('kategori')
            .agg(
                total_transaksi=('jumlah', 'count'),
                total_volume=('jumlah', 'sum'),
                customer_unik=('customer', 'nunique'),
                produk_unik=('produk', 'nunique')
            )
            .reset_index()
            .sort_values('total_volume', ascending=False)
        )
        total_volume_all = audit_kat['total_volume'].sum()
        audit_kat['kontribusi_volume_%'] = (
            (audit_kat['total_volume'] / total_volume_all) * 100
            if total_volume_all > 0 else 0
        )
        audit_kat['kontribusi_volume_%'] = audit_kat['kontribusi_volume_%'].round(2)
        st.dataframe(audit_kat, use_container_width=True)

        fig_kat = px.pie(
            audit_kat,
            names='kategori',
            values='total_volume',
            title='Komposisi Volume per Kategori'
        )
        st.plotly_chart(fig_kat, use_container_width=True)
    else:
        st.info("Kolom 'kategori' belum tersedia di data. Analisa audit kategori belum bisa ditampilkan.")

    st.divider()
    st.markdown('<div class="section-chip">🔎 Investigasi Cepat</div>', unsafe_allow_html=True)
    st.subheader("Rekap Detail & Deteksi Anomali")
    search = st.text_input("🔍 Cari Customer...", placeholder="Ketik nama apotek...")
    tampilkan_detail = st.checkbox("Tampilkan detail per customer (lebih berat)", value=False)
    if tampilkan_detail:
        grouped = df.groupby('customer')
        for customer, data_cust in grouped:
            if search and search.lower() not in customer.lower():
                continue
            label = f"📌 {customer}"
            with st.expander(label):
                st.write(f"**Total Produk:** {data_cust['produk'].nunique()} jenis")
                kolom_tampil = [c for c in ['tanggal', 'produk', 'jumlah', 'kategori'] if c in data_cust.columns]
                st.dataframe(data_cust[kolom_tampil].sort_values('tanggal', ascending=False), use_container_width=True)

    st.markdown('<div class="section-chip">🚨 Waspada Dini</div>', unsafe_allow_html=True)
    st.subheader("Early Warning Lonjakan")
    df_warning = hitung_early_warning(df, faktor_warning)
    if search:
        df_warning = df_warning[df_warning['customer'].str.contains(search, case=False, na=False)]

    if not df_warning.empty:
        df_warning = df_warning.sort_values('kenaikan_persen', ascending=False)
        df_warning['qty_sekarang'] = df_warning['qty_sekarang'].round(0).astype(int)
        df_warning['rata_3_bulan'] = df_warning['rata_3_bulan'].round(1)
        df_warning['kenaikan_persen'] = df_warning['kenaikan_persen'].round(1)
        st.dataframe(df_warning, use_container_width=True)
    else:
        st.success("Tidak ada lonjakan melebihi ambang pada periode yang dipilih.")
        st.caption("Mantap! Pola transaksi masih stabil pada periode ini.")

    st.session_state.filtered_df = df.copy()
    st.session_state.warning_df = df_warning.copy()
    st.session_state.filter_info = buat_ringkasan_filter(df, pilihan_customer, pilihan_produk)
    st.session_state.faktor_warning = faktor_warning

else:
    st.info("👋 Selamat datang, Pak! Silakan unggah file Excel di sidebar untuk memulai analisis.")
    
    # --- 5. CHAT BOX ASISTEN APJ (Gaya Modern) ---
st.divider()
st.subheader("🤖 Asisten APJ (AI Chat)")
st.markdown(
    """
    <div class="chat-hero">
      <h4>💬 Chat Analitik Pintar</h4>
      <p>Tanyakan apa saja dari data terfilter: produk, customer, lonjakan, sampai insight audit.</p>
    </div>
    """,
    unsafe_allow_html=True
)
st.markdown('<div class="quick-hint">⚡ Pertanyaan cepat (klik):</div>', unsafe_allow_html=True)
st.markdown('<div class="chat-toolbar">Tips: gunakan nama produk/customer agar jawaban makin presisi.</div>', unsafe_allow_html=True)

if "pending_prompt" not in st.session_state:
    st.session_state.pending_prompt = None

q1, q2, q3, q4, q5 = st.columns(5)
if q1.button("Ringkasan data", use_container_width=True):
    st.session_state.pending_prompt = "Tolong beri ringkasan data saat ini"
if q2.button("Top 5 produk", use_container_width=True):
    st.session_state.pending_prompt = "Top produk terbesar apa saja?"
if q3.button("Top customer", use_container_width=True):
    st.session_state.pending_prompt = "Top customer berdasarkan volume"
if q4.button("Cek lonjakan", use_container_width=True):
    st.session_state.pending_prompt = "Ada warning lonjakan apa saja?"
if q5.button("🧹 Clear Chat", use_container_width=True):
    st.session_state.messages = [
        {"role": "assistant", "content": "Chat dibersihkan. Siap analisa lagi dari data terfilter terbaru."}
    ]
    st.session_state.pending_prompt = None
    st.rerun()

# Inisialisasi riwayat chat agar tidak hilang saat rerun
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Ada yang bisa saya bantu analisa dari data ini, Pak?"}
    ]

# Menampilkan riwayat chat dengan logo robot
for message in st.session_state.messages:
    avatar = "🤖" if message["role"] == "assistant" else "👤"
    with st.chat_message(message["role"], avatar=avatar):
        bubble_class = "assistant-bubble" if message["role"] == "assistant" else "user-bubble"
        st.markdown(f'<div class="{bubble_class}">{message["content"]}</div>', unsafe_allow_html=True)

# Input Chat dari User
typed_prompt = st.chat_input("Ketik pertanyaan analisa Anda di sini...")
prompt = typed_prompt or st.session_state.get("pending_prompt")
if prompt:
    st.session_state.pending_prompt = None
    # Simpan pesan user
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user", avatar="👤"):
        st.markdown(f'<div class="user-bubble">{prompt}</div>', unsafe_allow_html=True)

    # Logika Jawaban Asisten berbasis data terfilter aktif
    with st.chat_message("assistant", avatar="🤖"):
        with st.spinner("Sedang menganalisa data terfilter..."):
            response = jawab_pertanyaan_data(
                prompt=prompt,
                df_filter=st.session_state.get("filtered_df"),
                df_warning=st.session_state.get("warning_df"),
                faktor_warning=st.session_state.get("faktor_warning", 1.0),
                filter_info=st.session_state.get("filter_info", "Filter belum aktif.")
            )
        
        st.markdown(f'<div class="assistant-bubble">{response}</div>', unsafe_allow_html=True)
        st.session_state.messages.append({"role": "assistant", "content": response})