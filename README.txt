DULZ STRM - SERVER OTP EMAIL

1. Install Node.js.
2. Masuk ke folder ini.
3. Jalankan: npm install
4. Salin .env.example menjadi .env
5. Isi SMTP_USER dan SMTP_PASS.
   Untuk Gmail, gunakan App Password, bukan password Gmail biasa.
6. Jalankan: npm start
7. Buka: http://localhost:3000

Jika frontend di-host terpisah (mis. GitHub Pages), buka public/index.html
lalu sebelum script utama tambahkan:
<script>window.DULZ_API='https://ALAMAT-SERVER-KAMU';</script>

Server menyediakan:
GET  /auth/config
POST /auth/email/send
POST /auth/email/verify
GET  /auth/me
