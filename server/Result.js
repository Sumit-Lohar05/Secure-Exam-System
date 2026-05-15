const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    answers: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
