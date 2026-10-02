const test = require('node:test');
const assert = require('node:assert/strict');

const examsRouter = require('../exams');

test('student result detail lookup is scoped to the requesting student and completed attempts', () => {
  assert.deepEqual(examsRouter.buildCompletedStudentResultFilter('student-1', 'result-1'), {
    _id: 'result-1',
    studentId: 'student-1',
    $or: [
      { status: 'Completed' },
      { status: { $exists: false }, score: { $ne: -1 } }
    ]
  });
});