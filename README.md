# JOOMAX SITE - Menambahkan Frame Logo

Website statis (HTML/CSS/JS) untuk menambahkan frame ke foto. Upload banyak foto, pilih frame,
atur posisi (geser & zoom), opsional Gaussian blur background (default 20 px), lalu download. Hasil otomatis di bawah 2 MB.

## Fitur
- Layout 3 kolom: Pilih Frame (kiri), area foto (tengah), pengaturan foto terpilih (kanan)
- Upload banyak foto (JPG, PNG, WEBP, HEIC). 1 foto tampil penuh di tengah, beberapa foto tampil sebagai grid
- Klik foto di grid untuk mengedit: geser, zoom (-100 s/d +100), rotasi 90°, flip horizontal/vertikal, Gaussian blur background
- Urutan foto bisa diatur dengan drag di grid, atau tombol panah di panel kanan
- Hasil dinamai sesuai urutan (`1.png`, `2.png`, ...). ZIP selalu bernama `Frame Joomax by Fixs.Arts.zip`
- Frame sama untuk semua foto, atau berbeda tiap foto (centang "Frame berbeda tiap foto")
- Setiap hasil dijaga di bawah 2 MB (PNG dulu, kalau lebih besar otomatis JPG)

## Struktur
```
joomax-site/
├── index.html
├── update-frames.bat    <- klik setelah mengubah isi assets/frame/
├── css/style.css        <- semua tampilan & warna (variabel di :root)
├── js/
│   ├── config.js        <- batas ukuran file (2 MB)
│   ├── frames.js        <- daftar frame (otomatis)
│   ├── frames-data.js   <- isi frame untuk mode file:// (otomatis)
│   ├── app.js
│   └── vendor/heic2any.min.js
├── tools/               <- update-frames.ps1, embed-frames.html
└── assets/
    ├── logo.png, favicon.png, footer.png
    └── frame/           <- taruh frame PNG transparan di sini
```

## Menambah / mengganti frame (tanpa edit JavaScript)
1. Taruh file `.png` (transparan, disarankan persegi) di `assets/frame/`.
2. Klik dua kali **`update-frames.bat`** (Windows). Mac/Linux: buka `tools/embed-frames.html`.
3. Selesai. Semua `.png` di folder itu otomatis tampil. Tidak ada frame contoh: hanya file asli yang muncul.

**Urutan & nama** diatur lewat nama file:
- `1 Frame Joomax.png` -> tampil "Frame Joomax" di urutan 1
- `2 Frame Merah.png` -> tampil "Frame Merah" di urutan 2
- `Frame non Logo.png` (tanpa angka) -> tampil "Frame non Logo", ditaruh setelah yang bernomor

Setiap kali menambah, menghapus, atau mengganti nama frame, jalankan lagi langkah 2.
Browser tidak bisa membaca isi folder sendiri, jadi langkah itu yang membuat `js/frames.js` (daftar frame)
dan `js/frames-data.js` (isi frame untuk mode tanpa server).

## Cara menjalankan
**A. Tanpa server (double-click `index.html`)**
Langsung jalan setelah `update-frames.bat` dijalankan (frame dibaca dari `js/frames-data.js`).

**B. Lewat server / GitHub Pages**
Di GitHub Pages frame dibaca langsung dari `assets/frame/` (daftar dari `js/frames.js`). `js/frames-data.js` hanya dipakai saat dibuka lewat file://, jadi pengunjung web tidak mengunduhnya.
Untuk tes lokal pakai `jalankan-lokal.bat`, Live Server (VS Code), atau `npx serve`.

## Mengganti watermark footer
Footer saat ini memakai `assets/Footer.png`. Untuk GIF, ubah `src` gambar footer di `index.html` ke file `.gif`.
Untuk iklan video, ganti elemen `<img>` footer dengan `<video src="assets/Footer.mp4" autoplay muted loop playsinline></video>`.
Taruh file media di folder `assets/`. Video dibuat mute agar bisa autoplay dan berulang. Ukuran media mengikuti lebar layar
dan rasio asli file, tanpa batas tinggi CSS atau pemotongan. Jika memakai media yang lebih tinggi, sesuaikan `--footer-space`
di `css/style.css` agar konten halaman tetap tidak tertutup footer.

## Menambahkan popup iklan/notifikasi
Taruh gambar PNG atau GIF di `assets/`, lalu ubah `src` gambar pada elemen `#siteNotice` di `index.html`
(contoh: `assets/iklan.gif`) dan hapus atribut `hidden` dari elemen tersebut agar popup tampil.
Popup muncul di sisi kanan dan dapat ditutup dengan tombol ×; setelah halaman dimuat ulang, popup tampil kembali.
Sesuaikan `--notice-width`, `--notice-right`, dan `--notice-top` di `css/style.css` untuk mengatur ukuran dan posisi.
Posisi `top` adalah titik tengah vertikal popup. Gambar menjaga rasio aslinya dan dibatasi tinggi layar agar tetap terlihat.

## Kompres
PNG dicoba dulu. Kalau di atas 2 MB, otomatis jadi JPEG dengan kualitas tertinggi yang masih muat,
dan kalau masih besar dimensinya dikecilkan bertahap.
