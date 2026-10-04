import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = process.env.APP_NAME || 'Dulz strm';
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;

app.use(cors({ origin: FRONTEND_URL, credentials: false }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const otpStore = new Map();
const RATE = new Map();
const OTP_TTL = 10 * 60 * 1000;
const RESEND_GAP = 60 * 1000;
const MAX_ATTEMPTS = 5;

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}
function makeOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.get('/auth/config', (req, res) => {
  res.json({ emailOtp: true, github: false, google: false });
});

app.post('/auth/email/send', async (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ message: 'Email tidak valid' });

  const now = Date.now();
  const last = RATE.get(email) || 0;
  if (now - last < RESEND_GAP) {
    const wait = Math.ceil((RESEND_GAP - (now - last)) / 1000);
    return res.status(429).json({ message: `Tunggu ${wait} detik sebelum meminta kode lagi` });
  }

  const code = makeOtp();
  otpStore.set(email, { hash: hashOtp(code), expires: now + OTP_TTL, attempts: 0 });
  RATE.set(email, now);

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: `${APP_NAME} — Kode Login`,
      text: `Kode login ${APP_NAME}: ${code}\n\nKode berlaku selama 10 menit. Jangan bagikan kode ini kepada orang lain.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${APP_NAME}</h2><p>Kode login kamu:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</div><p>Kode berlaku selama 10 menit.</p><p>Jangan bagikan kode ini kepada orang lain.</p></div>`
    });
    return res.json({ ok: true, message: 'Kode berhasil dikirim' });
  } catch (err) {
    otpStore.delete(email);
    RATE.delete(email);
    console.error('SMTP error:', err.message);
    return res.status(500).json({ message: 'Gagal mengirim email. Periksa konfigurasi SMTP server.' });
  }
});

app.post('/auth/email/verify', (req, res) => {
  const email = cleanEmail(req.body?.email);
  const code = String(req.body?.code || '').replace(/\D/g, '');
  const item = otpStore.get(email);

  if (!item) return res.status(400).json({ message: 'Kode tidak ditemukan atau sudah kedaluwarsa' });
  if (Date.now() > item.expires) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'Kode sudah kedaluwarsa' });
  }
  if (item.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return res.status(429).json({ message: 'Terlalu banyak percobaan. Minta kode baru.' });
  }

  item.attempts++;
  if (hashOtp(code) !== item.hash) return res.status(400).json({ message: 'Kode OTP salah' });

  otpStore.delete(email);
  const token = crypto.randomBytes(32).toString('hex');
  return res.json({ ok: true, token, user: { name: email.split('@')[0], email, provider: 'email' } });
});

app.get('/auth/me', (req, res) => {
  if (!req.headers.authorization) return res.status(401).json({ message: 'Belum login' });
  return res.status(200).json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`${APP_NAME} OTP server: http://localhost:${PORT}`);
});
