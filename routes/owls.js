const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const owlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/send-owl', owlLimiter, async (req, res) => {
  const { email, url } = req.body;
  if (!validateEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Ancient Scrolls <noreply@mlnf.net>',
      to: email,
      subject: '📜 A Sacred Scroll Awaits Your Gaze',
      html: `<div style="max-width:600px;margin:0 auto;background:#f5eedc;padding:2rem;border:2px solid #3a2e28;"><h2 style="color:#3a2e28;font-family:'Palatino',serif;">🦉 An Owl Bears Wisdom</h2><p style="font-size:1.1rem;">A fellow seeker has shared this ancient knowledge with you:<br><a href="${url}" style="color:#d4af37;text-decoration:none;">${url}</a></p><hr style="border-color:#3a2e2855;"><p style="font-style:italic;">"Wisdom flies on silent wings - guard it well"</p></div>`
    });
    res.json({ success: true, message: 'Owl dispatched successfully.' });
  } catch (error) {
    console.error('Owl delivery failed:', error);
    res.status(500).json({ success: false, message: 'The owl became lost in the mists.' });
  }
});

module.exports = router; 