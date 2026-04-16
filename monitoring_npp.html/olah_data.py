import pandas as pd
import json

nama_file = 'master_customer_ams.csv'

try:
    # 1. Baca file CSV dengan deteksi separator otomatis
    df = pd.read_csv(nama_file, sep=None, engine='python', encoding='latin1')
    print("✅ Berhasil membaca file!")

    # 2. Perbaikan Format Tanggal
    # Menangani format beragam seperti 14-Aug-26 atau 2026-08-14
    df['Masa_Berlaku_Ijin_Outlet'] = pd.to_datetime(df['Masa_Berlaku_Ijin_Outlet'], dayfirst=False, errors='coerce')
    df['Tgl_Teks'] = df['Masa_Berlaku_Ijin_Outlet'].dt.strftime('%Y-%m-%d')

    # 3. Pilih kolom yang TERBUKTI ADA di file Anda
    # Kita hilangkan 'CHANNEL' karena tidak ditemukan di CSV Anda
    df_clean = df[['Nama_Sarana', 'Nama_APJ', 'No_Ijin_Outlet', 'Tgl_Teks']].copy()
    
    # Ganti nama kolom Tgl_Teks kembali ke nama aslinya untuk dipakai di JS
    df_clean.rename(columns={'Tgl_Teks': 'Masa_Berlaku_Ijin_Outlet'}, inplace=True)

    # 4. Ubah ke JSON (Gunakan Nama_Sarana sebagai index/kunci pencarian)
    data_dict = df_clean.set_index('Nama_Sarana').to_json(orient='index')

    # 5. Simpan ke file JS
    with open('data_pelanggan.js', 'w') as f:
        f.write(f"const dataPelanggan = {data_dict};")
    
    print("🚀 SUKSES! File 'data_pelanggan.js' sudah diperbarui.")
    print("Sekarang Anda bisa buka index.html dan cari nama outletnya.")

except Exception as e:
    print(f"❌ Terjadi kesalahan: {e}")