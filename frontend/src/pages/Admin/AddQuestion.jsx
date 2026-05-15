import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import "./Admin.css";
import "./AdminExtended.css";

const AddQuestion = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    
    const initialState = {
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        descriptive_answer: ''
    };

    const [questionType, setQuestionType] = useState('mcq'); // 'mcq' or 'descriptive'
    const [questionData, setQuestionData] = useState(initialState);
    const [questionsList, setQuestionsList] = useState([]); // State for the preview table
    const [editQuestionId, setEditQuestionId] = useState(null); // Track if we are editing
    const [showBankModal, setShowBankModal] = useState(false);
    const [questionBank, setQuestionBank] = useState([]);
    const [searchBankQuery, setSearchBankQuery] = useState("");
    const [currentBankPage, setCurrentBankPage] = useState(1);
    const bankResultsPerPage = 10;

    // Load existing questions for this exam when the page opens
    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const res = await api.get(`/exams/${examId}`);
                setQuestionsList(res.data.questions || []);
            } catch (err) {
                console.log("No questions found for this exam yet.");
            }
        };
        fetchQuestions();
    }, [examId]);
    
    // Populate the form when Admin clicks "Edit"
    const handleEditClick = (q) => {
        setEditQuestionId(q._id);
        if (q.options && q.options.length > 0) {
            setQuestionType('mcq');
            const correctIndex = q.options.indexOf(q.correctAnswer);
            const optionLetter = correctIndex === 0 ? 'A' : correctIndex === 1 ? 'B' : correctIndex === 2 ? 'C' : 'D';
            setQuestionData({
                question_text: q.questionText,
                option_a: q.options[0] || '',
                option_b: q.options[1] || '',
                option_c: q.options[2] || '',
                option_d: q.options[3] || '',
                correct_option: optionLetter || 'A',
                descriptive_answer: ''
            });
        } else {
            setQuestionType('descriptive');
            setQuestionData({
                ...initialState,
                question_text: q.questionText,
                descriptive_answer: q.correctAnswer
            });
        }
    };

    const handleCancelEdit = () => {
        setEditQuestionId(null);
        setQuestionData(initialState);
        setQuestionType('mcq');
    };

    const openQuestionBank = async () => {
        try {
            const res = await api.get('/exams/all-questions');
            // Filter out questions that are already in the current exam to avoid duplicates
            const currentQuestionIds = questionsList.map(q => q._id);
            const availableQuestions = res.data.filter(q => !currentQuestionIds.includes(q._id));
            setQuestionBank(availableQuestions);
            setSearchBankQuery("");
            setCurrentBankPage(1);
            setShowBankModal(true);
        } catch (err) {
            console.error("Error fetching question bank:", err);
            toast.error("Failed to load question bank.");
        }
    };

    const handleImportQuestion = async (questionToImport) => {
        try {
            const payload = {
                questionText: questionToImport.questionText,
                options: questionToImport.options,
                correctAnswer: questionToImport.correctAnswer,
            };
            const res = await api.post(`/exams/${examId}/questions`, payload);
            toast.success("Question Imported!");
            setQuestionsList(res.data.questions);
            // Remove imported question from the modal list to prevent re-importing
            setQuestionBank(prevBank => prevBank.filter(q => q._id !== questionToImport._id));
        } catch (err) {
            console.error("Error importing question:", err);
            toast.error(err.response?.data?.message || "Failed to import question.");
        }
    };

    // Generate and download a sample CSV template for the admin
    const downloadCSVTemplate = () => {
        const headers = "Question Text,Option A,Option B,Option C,Option D,Correct Answer\n";
        const example1 = '"What does HTML stand for?","Hyper Text Markup Language","Home Tool Markup Language","Hyperlinks and Text Markup Language","Hyper Tool Markup Language","Hyper Text Markup Language"\n';
        const example2 = '"Explain what CSS is used for.",,,,,"CSS is used for styling and laying out web pages."\n';
        
        const csvContent = headers + example1 + example2;
        const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Exam_Questions_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle processing the uploaded CSV file
    const handleCSVUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                const newQuestions = [];

                // Skip the header (index 0)
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Custom split to ignore commas inside quotes
                    const rowParts = [];
                    let insideQuotes = false;
                    let currentPart = '';
                    for (let char of line) {
                        if (char === '"') insideQuotes = !insideQuotes;
                        else if (char === ',' && !insideQuotes) { rowParts.push(currentPart); currentPart = ''; }
                        else currentPart += char;
                    }
                    rowParts.push(currentPart);

                    const cleanPart = (str) => str ? str.replace(/^"|"$/g, '').trim() : '';
                    
                    const qText = cleanPart(rowParts[0]);
                    const optA = cleanPart(rowParts[1]);
                    const optB = cleanPart(rowParts[2]);
                    const optC = cleanPart(rowParts[3]);
                    const optD = cleanPart(rowParts[4]);
                    const correct = cleanPart(rowParts[5]);

                    // Valid row must have at least a question and an answer
                    if (qText && correct) {
                        const options = [];
                        if (optA) options.push(optA);
                        if (optB) options.push(optB);
                        if (optC) options.push(optC);
                        if (optD) options.push(optD);

                        newQuestions.push({
                            questionText: qText,
                            options: options,
                            correctAnswer: correct
                        });
                    }
                }

                if (newQuestions.length === 0) {
                    toast.error("No valid questions found in the CSV. Please check the template.");
                    return;
                }

                const res = await api.post(`/exams/${examId}/questions/bulk`, { questions: newQuestions });
                setQuestionsList(res.data.questions);
                toast.success(`Successfully imported ${newQuestions.length} questions!`);
            } catch (error) {
                console.error("CSV Import Error:", error);
                toast.error("Failed to parse or upload CSV.");
            }
            // Reset file input so they can upload the same file again if they edit it
            e.target.value = null;
        };
        reader.readAsText(file);
    };

    // Save question handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            let optionsArray = [];
            let finalCorrectAnswer = "";

            if (questionType === 'mcq') {
                optionsArray = [
                    questionData.option_a,
                    questionData.option_b,
                    questionData.option_c,
                    questionData.option_d
                ];
                const correctIndex = questionData.correct_option === 'A' ? 0 
                                   : questionData.correct_option === 'B' ? 1 
                                   : questionData.correct_option === 'C' ? 2 : 3;
                finalCorrectAnswer = optionsArray[correctIndex];
            } else {
                finalCorrectAnswer = questionData.descriptive_answer.trim();
            }

            const payload = {
                questionText: questionData.question_text,
                options: optionsArray,
                correctAnswer: finalCorrectAnswer
            };

            if (editQuestionId) {
                const res = await api.put(`/exams/${examId}/questions/${editQuestionId}`, payload);
                toast.success("Question Updated!");
                setQuestionsList(res.data.questions);
                handleCancelEdit();
            } else {
                const res = await api.post(`/exams/${examId}/questions`, payload);
                toast.success("Question Added!");
                setQuestionsList(res.data.questions);
                setQuestionData(initialState);
            }
        } catch (err) {
            console.error("Error saving question", err);
        }
    };
    // Delete question handler
    const handleDelete = async (questionId) => {
        toast((t) => (
            <div>
                <p>Are you sure you want to delete this question?</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            const res = await api.delete(`/exams/${examId}/questions/${questionId}`);
                            setQuestionsList(res.data.questions);
                            toast.success("Question deleted.");
                        } catch (err) {
                            console.error("Error deleting question", err);
                            toast.error("Failed to delete question.");
                        }
                    }} style={{ background: '#ef4444', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Delete</button>
                    <button onClick={() => toast.dismiss(t.id)} style={{ background: '#e2e8f0', color: '#0f172a', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    // Pagination logic for Question Bank Modal
    const filteredBank = questionBank.filter(q => q.questionText.toLowerCase().includes(searchBankQuery.toLowerCase()));
    const indexOfLastBankResult = currentBankPage * bankResultsPerPage;
    const indexOfFirstBankResult = indexOfLastBankResult - bankResultsPerPage;
    const currentBankResults = filteredBank.slice(indexOfFirstBankResult, indexOfLastBankResult);
    const totalBankPages = Math.ceil(filteredBank.length / bankResultsPerPage);

    return (
        <div className="admin-wrapper">
            <main className="admin-main">
                <span className="back-link" onClick={() => navigate("/admin/dashboard")}>
                    ← Back to Dashboard
                </span>
                
                <div className="admin-form-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>{editQuestionId ? "Edit Question" : "Add New Question"}</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" className="import-bank-btn" onClick={downloadCSVTemplate} style={{ backgroundColor: '#f39c12' }} title="Download an Excel-friendly CSV layout">
                                CSV Template
                            </button>
                            <input type="file" id="csv-upload" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
                            <button type="button" className="import-bank-btn" onClick={() => document.getElementById('csv-upload').click()} style={{ backgroundColor: '#2980b9' }} title="Upload questions from a CSV file">
                                Upload CSV
                            </button>
                            <button type="button" className="import-bank-btn" onClick={openQuestionBank}>
                                Bank Import
                            </button>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="form-group">
                        <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="admin-input" style={{ marginBottom: '10px' }}>
                            <option value="mcq">Multiple Choice Question (MCQ)</option>
                            <option value="descriptive">Descriptive / Fill in the Blank</option>
                        </select>
                        <textarea 
                            className="admin-input"
                            placeholder="Enter question text..."
                            required
                            value={questionData.question_text}
                            onChange={(e) => setQuestionData({...questionData, question_text: e.target.value})}
                        />
                        {questionType === 'mcq' ? (
                            <>
                                <input className="admin-input" type="text" placeholder="Option A" required value={questionData.option_a} onChange={(e) => setQuestionData({...questionData, option_a: e.target.value})} />
                                <input className="admin-input" type="text" placeholder="Option B" required value={questionData.option_b} onChange={(e) => setQuestionData({...questionData, option_b: e.target.value})} />
                                <input className="admin-input" type="text" placeholder="Option C" required value={questionData.option_c} onChange={(e) => setQuestionData({...questionData, option_c: e.target.value})} />
                                <input className="admin-input" type="text" placeholder="Option D" required value={questionData.option_d} onChange={(e) => setQuestionData({...questionData, option_d: e.target.value})} />
                                
                                <div className="correct-ans-section">
                                    <label>Correct Answer:</label>
                                    <div className="option-selector-group">
                                        {['A', 'B', 'C', 'D'].map((opt) => (
                                            <button
                                                key={opt}
                                                type="button" // Important: prevents form submission
                                                className={`option-btn ${questionData.correct_option === opt ? 'active' : ''}`}
                                                onClick={() => setQuestionData({ ...questionData, correct_option: opt })}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ marginTop: '10px', textAlign: 'left' }}>
                                <label className="bold-text">Correct Answer (Exact Match):</label>
                                <input 
                                    className="admin-input" 
                                    type="text" 
                                    placeholder="Enter the exact correct answer" 
                                    required 
                                    value={questionData.descriptive_answer} 
                                    onChange={(e) => setQuestionData({...questionData, descriptive_answer: e.target.value})} 
                                />
                            </div>
                        )}
                        
                        <div className="btn-group-flex">
                            <button type="submit" className="save-btn flex-1">
                                {editQuestionId ? "Update Question" : "Save Question"}
                            </button>
                            {editQuestionId && (
                                <button type="button" className="cancel-edit-btn flex-1" onClick={handleCancelEdit}>
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* --- Live Preview Table --- */}
                <div className="preview-section">
                    <h3>Exam Question Bank ({questionsList.length})</h3>
                    <table className="preview-table">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Question</th>
                                <th>Correct</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {questionsList.map((q, index) => (
                                <tr key={q._id || index}>
                                    <td>{index + 1}</td>
                                    <td>{q.questionText?.substring(0, 50)}...</td>
                                    <td>
                                        {q.options && q.options.length === 0 
                                            ? <span style={{ color: '#3498db', fontWeight: 'bold' }}>[Text] {q.correctAnswer}</span> 
                                            : q.correctAnswer}
                                    </td>
                                    <td className="action-btns-flex">
                                        <button className="edit-mini-btn" onClick={() => handleEditClick(q)}>Edit</button>
                                        <button className="delete-mini" onClick={() => handleDelete(q._id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Question Bank Modal */}
            {showBankModal && (
                <div className="modal-overlay">
                    <div className="modal-content review-modal-content" style={{ maxWidth: '800px' }}>
                        <h2 className="review-modal-header">Question Bank</h2>
                        <input 
                            type="text" 
                            className="admin-input admin-search-input" 
                            placeholder="Search questions by text..."
                            value={searchBankQuery}
                            onChange={(e) => {
                                setSearchBankQuery(e.target.value);
                                setCurrentBankPage(1);
                            }}
                        />
                        <table className="preview-table results-table">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Type</th>
                                    <th>Source Exam</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentBankResults.map((q) => (
                                    <tr key={q._id}>
                                        <td>{q.questionText.substring(0, 60)}...</td>
                                        <td>{q.options && q.options.length > 0 ? "MCQ" : "Descriptive"}</td>
                                        <td>{q.sourceExamTitle}</td>
                                        <td>
                                            <button className="confirm-btn review-btn" onClick={() => handleImportQuestion(q)}>Import</button>
                                        </td>
                                    </tr>
                                ))}
                                {currentBankResults.length === 0 && (
                                    <tr><td colSpan="4" className="empty-table-cell">No available questions found in the bank.</td></tr>
                                )}
                            </tbody>
                        </table>
                        
                        {/* Question Bank Modal Pagination */}
                        {totalBankPages > 1 && (
                            <div className="pagination-container">
                                <span className="pagination-info">
                                    Showing {indexOfFirstBankResult + 1} to {Math.min(indexOfLastBankResult, filteredBank.length)} of {filteredBank.length} entries
                                </span>
                                <div className="pagination-controls">
                                    <button 
                                        className="page-btn"
                                        onClick={() => setCurrentBankPage(prev => Math.max(prev - 1, 1))} 
                                        disabled={currentBankPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span className="page-text">Page {currentBankPage} of {totalBankPages}</span>
                                    <button 
                                        className="page-btn"
                                        onClick={() => setCurrentBankPage(prev => Math.min(prev + 1, totalBankPages))} 
                                        disabled={currentBankPage === totalBankPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="modal-actions modal-actions-ext">
                            <button className="cancel-btn" onClick={() => setShowBankModal(false)}>Close Bank</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddQuestion;