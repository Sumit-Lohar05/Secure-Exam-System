const test = require('node:test');
const assert = require('node:assert/strict');
const authRouter = require('../auth');

test('admin user serialization excludes password, OTP, and reset-token fields', () => {
  const serializeAdminUser = authRouter.serializeAdminUser;
  const user = serializeAdminUser({
    _id: 'user-1',
    name: 'Example User',
    email: 'user@example.com',
    role: 'student',
    isVerified: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    password: 'hashed-password',
    verificationOtp: 'hashed-otp',
    verificationOtpExpire: '2026-09-28T01:00:00.000Z',
    resetPasswordToken: 'hashed-reset-token',
    resetPasswordExpire: '2026-09-28T01:00:00.000Z'
  });

  assert.deepEqual(user, {
    _id: 'user-1',
    name: 'Example User',
    email: 'user@example.com',
    role: 'student',
    isVerified: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z'
  });
});