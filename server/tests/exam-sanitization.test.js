const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../exams');

test('student exam sanitization strips access codes and correct answers', () => {
  const exam = {
    _id: 'exam-1',
    title: 'Math Test',
    status: 'Published',
    accessCode: 'SECRET',
    questions: [
      { _id: 'q1', questionText: '2+2?', options: ['3', '4'], correctAnswer: '4' },
      { _id: 'q2', questionText: 'Capital of France?', options: ['Paris', 'Rome'], correctAnswer: 'Paris' }
    ]
  };

  const sanitized = router.sanitizeExamForStudent(exam);

  assert.equal(sanitized.accessCode, undefined);
  assert.equal(sanitized.requiresAccessCode, true);
  assert.equal(sanitized.questions[0].correctAnswer, undefined);
  assert.equal(sanitized.questions[1].options[0], 'Paris');
});

test('student exam sanitization marks exams without a code as unprotected', () => {
  const sanitized = router.sanitizeExamForStudent({ title: 'Open exam', accessCode: '  ', questions: [] });

  assert.equal(sanitized.accessCode, undefined);
  assert.equal(sanitized.requiresAccessCode, false);
});

test('student access checks normalize codes and enforce published status', () => {
  const req = { user: { role: 'student' }, body: { accessCode: '  pass-123  ' } };

  assert.deepEqual(router.enforceStudentExamAccess(req, { status: 'Published', accessCode: 'pass-123' }), { ok: true });
  assert.equal(router.enforceStudentExamAccess(req, { status: 'Draft', accessCode: 'pass-123' }).message, 'Exam is not available.');
  assert.equal(router.enforceStudentExamAccess({ user: req.user, body: {} }, { status: 'Published', accessCode: 'pass-123' }).message, 'Invalid or missing access code');
});
