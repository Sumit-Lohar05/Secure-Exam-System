const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../exams');

const adminId = '507f1f77bcf86cd799439011';
const otherAdminId = '507f1f77bcf86cd799439012';

const validResult = {
  _id: '64c0f8ac3b3e6b1d5d7f0c90',
  score: 3,
  totalQuestions: 10,
  examId: { _id: '64c0f8ac3b3e6b1d5d7f0c91', createdBy: adminId }
};

test('admin result validation allows owned exam results and rejects foreign or out-of-range scores', () => {
  const allowed = router.validateAdminResultScope(validResult, adminId);
  assert.equal(allowed.ok, true);

  const foreign = router.validateAdminResultScope(validResult, otherAdminId);
  assert.equal(foreign.ok, false);
  assert.equal(foreign.status, 403);

  const invalidScore = router.validateAdminResultScope({ ...validResult, score: 12 }, adminId);
  assert.equal(invalidScore.ok, false);
  assert.equal(invalidScore.status, 400);
});
