// auth.js - Simplified JWT implementation
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

router.post('/signin', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ error: "Cosmic traveler not found" });

  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) return res.status(401).json({ error: "Stellar alignment failed" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
    expiresIn: '1h' 
  });
  
  res.cookie('refreshToken', createRefreshToken(user._id), { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  
  res.json({ token, username: user.stellarAlias });
});