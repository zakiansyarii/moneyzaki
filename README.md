# RuangUang — Dashboard Keuangan Pribadi

Dashboard responsif berbasis HTML, Tailwind CSS, dan Chart.js. Secara default aplikasi berjalan tanpa backend dalam mode demo dan menyimpan data di browser. Untuk berbagi data secara publik antarperangkat, hubungkan Google Sheets melalui Apps Script.

## Struktur

- `index.html` — halaman dashboard dan formulir transaksi.
- `style.css` — tema, responsif, animasi, dan komponen.
- `script.js` — ringkasan, grafik, filter, penyimpanan, dan komunikasi API.
- `apps-script/Code.gs` — endpoint Google Apps Script.

## Hubungkan Google Sheets

1. Buat Google Spreadsheet baru.
2. Dari spreadsheet, pilih **Extensions → Apps Script**.
3. Ganti isi file `Code.gs` dengan kode dari `apps-script/Code.gs`, lalu simpan. Nama sheet `Transactions` dan header akan dibuat otomatis saat endpoint pertama kali dipanggil.
4. Pilih **Deploy → New deployment → Web app**. Atur **Execute as: Me** dan **Who has access: Anyone**, lalu deploy dan setujui otorisasi Google.
5. Salin URL Web App yang berakhiran `/exec`.
6. Di `script.js`, isi `API_URL` dengan URL tersebut, contoh: `const API_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";`.
7. Publikasikan ulang versi Web App jika Anda mengubah kode Apps Script. Muat ulang dashboard dan pilih **Sinkronkan**.

Endpoint menerima `GET` untuk membaca data, serta `POST` dengan `action: "create"` atau `"update"` untuk menambah dan memperbarui transaksi. Permintaan tulis memakai `text/plain` agar tidak memicu preflight CORS Apps Script. Perbarui transaksi melalui POST `action: "update"`; Apps Script Web App tidak menyediakan routing PUT langsung yang konsisten.

## Deploy instan ke Vercel

1. Unggah file proyek ini ke repository GitHub (atau buka folder proyek dengan Vercel CLI).
2. Di [vercel.com](https://vercel.com), pilih **Add New → Project**, impor repository tersebut, lalu tekan **Deploy**. Tidak ada proses build atau framework preset yang diperlukan.
3. Untuk deploy melalui CLI: jalankan `npm i -g vercel`, lalu `vercel` dari folder proyek dan ikuti instruksi.
4. Buka URL deployment. Frontend statis bisa berjalan tanpa API, tetapi data hanya tersimpan di browser sampai `API_URL` dihubungkan ke Apps Script.

## Catatan akses publik

Endpoint dengan akses **Anyone** berarti pengunjung dapat membaca dan menulis ke spreadsheet. Jangan menyimpan data sensitif atau informasi rekening/kredensial. Spreadsheet hanya dapat diubah lewat identitas pemilik script, tetapi siapa pun yang mengetahui URL endpoint dapat menggunakan fungsi publik yang tersedia. Untuk data pribadi yang sebenarnya, gunakan autentikasi dan backend dengan kontrol akses sebelum membuka dashboard ke internet.
