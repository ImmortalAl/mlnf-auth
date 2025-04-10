// cors.js - Cloudflare-proxied domain whitelist
const allowedOrigins = [
  'https://immortalal.github.io',
  'https://mlnf.net',
  'http://localhost:3000'
];

module.exports = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Cosmic transmission blocked by CORS shield'));
    }
  },
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
});