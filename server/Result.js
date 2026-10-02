const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    status: {
        type: String,
        enum: ['In Progress', 'Completed'],
        default: 'In Progress'
    },
    answers: { type: Object, default: {} }
}, { timestamps: true });

resultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
