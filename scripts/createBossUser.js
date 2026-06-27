/**
 * Script to create the initial BOSS user
 * Run this once to set up your first admin user
 * 
 * Usage: node scripts/createBossUser.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createBossUser() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_DB_URI || 'mongodb://127.0.0.1:27017/auctioner';
    console.log('\n🔌 Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Import User model
    const User = require('../models/user');

    // Check if a boss user already exists
    const existingBoss = await User.findOne({ role: 'boss' });
    if (existingBoss) {
      console.log('⚠️  A boss user already exists:');
      console.log(`   Name: ${existingBoss.name}`);
      console.log(`   Email: ${existingBoss.email}\n`);
      
      const overwrite = await question('Do you want to create another boss user? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('\n❌ Boss user creation cancelled.');
        await mongoose.disconnect();
        rl.close();
        return;
      }
    }

    console.log('='.repeat(50));
    console.log('CREATE BOSS USER');
    console.log('='.repeat(50));
    console.log('');

    // Get user input
    const name = await question('Enter full name: ');
    const email = await question('Enter email: ');
    const password = await question('Enter password (min 6 characters): ');

    // Validate input
    if (!name || !email || !password) {
      console.log('\n❌ All fields are required!');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.log('\n❌ Password must be at least 6 characters long!');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('\n❌ Invalid email format!');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('\n❌ A user with this email already exists!');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Create boss user
    const bossUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // Will be encrypted by pre-save hook
      role: 'boss',
      isActive: true
    });

    await bossUser.save();

    console.log('\n' + '='.repeat(50));
    console.log('✅ BOSS USER CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('');
    console.log('User Details:');
    console.log(`   Name: ${bossUser.name}`);
    console.log(`   Email: ${bossUser.email}`);
    console.log(`   Role: ${bossUser.role}`);
    console.log(`   Status: Active`);
    console.log('');
    console.log('Permissions:');
    console.log('   ✓ Can create super users');
    console.log('   ✓ Can create tournament hosts');
    console.log('   ✓ Can manage all tournaments, teams, and players');
    console.log('');
    console.log('You can now login at: http://localhost:5173/login');
    console.log('');

    await mongoose.disconnect();
    rl.close();
  } catch (error) {
    console.error('\n❌ Error creating boss user:', error.message);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
  }
}

// Run the script
createBossUser();
