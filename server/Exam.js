const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: [true, 'Please add the question text'],
    },
    options: {
        type: [String],
        default: [],
        validate: [v => v.length === 0 || v.length >= 2, 'A multiple choice question must have at least 2 options']
    },
    correctAnswer: {
        type: String,
        required: [true, 'Please specify the correct answer'],
    }
}); 

const examSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please add an exam title'],
            trim: true,
        },
        description: {
            type: String,
        },
        duration: {
            type: Number,
            required: [true, 'Please specify the exam duration in minutes'],
            min: [1, 'Exam duration must be at least 1 minute'],
        },
        accessCode: {
            type: String,
            default: ''
        },
        startTime: {
            type: Date
        },
        endTime: {
            type: Date
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        questions: [questionSchema],
        status: {
            type: String,
            enum: ['Draft', 'Published'],
            default: 'Draft' 
        },

    },
    { timestamps: true }
);

examSchema.pre('validate', function () {
    if (this.startTime && this.endTime && new Date(this.endTime) <= new Date(this.startTime)) {
        this.invalidate('endTime', 'End time must be after start time');
    }
});

module.exports = mongoose.model('Exam', examSchema);