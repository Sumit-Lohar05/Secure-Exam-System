const express = require('express');
const router = express.Router();
const Exam = require('./Exam');
const Result = require('./Result');
const User = require('./User');
const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');
const validateObjectId = require('./validateObjectId');
const sendEmail = require('./utils/sendEmail');

const normalizeAccessCode = (value) => String(value ?? '').trim();

const getResultStatus = (result) => {
    if (!result) return 'In Progress';
    if (result.status === 'Completed') return 'Completed';
    if (result.status === 'In Progress') return 'In Progress';
    if (Number(result.score) === -1 || result.score === undefined) return 'In Progress';
    return 'Completed';
};

const isResultCompleted = (result) => getResultStatus(result) === 'Completed';

const sanitizeExamForStudent = (exam) => {
    if (!exam) return exam;
    const safeExam = exam.toObject ? exam.toObject() : { ...exam };
    safeExam.requiresAccessCode = Boolean(normalizeAccessCode(safeExam.accessCode));
    delete safeExam.accessCode;

    if (Array.isArray(safeExam.questions)) {
        safeExam.questions = safeExam.questions.map((question) => {
            const sanitizedQuestion = { ...question };
            delete sanitizedQuestion.correctAnswer;
            return sanitizedQuestion;
        });
    }

    return safeExam;
};

const enforceStudentExamAccess = (req, exam, existingResult = null) => {
    if (!exam || req.user.role === 'admin') {
        return { ok: true };
    }

    if (exam.status !== 'Published') {
        return { ok: false, status: 403, message: 'Exam is not available.' };
    }

    const now = new Date();
    if (exam.startTime && now < new Date(exam.startTime)) {
        return { ok: false, status: 403, message: 'Exam has not started yet.' };
    }
    if (exam.endTime && now > new Date(exam.endTime)) {
        return { ok: false, status: 403, message: 'Exam has already ended.' };
    }

    const providedCode = normalizeAccessCode(req.body?.accessCode ?? req.query?.accessCode ?? '');
    const storedCode = normalizeAccessCode(exam.accessCode);
    if (storedCode && storedCode !== providedCode) {
        return { ok: false, status: 401, message: 'Invalid or missing access code' };
    }

    if (existingResult && isResultCompleted(existingResult)) {
        return { ok: false, status: 403, message: 'You have already taken this exam.' };
    }

    return { ok: true };
};

const validateAdminResultScope = (result, adminId) => {
    if (!result) {
        return { ok: false, status: 404, message: 'Result not found' };
    }

    const examOwner = result.examId && typeof result.examId === 'object' ? result.examId.createdBy : null;
    if (!examOwner) {
        return { ok: false, status: 403, message: 'Result is not associated with one of your exams.' };
    }

    if (examOwner.toString() !== adminId.toString()) {
        return { ok: false, status: 403, message: 'You are not authorized to manage this result.' };
    }

    const totalQuestions = Number(result.totalQuestions || 0);
    const score = Number(result.score);
    if (Number.isFinite(score) && totalQuestions > 0 && (score < 0 || score > totalQuestions)) {
        return { ok: false, status: 400, message: 'Result score is out of range for its exam.' };
    }

    return { ok: true };
};

const buildCompletedStudentResultFilter = (studentId, resultId) => ({
    ...(resultId ? { _id: resultId } : {}),
    studentId,
    $or: [
        { status: 'Completed' },
        { status: { $exists: false }, score: { $ne: -1 } }
    ]
});

const isDuplicateResultError = (error) => Boolean(
    error?.code === 11000 && error?.keyPattern?.examId && error?.keyPattern?.studentId
);

const validateExamInput = ({ duration, startTime, endTime }) => {
    if (duration !== undefined && (!Number.isFinite(Number(duration)) || Number(duration) < 1)) {
        return 'Exam duration must be at least 1 minute.';
    }
    if (startTime && Number.isNaN(new Date(startTime).getTime())) {
        return 'Start time must be a valid date.';
    }
    if (endTime && Number.isNaN(new Date(endTime).getTime())) {
        return 'End time must be a valid date.';
    }
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
        return 'End time must be after start time.';
    }
    return null;
};

