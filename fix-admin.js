const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const admins = await User.find({ role: 'admin' });
    console.log('Current admin users:', admins.map(u => ({ username: u.username, role: u.role })));
    
    // Check if ImmortalAl exists and is admin
    const immortalAl = await User.findOne({ username: /immortalal/i });
    if (immortalAl) {
      console.log('ImmortalAl status:', { username: immortalAl.username, role: immortalAl.role });
      if (immortalAl.role !== 'admin') {
        immortalAl.role = 'admin';
        await immortalAl.save();
        console.log('✅ Updated ImmortalAl to admin role');
      } else {
        console.log('✅ ImmortalAl already has admin role');
      }
    } else {
      console.log('❌ ImmortalAl user not found');
    }
    
    await mongoose.disconnect();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAdmins();