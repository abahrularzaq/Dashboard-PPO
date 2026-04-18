from openai import OpenAI

# 1. SETUP
my_token = "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"
client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=my_token,
)

# 2. MEMORY
memory_percakapan = [
    {"role": "system", "content": "Anda adalah asisten gudang PBF yang teliti dan lucu."}
]

def kirim_pesan(pesan_baru):
    try:
        memory_percakapan.append({"role": "user", "content": pesan_baru})
        
        response = client.chat.completions.create(
            messages=memory_percakapan,
            model="gpt-4o", # Pastikan model ini tersedia di GitHub Models kamu
        )
        
        jawaban_ai = response.choices[0].message.content
        memory_percakapan.append({"role": "assistant", "content": jawaban_ai})
        return jawaban_ai
    except Exception as e:
        return f"Waduh, ada error nih: {e}"

# 3. LOOP INTERAKTIF
print("--- SISTEM AGEN AKTIF (Ketik 'keluar' untuk berhenti) ---")

while True:
    input_user = input("\nKamu: ")
    
    if not input_user.strip(): # Jika user cuma tekan enter tanpa ngetik
        continue
        
    if input_user.lower() == 'keluar':
        print("Agen: Sampai jumpa! Semoga harimu menyenangkan.")
        break
    
    # Memanggil fungsi dan menampilkan jawaban
    print("Sedang berpikir...")
    respon = kirim_pesan(input_user)
    print(f"Agen: {respon}")