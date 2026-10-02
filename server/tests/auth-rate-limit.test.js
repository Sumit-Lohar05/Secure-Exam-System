const test = require('node:test');
const assert = require('node:assert/strict');
const authRouter = require('../auth');

test('rate limiter blocks repeated requests after the configured threshold', () => {
  const limiter = authRouter.createRateLimiter({ windowMs: 60000, maxRequests: 2 });
  const req = { ip: '203.0.113.10', body: { email: 'student@example.com' } };

  assert.equal(limiter.allow(req), true);
  assert.equal(limiter.allow(req), true);
  assert.equal(limiter.allow(req), false);
});