const validateQuestionInput = ({ questionText, options, correctAnswer }) => {
    if (typeof questionText !== 'string' || !questionText.trim()) {
        return 'Question text is required.';
    }
    if (!Array.isArray(options)) {
        return 'Question options must be an array.';
    }
    if (options.length > 0 && options.length < 2) {
        return 'A multiple-choice question must have at least 2 options.';
    }
    if (typeof correctAnswer !== 'string' || !correctAnswer.trim()) {
        return 'Correct answer is required.';
    }
    if (options.length > 0 && !options.includes(correctAnswer)) {
        return 'Correct answer must match one of the question options.';
    }
    return null;
};

// @route   POST /api/exams
// @desc    Create a new exam (Admins Only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, description, duration, accessCode, startTime, endTime } = req.body;
        const validationError = validateExamInput({ duration, startTime, endTime });
        if (validationError) return res.status(400).json({ message: validationError });

        const trimmedTitle = String(title || '').trim();
        if (!trimmedTitle) {
            return res.status(400).json({ message: 'Exam title is required.' });
        }

        const normalizedAccessCode = normalizeAccessCode(accessCode);
        
        // Create the new exam, attaching the logged-in admin's ID as the creator
        const newExam = new Exam({
            title: trimmedTitle,
            description: description !== undefined ? String(description).trim() : '',
            duration: Number(duration) || 60,
            accessCode: normalizedAccessCode,
            startTime: startTime || null,
            endTime: endTime || null,
            createdBy: req.user.id || req.user._id, // Fallback in case JWT uses _id
        });

        const exam = await newExam.save();
        res.status(201).json(exam);
    } catch (err) {
        console.error("Error creating exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams
// @desc    Get all exams (Students & Admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'admin') {
            query.status = 'Published';
        } else {
            query.createdBy = req.user.id || req.user._id;
        }
        const exams = await Exam.find(query).sort({ createdAt: -1 });
        const responseBody = req.user.role === 'admin' ? exams : exams.map(sanitizeExamForStudent);
        res.json(responseBody);
    } catch (err) {
        console.error("Error fetching exams:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams/student/results
// @desc    Get all completed exam results for the logged-in student
router.get('/student/results', authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.id || req.user._id;
        const results = await Result.find(buildCompletedStudentResultFilter(studentId))
            .populate('examId', 'title')
            .sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        console.error("Error fetching results:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams/student/results/:resultId
// @desc    Get detailed review data for one completed student result
router.get('/student/results/:resultId', authMiddleware, validateObjectId('resultId'), async (req, res) => {
    try {
        const studentId = req.user.id || req.user._id;
        const result = await Result.findOne(buildCompletedStudentResultFilter(studentId, req.params.resultId))
            .populate('examId', 'title questions');

        if (!result) {
            return res.status(404).json({ message: 'Completed result not found' });
        }

        res.json(result);
    } catch (err) {
        console.error("Error fetching result details:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams/all-results
// @desc    Get all student results (Admins Only)
router.get('/all-results', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // First, find only the exams created by this specific admin
        const adminId = req.user.id || req.user._id;
        const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
        const adminExamIds = adminExams.map(exam => exam._id);

        const results = await Result.find({ examId: { $in: adminExamIds } })
            .populate('studentId', 'name email')
            .populate('examId', 'title questions') // Also populate the questions for review
            .sort({ createdAt: -1 }); // Newest results first
        res.json(results);
    } catch (err) {
        console.error("Error fetching all results:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   PUT /api/exams/results/:resultId/score
// @desc    Manually update a student's score (Admins Only)
router.put('/results/:resultId/score', authMiddleware, adminMiddleware, validateObjectId('resultId'), async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;
        const { score } = req.body;
        const numericScore = Number(score);

        if (!Number.isFinite(numericScore) || numericScore < 0) {
            return res.status(400).json({ message: 'Score must be a non-negative number.' });
        }

        const result = await Result.findById(req.params.resultId).populate('examId');
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        const scopeCheck = validateAdminResultScope(result, adminId);
        if (!scopeCheck.ok) {
            return res.status(scopeCheck.status).json({ message: scopeCheck.message });
        }

        if (numericScore > Number(result.totalQuestions || 0)) {
            return res.status(400).json({ message: 'Score cannot exceed the total number of questions.' });
        }

        result.score = numericScore;
        await result.save();
        res.json(result);
    } catch (err) {
        console.error("Error updating score:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   DELETE /api/exams/results/:resultId
// @desc    Delete a specific student result (Admins Only)
router.delete('/results/:resultId', authMiddleware, adminMiddleware, validateObjectId('resultId'), async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;
        const result = await Result.findById(req.params.resultId).populate('examId');
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        const scopeCheck = validateAdminResultScope(result, adminId);
        if (!scopeCheck.ok) {
            return res.status(scopeCheck.status).json({ message: scopeCheck.message });
        }

        await Result.findByIdAndDelete(req.params.resultId);
        res.json({ message: 'Result deleted successfully' });
    } catch (err) {
        console.error("Error deleting result:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams/all-questions
// @desc    Get all questions from all exams for the Question Bank (Admins Only)
router.get('/all-questions', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;
        const exams = await Exam.find({ createdBy: adminId }, 'title questions');
        let allQuestions = [];
        exams.forEach(exam => {
            exam.questions.forEach(q => {
                allQuestions.push({
                    ...q.toObject(),
                    sourceExamTitle: exam.title,
                    sourceExamId: exam._id
                });
            });
        });
        res.json(allQuestions);
    } catch (err) {
        console.error("Error fetching question bank:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/duplicate
// @desc    Duplicate an existing exam (Admins Only)
router.post('/:id/duplicate', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;
        const originalExam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!originalExam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // Create a deep copy of questions, stripping the _id by creating new objects
        const newQuestions = originalExam.questions.map(q => ({
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer
        }));

        const newExam = new Exam({
            title: `${originalExam.title} (Copy)`,
            description: originalExam.description,
            duration: originalExam.duration,
            accessCode: originalExam.accessCode,
            startTime: originalExam.startTime,
            endTime: originalExam.endTime,
            createdBy: req.user.id || req.user._id,
            questions: newQuestions,
            status: 'Draft', // Duplicated exams should always start as a draft
        });

        const duplicatedExam = await newExam.save();
        res.status(201).json(duplicatedExam);
    } catch (err) {
        console.error("Error duplicating exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/questions
// @desc    Add a question to an exam (Admins Only)
router.post('/:id/questions', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const { questionText, options, correctAnswer } = req.body;
        const cleanedOptions = Array.isArray(options)
            ? options.map((option) => typeof option === 'string' ? option.trim() : '').filter(Boolean)
            : [];
        const validationError = validateQuestionInput({
            questionText: typeof questionText === 'string' ? questionText.trim() : questionText,
            options: cleanedOptions,
            correctAnswer: typeof correctAnswer === 'string' ? correctAnswer.trim() : correctAnswer,
        });
        if (validationError) return res.status(400).json({ message: validationError });

        // 1. Find the exam by its ID and ensure the admin owns it
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // 2. Create the new question object
        const newQuestion = {
            questionText: questionText.trim(),
            options: cleanedOptions,
            correctAnswer: correctAnswer.trim()
        };

        // 3. Add the question to the exam's questions array and save
        exam.questions.push(newQuestion);
        await exam.save();

        res.status(201).json(exam);
    } catch (err) {
        console.error("Error adding question:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/questions/bulk
// @desc    Add multiple questions to an exam via CSV import (Admins Only)
router.post('/:id/questions/bulk', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ message: 'Questions must be an array.' });
        }
        for (const question of questions) {
            const cleanedQuestion = {
                ...(question || {}),
                questionText: typeof question?.questionText === 'string' ? question.questionText.trim() : question?.questionText,
                options: Array.isArray(question?.options)
                    ? question.options.map((option) => typeof option === 'string' ? option.trim() : '').filter(Boolean)
                    : [],
                correctAnswer: typeof question?.correctAnswer === 'string' ? question.correctAnswer.trim() : question?.correctAnswer,
            };
            const validationError = validateQuestionInput(cleanedQuestion);
            if (validationError) return res.status(400).json({ message: validationError });
        }
        
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // Push all imported questions into the exam document
        const cleanedQuestions = questions.map((question) => ({
            questionText: String(question.questionText || '').trim(),
            options: Array.isArray(question.options) ? question.options.map((option) => String(option || '').trim()).filter(Boolean) : [],
            correctAnswer: String(question.correctAnswer || '').trim()
        }));
        exam.questions.push(...cleanedQuestions);
        await exam.save();

        res.status(201).json(exam);
    } catch (err) {
        console.error("Error adding bulk questions:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   PUT /api/exams/:id/questions/:questionId
// @desc    Edit a question in an exam (Admins Only)
router.put('/:id/questions/:questionId', authMiddleware, adminMiddleware, validateObjectId('id'), validateObjectId('questionId'), async (req, res) => {
    try {
        const { questionText, options, correctAnswer } = req.body;
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // Find the specific question subdocument
        const question = exam.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const cleanedOptions = Array.isArray(options)
            ? options.map((option) => typeof option === 'string' ? option.trim() : '').filter(Boolean)
            : Array.isArray(question.options)
                ? question.options.map((option) => String(option).trim()).filter(Boolean)
                : [];

        const validationError = validateQuestionInput({
            questionText: questionText !== undefined ? String(questionText).trim() : question.questionText,
            options: cleanedOptions,
            correctAnswer: correctAnswer !== undefined ? String(correctAnswer).trim() : question.correctAnswer
        });
        if (validationError) return res.status(400).json({ message: validationError });

        if (questionText !== undefined) question.questionText = String(questionText).trim();
        if (options !== undefined) question.options = cleanedOptions;
        if (correctAnswer !== undefined) question.correctAnswer = String(correctAnswer).trim();

        await exam.save();
        res.json(exam);
    } catch (err) {
        console.error("Error updating question:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/verify
// @desc    Verify access code for an exam
router.post('/:id/verify', authMiddleware, validateObjectId(), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        const studentId = req.user.id || req.user._id;
        const existingResult = req.user.role === 'admin'
            ? null
            : await Result.findOne({ examId: exam._id, studentId });
        const accessCheck = enforceStudentExamAccess(req, exam, existingResult);
        if (!accessCheck.ok) {
            return res.status(accessCheck.status).json({ message: accessCheck.message });
        }
        res.json({ message: 'Access granted' });
    } catch (err) {
        console.error("Error verifying access code:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/exams/:id
// @desc    Get single exam by ID (Students & Admins)
router.get('/:id', authMiddleware, validateObjectId(), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        if (req.user.role !== 'admin') {
            const studentId = req.user.id || req.user._id;
            const existingResult = await Result.findOne({ examId: exam._id, studentId });
            const accessCheck = enforceStudentExamAccess(req, exam, existingResult);

            if (!accessCheck.ok) {
                return res.status(accessCheck.status).json({ message: accessCheck.message });
            }

            const sanitizedExam = sanitizeExamForStudent(exam);
            sanitizedExam.questions = sanitizedExam.questions.sort(() => Math.random() - 0.5);

            if (existingResult) {
                sanitizedExam.resultStatus = getResultStatus(existingResult);
                sanitizedExam.resultCreatedAt = existingResult.createdAt;
                sanitizedExam.resultUpdatedAt = existingResult.updatedAt;
            }

            if (existingResult && existingResult.answers) {
                sanitizedExam.savedAnswers = existingResult.answers;
            }

            return res.json(sanitizedExam);
        }
        
        // Prevent an admin from viewing another admin's exam details directly
        if (req.user.role === 'admin' && exam.createdBy.toString() !== (req.user.id || req.user._id).toString()) {
            return res.status(403).json({ message: 'Unauthorized access to this exam.' });
        }

        res.json(exam);
    } catch (err) {
        console.error("Error fetching exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   DELETE /api/exams/:id/questions/:questionId
// @desc    Delete a question from an exam (Admins Only)
router.delete('/:id/questions/:questionId', authMiddleware, adminMiddleware, validateObjectId('id'), validateObjectId('questionId'), async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;

        // Atomically find the exam and pull the specific question out of the array
        const exam = await Exam.findOneAndUpdate(
            { _id: req.params.id, createdBy: adminId },
            { $pull: { questions: { _id: req.params.questionId } } },
            { new: true, returnDocument: 'after' }
        );

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }
        res.json(exam);
    } catch (err) {
        console.error("Error deleting question:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   PUT /api/exams/:id/status
// @desc    Update exam status (Admins Only)
router.put('/:id/status', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Draft', 'Published'].includes(status)) {
            return res.status(400).json({ message: 'Invalid exam status.' });
        }
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }
        if (status === 'Published' && exam.questions.length === 0) {
            return res.status(400).json({ message: 'Cannot publish an exam with 0 questions. Add at least one valid question first.' });
        }
        exam.status = status;
        await exam.save();
        
        res.json(exam);
    } catch (err) {
        console.error("Error updating status:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   PUT /api/exams/:id
// @desc    Update exam details (Admins Only)
router.put('/:id', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const { title, description, duration, accessCode, startTime, endTime } = req.body;
        const validationError = validateExamInput({ duration, startTime, endTime });
        if (validationError) return res.status(400).json({ message: validationError });
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        if (title !== undefined) {
            const trimmedTitle = String(title).trim();
            if (!trimmedTitle) {
                return res.status(400).json({ message: 'Exam title is required.' });
            }
            exam.title = trimmedTitle;
        }
        if (description !== undefined) exam.description = String(description).trim();
        if (duration !== undefined) exam.duration = Number(duration) || 60;
        if (accessCode !== undefined) exam.accessCode = normalizeAccessCode(accessCode);
        if (startTime !== undefined) exam.startTime = startTime || null;
        if (endTime !== undefined) exam.endTime = endTime || null;

        await exam.save();
        res.json(exam);
    } catch (err) {
        console.error("Error updating exam details:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});


// @route   DELETE /api/exams/:id
// @desc    Delete an entire exam (Admins Only)
router.delete('/:id', authMiddleware, adminMiddleware, validateObjectId(), async (req, res) => {
    try {
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOneAndDelete({ _id: req.params.id, createdBy: adminId });
        
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        await Result.deleteMany({ examId: exam._id });
        res.json({ message: 'Exam deleted successfully' });
    } catch (err) {
        console.error("Error deleting exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/submit
// @desc    Submit an exam and permanently save the score
router.post('/:id/submit', authMiddleware, validateObjectId(), async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Admins cannot submit student exams.' });
        }

        const { answers } = req.body;
        const studentId = req.user.id || req.user._id;
        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        const existingResult = await Result.findOne({ examId: req.params.id, studentId });
        const accessCheck = enforceStudentExamAccess(req, exam, existingResult);
        if (!accessCheck.ok) {
            return res.status(accessCheck.status).json({ message: accessCheck.message });
        }

        if (existingResult && isResultCompleted(existingResult)) {
            return res.status(400).json({ message: 'You have already taken this exam.' });
        }

        // Calculate score on the server
        let score = 0;
        const questions = exam.questions;
        const answersMap = Array.isArray(answers) ? null : answers;
        const finalAnswersArray = [];
        
        questions.forEach((q, index) => {
            // Gracefully handle both new Map format and legacy Array format
            let rawAns = answersMap ? (answersMap[q._id.toString()] || "") : (answers[index] || "");
            finalAnswersArray.push(rawAns);

            const studentAns = rawAns.toString().trim().toLowerCase();
            const correctAns = (q.correctAnswer || "").toString().trim().toLowerCase();
            
            if (studentAns === correctAns && correctAns !== "") {
                score += 1;
            }
        });

        let resultDoc;
        if (existingResult) {
            existingResult.score = score;
            existingResult.totalQuestions = questions.length;
            existingResult.answers = finalAnswersArray;
            existingResult.status = 'Completed';
            resultDoc = await existingResult.save();
        } else {
            resultDoc = new Result({ 
                examId: req.params.id, 
                studentId, 
                score, 
                totalQuestions: questions.length,
                status: 'Completed',
                answers: finalAnswersArray 
            });
            await resultDoc.save();
        }
        
        // Asynchronously send the results email to the student
        try {
            const user = await User.findById(studentId);
            if (user && user.email) {
                const message = `
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                        <h2 style="color: #27ae60;">Exam Submitted Successfully!</h2>
                        <p>Hi <strong>${user.name}</strong>,</p>
                        <p>You have successfully completed the exam: <strong>${exam.title}</strong>.</p>
                        <h3 style="background: #f4f7f6; padding: 15px; border-radius: 8px;">Your Score: ${score} / ${questions.length}</h3>
                        <p>You can review your detailed answers and report anytime by logging into your Student Profile.</p>
                        <p>Best Regards,<br><strong>SecureExam Administration</strong></p>
                    </div>
                `;
                sendEmail({ email: user.email, subject: `Your Exam Results: ${exam.title}`, message }).catch(err => console.error("Email send failed:", err.message));
            }
        } catch (emailErr) {
            console.error("Error preparing email:", emailErr.message);
        }

        res.status(201).json(resultDoc);
    } catch (err) {
        if (isDuplicateResultError(err)) {
            return res.status(409).json({ message: 'You have already taken this exam.' });
        }
        console.error("Error submitting exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/save-progress
// @desc    Auto-save student's exam progress
// @access  Private (Students only)
router.post('/:id/save-progress', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Admins cannot save student exam progress.' });
        }

        const { answers } = req.body;
        const examId = req.params.id;
        const studentId = req.user.id || req.user._id;

        if (!answers) {
            return res.status(400).json({ message: 'No answers provided to save.' });
        }

        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        const existingResult = await Result.findOne({ examId, studentId });
        const accessCheck = enforceStudentExamAccess(req, exam, existingResult);
        if (!accessCheck.ok) {
            return res.status(accessCheck.status).json({ message: accessCheck.message });
        }

        if (existingResult && isResultCompleted(existingResult)) {
            return res.status(403).json({ message: 'This exam has already been completed.' });
        }

        await Result.findOneAndUpdate(
            { examId, studentId },
            {
                $set: {
                    answers: answers,
                    status: 'In Progress',
                    totalQuestions: exam.questions.length,
                    score: -1
                },
                $setOnInsert: {
                    examId,
                    studentId
                }
            },
            { upsert: true, new: true, returnDocument: 'after' }
        );

        res.status(200).json({ message: 'Progress saved successfully.' });
    } catch (error) {
        if (isDuplicateResultError(error)) {
            return res.status(409).json({ message: 'Exam progress was already saved. Please continue the existing attempt.' });
        }
        console.error("Error saving progress:", error.message);
        res.status(500).json({ message: 'Failed to save progress.' });
    }
});

router.getResultStatus = getResultStatus;
router.sanitizeExamForStudent = sanitizeExamForStudent;
router.enforceStudentExamAccess = enforceStudentExamAccess;
router.validateAdminResultScope = validateAdminResultScope;
router.validateExamInput = validateExamInput;
router.validateQuestionInput = validateQuestionInput;
router.isDuplicateResultError = isDuplicateResultError;

module.exports = router;
module.exports.buildCompletedStudentResultFilter = buildCompletedStudentResultFilter;
