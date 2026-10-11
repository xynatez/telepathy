# Telepathy Lab.

Website statis untuk Telepathy Lab. Semua foto, font, dokumen, CSS, dan JavaScript ada di dalam paket ini. Buat preview lokal, buka lewat server HTTP supaya pembaca buku bisa mengambil halaman.

Untuk hosting, unggah seluruh isi paket ke direktori publik pada layanan hosting statis. Pertahankan struktur folder dan huruf besar pada nama file. Website tidak membutuhkan backend atau proses build tambahan.

Source yang bisa diedit:

- `index.html`: isi halaman dan formulir.
- `css/style.css`: layout, warna, tipografi, dan animasi.
- `js/script.js`: data 19 foto, galeri, formulir, dan animasi scroll yang bisa terulang.
- `js/flipbook.js`: pembaca buku, navigasi halaman, zoom, dan tampilan lebar.
- `assets/documents`: Pricelist 2026, Size chart Regular Fit, dan handbook terbaru.
- `assets/books`: 32 halaman WebP hasil render PDF dan manifest untuk pembaca buku.
- `assets/fonts`: font lokal beserta lisensinya.
- `assets/hero`: foto pembuka dalam tiga ukuran layar; foto asli tetap ada di `img` buat galeri.

Formulir menyusun pesan yang bisa dicek sebelum lanjut ke WhatsApp. Nomor kontaknya 085720071185 (`6285720071185` untuk tautan WhatsApp).

Pembaca buku baru memuat halaman pertama saat terlihat. Halaman berikutnya dimuat saat dipilih, tanpa mengambil seluruh PDF atau memuat halaman lain lebih dulu. Enam halaman terakhir disimpan selama sesi agar penggunaan memori tetap terbatas. Tombol unduh mengambil PDF asli secara lengkap. Pembaca memakai gambar halaman karena PDF yang diberikan berisi artwork tanpa lapisan teks. Teks OCR dari setiap halaman tersedia bagi pembaca layar; gambar dan PDF asli tetap jadi acuan jika OCR salah membaca karakter.

Judul dan foto masuk bertahap saat web dibuka. Animasi section terulang setelah konten keluar dari layar lalu masuk lagi. Animasi menghormati preferensi reduced motion dan menjaga konten yang sedang difokuskan tetap terlihat. Scroll tetap memakai perilaku bawaan browser. Galeri dan buku bisa dipakai dengan keyboard; buku juga mendukung geser horizontal di ponsel. Saat buku dibuka lebar, scroll mengganti halaman. Kalau halaman diperbesar, scroll menggeser halaman buat membaca detailnya. Tanpa JavaScript, tautan unduh PDF dan contoh foto tetap tersedia.
