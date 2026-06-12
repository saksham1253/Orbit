const mongoose = require('mongoose');
const User = require('./models/user');
const authController = require('./controllers/authController');

async function test() {
  const req = { body: { email: 'test@example.com' } };
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return {
        json: (data) => {
          console.log('JSON:', data);
        }
      };
    }
  };
  
  // Mock User.findOne to return a valid user object that we can save
  User.findOne = async () => {
    return new User({
      name: 'Test',
      email: 'test@example.com',
      password: 'hashedpassword',
    });
  };
  
  // Mock sendEmail
  jest = { mock: () => {} }; // just to avoid crash if sendEmail is called
  
  await authController.forgotPassword(req, res);
}

test().catch(console.error);
