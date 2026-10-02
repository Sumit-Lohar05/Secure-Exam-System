const test = require('node:test');
const assert = require('node:assert/strict');
const authRouter = require('../auth');

test('environment config resolves reset URLs and API origins without hardcoded localhost values', () => {
  const originalFrontend = process.env.FRONTEND_URL;
  const originalApi = process.env.API_BASE_URL;

  process.env.FRONTEND_URL = 'https://app.example.com';
  process.env.API_BASE_URL = 'https://api.example.com/api';

  try {
    assert.equal(authRouter.buildResetUrl('demo-token'), 'https://app.example.com/reset-password/demo-token');
    assert.equal(authRouter.getApiBaseUrl(), 'https://api.example.com/api');
  } finally {
    if (originalFrontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = originalFrontend;
    if (originalApi === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = originalApi;
  }
});
