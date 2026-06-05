require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'sakshamaggarwal1253@gmail.com' });
  console.log('User found:', user ? 'Yes' : 'No');
  if (user) {
    console.log('User password field type:', typeof user.password);
    console.log('User password value:', user.password);
    console.log('User password length:', user.password ? user.password.length : 0);
  }
  process.exit(0);
}

check();
