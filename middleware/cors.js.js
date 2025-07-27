// cors.js - Cloudflare-proxied domain whitelist
const allowedOrigins = [
  'https://immortalal.github.io',
  'https://mlnf.net',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'https://immortal.u',
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
  'https://gateway.ipfs.io'
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
  allowedHeaders: ['Content-Type','Authorization','Cache-Control','Pragma','Expires']
});