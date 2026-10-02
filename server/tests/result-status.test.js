const test = require('node:test');
const assert = require('node:assert/strict');
const Result = require('../Result');
const examsRouter = require('../exams');

test('Result schema tracks draft and completed statuses explicitly', () => {
  const statusField = Result.schema.path('status');

  assert.ok(statusField, 'status field should exist on Result schema');
  assert.strictEqual(statusField.defaultValue, 'In Progress');
  assert.deepEqual(statusField.enumValues, ['In Progress', 'Completed']);
});

test('Result enforces one attempt per student and exam', () => {
  const indexes = Result.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => (
    fields.examId === 1 && fields.studentId === 1 && options.unique === true
  )));
  assert.equal(examsRouter.isDuplicateResultError({
    code: 11000,
    keyPattern: { examId: 1, studentId: 1 }
  }), true);
});

test('Draft attempts are resumable and are not treated as completed attempts', () => {
  assert.equal(examsRouter.getResultStatus({ status: 'In Progress', score: -1 }), 'In Progress');
  assert.equal(examsRouter.getResultStatus({ status: 'Completed', score: 5 }), 'Completed');
  assert.equal(examsRouter.getResultStatus({ score: 0 }), 'Completed');
  assert.equal(examsRouter.getResultStatus({ status: 'In Progress', score: 0 }), 'In Progress');
});
