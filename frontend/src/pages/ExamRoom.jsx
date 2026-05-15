import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from '../api/axios';
import toast from 'react-hot-toast';
import "./ExamRoom.css";

const ExamRoom = () => {
    const { id: examId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [exam, setExam] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [flaggedQuestions, setFlaggedQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [tabViolations, setTabViolations] = useState(() => parseInt(sessionStorage.getItem(`exam_violations_${examId}`) || '0'));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(true);
    const [hasAgreed, setHasAgreed] = useState(() => sessionStorage.getItem(`exam_started_${examId}`) === 'true');
    const [agreedChecked, setAgreedChecked] = useState(false);
    const submitLock = useRef(false);
    const targetEndTime = useRef(null);
    
    // Ref to keep track of latest answers without triggering useEffect re-binds
    const answersRef = useRef(answers);
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const tabViolationsRef = useRef(tabViolations);

    // Check for full screen presence on mount (e.g. after a hard refresh)
    useEffect(() => {
        if (!document.fullscreenElement) {
            setIsFullScreen(false);
        }
    }, []);

    // Fetch exam data on component mount
    useEffect(() => {
        const fetchExam = async () => {
            // Pre-check: Bounce the user out if they have already taken this exam
            try {
                const resultsRes = await api.get('/exams/student/results');
                const hasTaken = resultsRes.data.some(res => (res.examId?._id || res.examId) === examId);
                if (hasTaken) {
                    toast.error("You have already completed this exam!");
                    navigate('/dashboard');
                    return;
                }
            } catch (err) {
                console.error("Error checking attempt:", err);
            }
            const queryParams = new URLSearchParams(location.search);
            const accessCode = queryParams.get("accessCode") || "";
            try {
                const res = await api.get(`/exams/${examId}?accessCode=${encodeURIComponent(accessCode)}`);                
                // Randomly shuffle options for each question (Only if options exist)
                const shuffledExam = {
                    ...res.data,
                    questions: res.data.questions.map(q => ({
                        ...q,
                        options: q.options && q.options.length > 0 ? [...q.options].sort(() => Math.random() - 0.5) : []
                    }))
                };

                setExam(shuffledExam);
                
                // Restore saved answers from Session Storage (takes priority against reload shuffle) and Backend Draft
                const localAnswersMap = JSON.parse(sessionStorage.getItem(`exam_answers_${examId}`) || '{}');
                const dbAnswersMap = res.data.savedAnswers || {};
                
                const restoredAnswers = {};
                shuffledExam.questions.forEach((q, i) => {
                    if (localAnswersMap[q._id]) {
                        restoredAnswers[i] = localAnswersMap[q._id];
                    } else if (dbAnswersMap[q._id]) {
                        restoredAnswers[i] = dbAnswersMap[q._id];
                    }
                });
                setAnswers(restoredAnswers);

                // Calculate time left: use duration, but cap it if endTime is approaching sooner
                let initialTimeLeft = shuffledExam.duration * 60;
                if (shuffledExam.endTime) {
                    const secondsUntilEnd = Math.floor((new Date(shuffledExam.endTime).getTime() - Date.now()) / 1000);
                    initialTimeLeft = Math.min(initialTimeLeft, Math.max(0, secondsUntilEnd));
                }
                
                // If they accidentally reloaded, strictly enforce their previous exact target end time!
                if (sessionStorage.getItem(`exam_started_${examId}`) === 'true') {
                    const savedEndTime = sessionStorage.getItem(`exam_endtime_${examId}`);
                    if (savedEndTime) {
                        targetEndTime.current = parseInt(savedEndTime, 10);
                        setTimeLeft(Math.max(0, Math.floor((targetEndTime.current - Date.now()) / 1000)));
                    } else {
                        targetEndTime.current = Date.now() + (initialTimeLeft * 1000);
                        sessionStorage.setItem(`exam_endtime_${examId}`, targetEndTime.current);
                        setTimeLeft(initialTimeLeft);
                    }
                } else {
                    // Just stage the initial time (timer won't tick until hasAgreed is true)
                    setTimeLeft(initialTimeLeft);
                }
            } catch (err) {
                console.error("Error fetching exam:", err);
                toast.error(err.response?.data?.message || "Failed to load exam. It might be protected or unavailable.");
                navigate('/dashboard');
            }
        };
        fetchExam();
    }, [examId, navigate]);

    // Derive questions from exam state
    const questions = exam?.questions || [];
    

    // Calculate summary stats
    const answeredCount = Object.values(answersRef.current).filter(ans => ans !== undefined && ans.toString().trim() !== "").length;
    const flaggedCount = flaggedQuestions.length;
    const remainingCount = questions.length - answeredCount;

    const handleSubmit = async (isAutoSubmit = false) => {
        if (submitLock.current) return;
        submitLock.current = true;
        setIsSubmitting(true);

        if(!isAutoSubmit){
            setShowModal(false);
        }
        
        // Map latest answers securely to their question's _id to handle server-side randomization
        const answersMap = {};
        questions.forEach((q, i) => { answersMap[q._id] = answersRef.current[i] || ""; });
        
        try {
            const res = await api.post(`/exams/${examId}/submit`, {
                answers: answersMap
            });
            setScore(res.data.score); // Use the score returned by the server
            setIsSubmitted(true);
            sessionStorage.removeItem(`exam_answers_${examId}`);
            sessionStorage.removeItem(`exam_violations_${examId}`);
            sessionStorage.removeItem(`exam_started_${examId}`);
            sessionStorage.removeItem(`exam_endtime_${examId}`);
        } catch (error) {
            console.error("Error submitting exam:", error);
            // If the server says already taken, a ghost duplicate succeeded. Force the success screen!
            if (error.response?.data?.message === 'You have already taken this exam.') {
                setIsSubmitted(true);
            } else {
                toast.error(error.response?.data?.message || "Failed to submit exam to the server. Please try again.");
                submitLock.current = false;
                setIsSubmitting(false);
            }
        }
    };

    // Handle option change
    const handleOptionChange = (option) => {
        const newAnswers = {
            ...answers,
            [currentQuestion]: option
        };
        setAnswers(newAnswers);
        
        // Map latest answers securely to their question's _id for session storage to survive random reshuffles
        const answersMap = {};
        questions.forEach((q, i) => { 
            if (newAnswers[i] !== undefined && newAnswers[i].toString().trim() !== "") {
                answersMap[q._id] = newAnswers[i]; 
            }
        });
        sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(answersMap));
    };

    const toggleFlag = () => {
        if (flaggedQuestions.includes(currentQuestion)) {
            setFlaggedQuestions(flaggedQuestions.filter(q => q !== currentQuestion));
        } else {
            setFlaggedQuestions([...flaggedQuestions, currentQuestion]);
        }
    };

    // Timer logic
    useEffect(() => {
        if (!hasAgreed) return; // Don't run timer if not agreed yet
        if (timeLeft <= 0) {
            if(exam && !isSubmitted && !submitLock.current){
                handleSubmit(true);
            }
            return;
        }
        const timer = setInterval(() => {
            if (targetEndTime.current) {
                setTimeLeft(Math.max(0, Math.floor((targetEndTime.current - Date.now()) / 1000)));
            } else {
                setTimeLeft(prev => prev - 1);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, exam, isSubmitted, hasAgreed]);

    // Anti-Cheat: Prevent Tab Switching
    useEffect(() => {
        if (isSubmitted || !exam || !hasAgreed) return; // Only enforce if actively in exam

        const handleVisibilityChange = () => {
            if (submitLock.current) return; // Prevent violations if already submitting
            if (document.visibilityState === 'hidden') {
                handleViolation("You left the exam window! Do not switch tabs or minimize the browser.");
            }
        };

        const handleFullscreenChange = () => {
            if (submitLock.current) return; // Prevent violations if already submitting
            if (!document.fullscreenElement) {
                setIsFullScreen(false);
                handleViolation("You exited full-screen mode! Please stay in full-screen during the exam.");
            } else {
                setIsFullScreen(true);
            }
        };

        const preventCopyPaste = (e) => {
            e.preventDefault();
        };

        const handleViolation = (warningMessage) => {
            tabViolationsRef.current += 1;
            const newCount = tabViolationsRef.current;
            setTabViolations(newCount);
            sessionStorage.setItem(`exam_violations_${examId}`, newCount);
            
            if (newCount === 1) {
                toast.error(`WARNING: ${warningMessage} If you do this again, your exam will be automatically submitted.`, { duration: 6000 });
            } else if (newCount >= 2) {
                toast.error("Anti-Cheat Violation: You have left the exam environment multiple times. Your exam is now being submitted.", { duration: 6000 });
                handleSubmit(true);
            }
        };

        const preventDevTools = (e) => {
            // Block F12
            if (e.key === "F12" || e.keyCode === 123) {
                e.preventDefault();
                handleViolation("Developer Tools (F12) are strictly prohibited during the exam.");
            }
            // Block Ctrl+Shift+I / Cmd+Option+I and Ctrl+U
            if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U" || (e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "j" || e.key === "J" || e.key === "c" || e.key === "C")))) {
                e.preventDefault();
                handleViolation("Developer shortcuts and viewing source code are strictly prohibited.");
            }
            // Block F5, Ctrl+R, Cmd+R (Refresh)
            if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"))) {
                e.preventDefault();
                handleViolation("Page refresh is strictly prohibited during the exam.");
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("copy", preventCopyPaste);
        document.addEventListener("cut", preventCopyPaste);
        document.addEventListener("paste", preventCopyPaste);
        document.addEventListener("contextmenu", preventCopyPaste);
        document.addEventListener("keydown", preventDevTools);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("copy", preventCopyPaste);
            document.removeEventListener("cut", preventCopyPaste);
            document.removeEventListener("paste", preventCopyPaste);
            document.removeEventListener("contextmenu", preventCopyPaste);
            document.removeEventListener("keydown", preventDevTools);
        };
    }, [isSubmitted, exam, hasAgreed]); 

    // Auto-Save Progress every 1 minute
    useEffect(() => {
        if (isSubmitted || !exam || questions.length === 0 || !hasAgreed) return;

        const autoSave = async () => {
            if (submitLock.current) return;
            
            const answersMap = {};
            questions.forEach((q, i) => { 
                if (answersRef.current[i] !== undefined && answersRef.current[i].toString().trim() !== "") {
                    answersMap[q._id] = answersRef.current[i]; 
                }
            });

            if (Object.keys(answersMap).length === 0) return;

            try {
                // Silently send current answers to the server
                await api.post(`/exams/${examId}/save-progress`, { answers: answersMap });
            } catch (err) {
                console.error("Auto-save failed:", err);
            }
        };

        const intervalId = setInterval(autoSave, 60000); // 60,000 ms = 1 minute

        return () => clearInterval(intervalId);
    }, [isSubmitted, exam, questions, examId, hasAgreed]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    const handleReturnToDashboard = () => {
        // Exit full screen cleanly when leaving the exam environment
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.error(err));
        }
        navigate('/dashboard');
    };

    const handleStart = async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            setIsFullScreen(true);
        } catch (err) {
            console.error(err);
            toast.error("Failed to enter full screen. Please try again.");
            return;
        }
        
        // Formally lock in the start time
        targetEndTime.current = Date.now() + (timeLeft * 1000);
        sessionStorage.setItem(`exam_endtime_${examId}`, targetEndTime.current);
        sessionStorage.setItem(`exam_started_${examId}`, 'true');
        
        setHasAgreed(true); // This instantly starts the timer and anti-cheat bindings
    };

    // Loading state
    if (!exam) {
        return <div className="loading-screen">Loading...</div>;
    }

    // Result Screen
    if(isSubmitted){
        return (
            <div className="exam-container">
                <div className="result-card-wrapper">
                    <div className="result-card">
                        <h2>Exam Submitted successfully!</h2>
                        <h3>Your Score: {score}/{questions.length}</h3>
                        <p>Thank you for taking the <strong>{exam.title}</strong></p>
                        <button onClick={handleReturnToDashboard} className="back-btn">Return to Dashboard</button>
                    </div>
                </div>
            </div>
        );
    }
    // Handle case where exam has no questions
    if (questions.length === 0) {
        return (
             <div className="exam-container">
                <div className="result-card-wrapper">
                    <div className="result-card">
                        <h2>Exam Not Ready</h2>
                        <p>This exam has no questions yet. Please contact the administrator.</p>
                        <button onClick={handleReturnToDashboard} className="back-btn">
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Instructions Blocker Screen
    if (!hasAgreed) {
        return (
            <div className="exam-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
                <div className="result-card" style={{ maxWidth: '700px', textAlign: 'left', padding: '40px', width: '100%' }}>
                    <h2 style={{ marginBottom: '20px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>Exam Instructions & Rules</h2>
                    
                    <div style={{ marginBottom: '20px', fontSize: '1.05rem', lineHeight: '1.6' }}>
                        <p style={{ marginBottom: '15px' }}>Welcome to <strong>{exam.title}</strong>. Please read the following instructions carefully before starting the exam:</p>
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <li><strong>Full-Screen Mode:</strong> The exam requires full-screen mode. Do not exit full-screen during the exam.</li>
                            <li><strong>Tab Switching & Minimizing:</strong> Do not switch tabs, minimize the browser, or open other applications. Doing so will trigger an anti-cheat warning.</li>
                            <li><strong>Developer Tools & Shortcuts:</strong> Using Developer Tools (F12), right-click, or keyboard shortcuts like <code>Ctrl+R</code> or <code>F5</code> is strictly prohibited.</li>
                            <li><strong>Violations:</strong> Multiple violations of these rules will result in the immediate and automatic submission of your exam.</li>
                            <li><strong>Time Limit:</strong> You have {exam.duration} minutes to complete this exam. The timer starts when you click the button below.</li>
                        </ul>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', cursor: 'pointer', padding: '15px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', marginBottom: '25px' }}>
                        <input 
                            type="checkbox" 
                            checked={agreedChecked} 
                            onChange={(e) => setAgreedChecked(e.target.checked)} 
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <strong>I have read and agree to follow all instructions and rules.</strong>
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={handleReturnToDashboard} className="cancel-btn" style={{ padding: '12px 25px', fontSize: '1.05rem', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '6px' }}>
                            Cancel
                        </button>
                        <button 
                            onClick={handleStart} 
                            disabled={!agreedChecked}
                            className="confirm-btn" 
                            style={{ padding: '12px 25px', fontSize: '1.05rem', opacity: agreedChecked ? 1 : 0.6, cursor: agreedChecked ? 'pointer' : 'not-allowed', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
                        >
                            Start Exam
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    // Handle exited full screen
    if (!isFullScreen && !isSubmitted && questions.length > 0) {
        return (
            <div className="exam-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--toast-bg, #1e293b)', color: 'var(--toast-text, #f8fafc)', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
                <h2 style={{ color: '#ef4444', marginBottom: '15px' }}>⚠️ Full Screen Required</h2>
                <p style={{ fontSize: '1.1rem', marginBottom: '25px', maxWidth: '500px' }}>
                    Your browser has exited full-screen mode. To maintain exam integrity, you must remain in full-screen mode at all times.
                </p>
                <button 
                    onClick={async () => {
                        try {
                            if (document.documentElement.requestFullscreen) {
                                await document.documentElement.requestFullscreen();
                            }
                            setIsFullScreen(true);
                        } catch (err) {
                            console.error(err);
                            toast.error("Failed to enter full screen. Please try again.");
                        }
                    }} 
                    className="start-exam-btn"
                    style={{ padding: '15px 30px', fontSize: '1.1rem', maxWidth: '250px' }}
                >
                    Resume Exam
                </button>
            </div>
        );
    }

    return (
        // Apply userSelect: 'none' to prevent text highlighting
        <div className="exam-container" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}>
            <header className="exam-header">
                <div className="header-left">
                    <span className="breadcrumb">{exam.title}</span>
                </div>
                <div className="exam-timer">Time Remaining: {formatTime(timeLeft)}</div>
                <button className="submit-btn" onClick={() => setShowModal(true)}>Finish Exam</button>
            </header>

            <div className="exam-body">
                <main className="question-section">
                    <div className="question-card">
                        <div className="card-header">
                            <span>Question {currentQuestion + 1} of {questions.length}</span>
                            <button 
                                className={`flag-btn ${flaggedQuestions.includes(currentQuestion) ? 'active' : ''}`} 
                                onClick={toggleFlag}
                            >
                                {flaggedQuestions.includes(currentQuestion) ? "Flagged" : "Flag for Review"}
                            </button>
                        </div>
                        <h2>{questions[currentQuestion].questionText}</h2>
                        
                        {questions[currentQuestion].options && questions[currentQuestion].options.length > 0 ? (
                            <div className="options-list">
                                {questions[currentQuestion].options.map((opt, i) => (
                                    <label key={i} className="option-item">
                                        <input 
                                            type="radio" 
                                            name={`question-${currentQuestion}`}
                                            checked={answers[currentQuestion] === opt}
                                            onChange={() => handleOptionChange(opt)} 
                                            onClick={() => {
                                                if (answers[currentQuestion] === opt) {
                                                    handleOptionChange("");
                                                }
                                            }}
                                        /> 
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="options-list" style={{ padding: "10px 0" }}>
                                <input 
                                    type="text" 
                                    placeholder="Type your answer here..."
                                    style={{ width: "100%", padding: "15px", fontSize: "1rem", borderRadius: "8px", border: "1px solid #bdc3c7", outline: "none" }}
                                    value={answers[currentQuestion] || ""}
                                    onChange={(e) => handleOptionChange(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                        )}
                    </div>
                    <div className="navigation-btns">
                        <button 
                            className="nav-btn prev"
                            disabled={currentQuestion === 0} 
                            onClick={() => setCurrentQuestion(prev => prev - 1)}
                        >Previous</button>
                        <button 
                            className="nav-btn next"
                            disabled={currentQuestion === questions.length - 1} 
                            onClick={() => setCurrentQuestion(prev => prev + 1)}
                        >Next</button>
                    </div>
                </main>

                <aside className="question-nav">
                    <h3>Question Palette</h3>
                    <div className="number-grid">
                        {questions.map((_, i) => {
                            let statusClass = "";
                            if(currentQuestion === i) statusClass = "current";
                            else if(flaggedQuestions.includes(i)) statusClass = "flagged";
                            else if(answersRef.current[i] && answersRef.current[i].toString().trim() !== "") statusClass = "answered";
                            return(
                                <div 
                                    key={i} 
                                    className={`num-item ${statusClass}`}
                                    onClick={() => setCurrentQuestion(i)}
                                >
                                    {i + 1}
                                </div>
                            );    
                        })}
                    </div>

                    {/* Legend Section */}
                    <div className="palette-legend">
                        <div className="legend-item"><span className="dot answered"></span> Answered</div>
                        <div className="legend-item"><span className="dot current"></span> Current</div>
                        <div className="legend-item"><span className="dot unvisited"></span> Unvisited</div>
                        <div className="legend-item"><span className="dot flagged"></span> Flagged</div>
                    </div>
                </aside>
            </div>
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Submit Exam?</h2>
                        <p>Are you sure you want to submit your exam? Please review your answers before submitting.</p>
                        <div className="summary-stats">
                            <div className="stat">Total Questions: <strong>{questions.length}</strong></div>
                            <div className="stat">Answered: <strong style={{color: '#2ecc71'}}>{answeredCount}</strong></div>
                            <div className="stat">Flagged: <strong style={{color: '#e74c3c'}}>{flaggedCount}</strong></div>
                            <div className="stat">Remaining: <strong>{remainingCount}</strong></div>
                        </div>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowModal(false)}>Go Back</button>
                            <button className="confirm-btn" onClick={() => handleSubmit(false)} disabled={isSubmitting}>
                                {isSubmitting ? "Submitting..." : "Confirm Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
export default ExamRoom;