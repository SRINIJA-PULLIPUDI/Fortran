// Run with: npm run seed
// Creates one admin user and two practice problems (with test cases) so you
// have something to click through immediately after setup.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seed] Connected to MongoDB');

  let admin = await User.findOne({ userId: 'admin' });
  if (!admin) {
    admin = await User.create({
      fullName: 'Admin User',
      userId: 'admin',
      email: 'admin@example.com',
      password: 'Admin@123',
      role: 'admin',
    });
    console.log('[Seed] Created admin user -> userId: admin / password: Admin@123');
  } else {
    console.log('[Seed] Admin user already exists, skipping');
  }

  const existing = await Problem.findOne({ code: 'SUM-TWO' });
  if (!existing) {
    const p1 = await Problem.create({
      name: 'Sum of Two Numbers',
      statement: 'Read two space-separated integers A and B from stdin. Print their sum.',
      code: 'SUM-TWO',
      difficulty: 'Easy',
      tags: ['math', 'basics'],
      isPractice: true,
      createdBy: admin._id,
    });
    await TestCase.insertMany([
      { problem: p1._id, input: '2 3', output: '5', isSample: true },
      { problem: p1._id, input: '10 20', output: '30', isSample: true },
      { problem: p1._id, input: '-5 5', output: '0', isSample: false },
      { problem: p1._id, input: '100 200', output: '300', isSample: false },
    ]);
    console.log('[Seed] Created problem SUM-TWO');
  }

  const existing2 = await Problem.findOne({ code: 'REVERSE-STR' });
  if (!existing2) {
    const p2 = await Problem.create({
      name: 'Reverse a String',
      statement: 'Read a single line string S from stdin. Print S reversed.',
      code: 'REVERSE-STR',
      difficulty: 'Easy',
      tags: ['strings'],
      isPractice: true,
      createdBy: admin._id,
    });
    await TestCase.insertMany([
      { problem: p2._id, input: 'hello', output: 'olleh', isSample: true },
      { problem: p2._id, input: 'mern', output: 'nrem', isSample: true },
      { problem: p2._id, input: 'onlinejudge', output: 'egdujenilno', isSample: false },
    ]);
    console.log('[Seed] Created problem REVERSE-STR');
  }

  console.log('[Seed] Done.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
