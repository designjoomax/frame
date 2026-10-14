# JOOMAX SITE - Menambahkan Frame Logo

Website statis (HTML/CSS/JS) untuk menambahkan frame ke foto. Upload banyak foto, pilih frame,
atur posisi (geser & zoom), opsional Gaussian blur background (default 20 px), lalu download. Hasil otomatis di bawah 2 MB.

## Struktur
```
joomax-site/
├── index.html
├── css/style.css
├── js/
│   ├── config.js        <- daftar frame & batas ukuran
│   ├── app.js
│   ├── frames-data.js   <- frame yang disematkan (dibuat oleh tools/embed-frames.html)
│   └── vendor/heic2any.min.js   <- pembaca foto HEIC (iPhone)
├── tools/embed-frames.html
└── assets/
    ├── logo.png
    ├── favicon.png
    └── frame/
        └── frame1.png ... frame5.png   <- taruh frame PNG transparan di sini
```

## Fitur
- Upload banyak foto (JPG, PNG, WEBP, HEIC), geser & zoom (-100 s/d +100, 0 = pas memenuhi frame), Gaussian blur background (rekomendasi 20 px)
- Frame sama untuk semua foto, atau berbeda tiap foto (centang "Frame berbeda untuk tiap foto")
- Download satuan, atau semua sekaligus dalam satu `.zip`
- Setiap hasil dijaga di bawah 2 MB

## Frame
Nama file harus `frame1.png` sampai `frame5.png` (sudah didaftarkan di `js/config.js`).
Pakai PNG transparan, disarankan persegi (mis. 1080x1080). Ukuran hasil mengikuti ukuran frame.
Kalau file frame belum ada, website memakai frame contoh sementara.

## Deploy
Push ke GitHub, lalu **Settings > Pages > Deploy from branch (main, /root)**.

## Cara menjalankan
**A. Tanpa server (double-click `index.html`)**
Browser memblokir download kalau frame dibaca dari file lokal, jadi frame perlu disematkan dulu:
1. Buka `tools/embed-frames.html` (double-click).
2. Pilih semua frame (`frame1.png` - `frame5.png`), klik **Download frames-data.js**.
3. Simpan ke folder `js/` dan timpa `frames-data.js`.
4. Buka `index.html`. Ulangi langkah 1-3 setiap kali frame diganti.

**B. Lewat server / GitHub Pages**
Di GitHub Pages frame dibaca langsung dari `assets/frame/`, tidak perlu langkah A.
Untuk tes lokal pakai `jalankan-lokal.bat`, Live Server (VS Code), atau `npx serve`.

## Kompres
PNG dicoba dulu. Kalau di atas 2 MB, otomatis jadi JPEG dengan kualitas tertinggi yang masih muat,
dan kalau masih besar dimensinya dikecilkan bertahap.
