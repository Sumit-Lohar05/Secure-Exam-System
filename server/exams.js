const express = require('express');
const router = express.Router();
const Exam = require('./Exam');
const Result = require('./Result');
const User = require('./User');
const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');
const validateObjectId = require('./validateObjectId');
const sendEmail = require('./utils/sendEmail');

// @route   POST /api/exams
// @desc    Create a new exam (Admins Only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, description, duration, accessCode, startTime, endTime } = req.body;
        
        // Create the new exam, attaching the logged-in admin's ID as the creator
        const newExam = new Exam({
            title,
            description,
            duration: Number(duration) || 60,
            accessCode: accessCode || '',
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
            query.status = 'Published'; // Hide Drafts from students at the database level
        } else {
            query.createdBy = req.user.id || req.user._id; // Admins only see their own exams
        }
        const exams = await Exam.find(query).sort({ createdAt: -1 }); // Newest first
        res.json(exams);
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
        const results = await Result.find({ studentId })
            .populate('examId', 'title questions') // Populate the exam title and questions for the review report
            .sort({ createdAt: -1 });   // Show most recent results first
        res.json(results);
    } catch (err) {
        console.error("Error fetching results:", err.message);
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
router.put('/results/:resultId/score', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { score } = req.body;
        const result = await Result.findByIdAndUpdate(
            req.params.resultId,
            { score: Number(score) },
            { new: true } // Returns the updated document
        );
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }
        res.json(result);
    } catch (err) {
        console.error("Error updating score:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   DELETE /api/exams/results/:resultId
// @desc    Delete a specific student result (Admins Only)
router.delete('/results/:resultId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await Result.findByIdAndDelete(req.params.resultId);
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }
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

        // 1. Find the exam by its ID and ensure the admin owns it
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // 2. Create the new question object
        const newQuestion = {
            questionText,
            options,
            correctAnswer
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
        
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        // Push all imported questions into the exam document
        exam.questions.push(...questions);
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

        if (questionText !== undefined) question.questionText = questionText;
        if (options !== undefined) question.options = options;
        if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;

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
        const { accessCode } = req.body;
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        if (exam.accessCode && exam.accessCode !== accessCode) {
            return res.status(401).json({ message: 'Invalid access code' });
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
        
        // Security: Prevent students from accessing Drafts, enforce access code, and randomize
        if (req.user.role !== 'admin') {
            if (exam.status !== 'Published') return res.status(403).json({ message: 'Exam is not available.' });
            
            // Schedule enforcement
            const now = new Date();
            if (exam.startTime && now < new Date(exam.startTime)) {
                return res.status(403).json({ message: 'Exam has not started yet.' });
            }
            if (exam.endTime && now > new Date(exam.endTime)) {
                return res.status(403).json({ message: 'Exam has already ended.' });
            }

            const providedCode = req.query.accessCode || "";
            if (exam.accessCode && exam.accessCode !== providedCode) {
                return res.status(401).json({ message: 'Invalid or missing access code' });
            }

            // 1. Fetch the user's progress/result document
            const studentId = req.user.id || req.user._id;
            const existingResult = await Result.findOne({ examId: exam._id, studentId });

            // 2. Prevent access if they have already formally submitted it (Score is -1 for drafts)
            if (existingResult && existingResult.score !== -1) {
                return res.status(403).json({ message: 'You have already taken this exam.' });
            }

            const sanitizedExam = exam.toObject();
            sanitizedExam.questions.forEach(q => delete q.correctAnswer);
            // Shuffle questions for randomized ordering
            sanitizedExam.questions = sanitizedExam.questions.sort(() => Math.random() - 0.5);

            // 3. If they have a draft, attach the answers to the response
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
            { new: true }
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
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }
        if (status === 'Published' && exam.questions.length === 0) {
            return res.status(400).json({ message: 'Cannot publish an exam with 0 questions.' });
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
        const adminId = req.user.id || req.user._id;
        const exam = await Exam.findOne({ _id: req.params.id, createdBy: adminId });
        
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        if (title) exam.title = title;
        if (description !== undefined) exam.description = description;
        if (duration) exam.duration = duration;
        if (accessCode !== undefined) exam.accessCode = accessCode;
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
        const { answers } = req.body;
        const studentId = req.user.id || req.user._id;
        
        // Security check: Make sure they haven't submitted this exam already
        const existingResult = await Result.findOne({ examId: req.params.id, studentId });
        if (existingResult && existingResult.score !== -1) {
            return res.status(400).json({ message: 'You have already taken this exam.' });
        }

        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
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
            resultDoc = await existingResult.save();
        } else {
            resultDoc = new Result({ 
                examId: req.params.id, 
                studentId, 
                score, 
                totalQuestions: questions.length, 
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
        console.error("Error submitting exam:", err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/exams/:id/save-progress
// @desc    Auto-save student's exam progress
// @access  Private (Students only)
router.post('/:id/save-progress', authMiddleware, async (req, res) => {
    try {
        const { answers } = req.body;
        const examId = req.params.id;
        const studentId = req.user.id;

        if (!answers) {
            return res.status(400).json({ message: 'No answers provided to save.' });
        }

        // Find existing result document or create a new "In Progress" draft
        await Result.findOneAndUpdate(
            { examId, studentId }, // Search criteria
            { 
                $set: { 
                    answers: answers,
                    status: 'In Progress' // Useful if your Result model tracks completion status
                },
                $setOnInsert: {
                    score: -1, // Satisfies Mongoose schema without triggering a "Completed" state
                    totalQuestions: -1 
                }
            },
            { upsert: true, new: true } // Create if it doesn't exist
        );

        res.status(200).json({ message: 'Progress saved successfully.' });
    } catch (error) {
        console.error("Error saving progress:", error.message);
        res.status(500).json({ message: 'Failed to save progress.' });
    }
});

module.exports = router;
