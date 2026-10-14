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
│   └── vendor/heic2any.min.js   <- pembaca foto HEIC (iPhone)
└── assets/
    ├── logo.png
    ├── favicon.png
    └── frame/
        └── frame1.png ... frame5.png   <- taruh frame PNG transparan di sini
```

## Fitur
- Upload banyak foto (JPG, PNG, WEBP, HEIC), geser & zoom, Gaussian blur background (rekomendasi 20 px)
- Frame sama untuk semua foto, atau berbeda tiap foto (centang "Frame berbeda untuk tiap foto")
- Download satuan, atau semua sekaligus dalam satu `.zip`
- Setiap hasil dijaga di bawah 2 MB

## Frame
Nama file harus `frame1.png` sampai `frame5.png` (sudah didaftarkan di `js/config.js`).
Pakai PNG transparan, disarankan persegi (mis. 1080x1080). Ukuran hasil mengikuti ukuran frame.
Kalau file frame belum ada, website memakai frame contoh sementara.

## Deploy
Push ke GitHub, lalu **Settings > Pages > Deploy from branch (main, /root)**.

## Test di komputer
JANGAN buka `index.html` dengan double-click (alamat diawali `file://`). Browser menganggap frame
sebagai file asing sehingga download diblokir ("Tainted canvas"). Pilih salah satu:
- Klik dua kali `jalankan-lokal.bat` (Windows, perlu Python atau Node.js), lalu buka http://localhost:8000
- VS Code + ekstensi Live Server, klik kanan `index.html` > Open with Live Server
- `npx serve` atau `python -m http.server`
Di GitHub Pages (https) tidak ada masalah ini.

## Kompres
PNG dicoba dulu. Kalau di atas 2 MB, otomatis jadi JPEG dengan kualitas tertinggi yang masih muat,
dan kalau masih besar dimensinya dikecilkan bertahap.
