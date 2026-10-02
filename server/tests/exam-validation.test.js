const test = require('node:test');
const assert = require('node:assert/strict');
const examsRouter = require('../exams');
const Exam = require('../Exam');

test('exam model validation hook works with the installed Mongoose version', async () => {
  const exam = new Exam({ title: 'Validation probe', duration: 30, createdBy: '507f1f77bcf86cd799439011' });
  await assert.doesNotReject(exam.validate());
});

test('exam validation rejects invalid duration and time windows', () => {
  assert.match(examsRouter.validateExamInput({ duration: 0 }), /at least 1 minute/);
  assert.match(examsRouter.validateExamInput({ startTime: '2026-10-02', endTime: '2026-10-01' }), /after start time/);
  assert.equal(examsRouter.validateExamInput({ duration: 30, startTime: '2026-10-01', endTime: '2026-10-02' }), null);
});

test('question validation requires valid options and matching multiple-choice answers', () => {
  assert.match(examsRouter.validateQuestionInput({ questionText: 'Q', options: ['A'], correctAnswer: 'A' }), /at least 2 options/);
  assert.match(examsRouter.validateQuestionInput({ questionText: 'Q', options: ['A', 'B'], correctAnswer: 'C' }), /match one/);
  assert.equal(examsRouter.validateQuestionInput({ questionText: 'Q', options: [], correctAnswer: 'Free text' }), null);
});