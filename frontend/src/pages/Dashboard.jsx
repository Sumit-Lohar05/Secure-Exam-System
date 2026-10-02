import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Dashboard.css';

const Dashboard = () => {
    const [exams, setExams] = useState([]);
    const [completedExams, setCompletedExams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchExams = async () => {
            try {
                const res = await api.get('/exams');
                // Filter to ONLY show exams that are published!
                const publishedExams = res.data.filter(exam => exam.status === 'Published');
                setExams(publishedExams);
                // Fetch student's completed results only; drafts should remain resumable.
                const resultsRes = await api.get('/exams/student/results');
                const completedIds = resultsRes.data
                    .filter(result => result.status === 'Completed' || (!result.status && Number(result.score) !== -1))
                    .map(result => result.examId?._id || result.examId);
                setCompletedExams(completedIds);
            } catch (err) {
                console.error("Error fetching exams:", err);
                setLoadError('Exams could not be loaded. Please try again shortly.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchExams();
    }, []);

    // Apply dark mode class to body and save preference
    useEffect(() => {
        localStorage.setItem('darkMode', darkMode);
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [darkMode]);

    const handleStartExam = async (exam) => {
        if (exam.requiresAccessCode) {
            toast((t) => (
                <div className="access-code-prompt">
                    <p className="access-code-title">Protected exam</p>
                    <label htmlFor={`toast-input-${t.id}`}>Enter the access code</label>
                    <input 
                        id={`toast-input-${t.id}`} 
                        type="text" 
                        className="access-code-input"
                        autoComplete="off"
                        autoFocus
                    />
                    <div className="access-code-actions">
                        <button 
                            onClick={async () => {
                                const enteredCode = String(document.getElementById(`toast-input-${t.id}`).value || '').trim();
                                if (!enteredCode) return toast.error("Access code required");
                                toast.dismiss(t.id);

                                try {
                                    await api.post(`/exams/${exam._id}/verify`, { accessCode: enteredCode });
                                    startFullscreenAndNavigate(exam, enteredCode);
                                } catch (err) {
                                    toast.error(err.response?.data?.message || "Incorrect access code!");
                                }
                            }} 
                            className="access-code-submit"
                        >Submit</button>
                        <button onClick={() => toast.dismiss(t.id)} className="access-code-cancel">Cancel</button>
                    </div>
                </div>
            ), { duration: Infinity });
            return;
        }

        startFullscreenAndNavigate(exam, "");
    };

    const startFullscreenAndNavigate = async (exam, enteredCode) => {
        try {
            // Force full screen on user click before navigating to the exam room
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.error("Failed to enter fullscreen:", err);
        }
        const queryParam = enteredCode ? `?accessCode=${encodeURIComponent(enteredCode)}` : "";
        navigate(`/exam/${exam._id}${queryParam}`);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="student-dashboard">
            <nav className="student-navbar"> 
                <div className="student-brand">
                    <img src={logo} alt="" className="navbar-logo" />
                    <span>SecureExam</span>
                </div>
                <div className="nav-right">
                    <span className="welcome-user">Welcome, {user.name || 'Student'}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="theme-btn" aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}>
                        {darkMode ? 'Light' : 'Dark'}
                    </button>
                    <button onClick={() => navigate('/profile')} className="profile-nav-btn">
                        My Profile
                    </button>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>

            <main className="dashboard-content">
                <div className="dashboard-heading">
                    <div>
                        <p className="dashboard-eyebrow">STUDENT PORTAL</p>
                        <h1>Available exams</h1>
                    </div>
                    <p className="dashboard-count">{exams.length} published {exams.length === 1 ? 'exam' : 'exams'}</p>
                </div>
                {isLoading ? (
                    <p className="dashboard-state" role="status">Loading available exams...</p>
                ) : loadError ? (
                    <p className="dashboard-state error" role="alert">{loadError}</p>
                ) : exams.length === 0 ? (
                    <p className="no-exams-msg">No exams are currently available. Check back later!</p>
                ) : (
                    <div className="exam-cards-container">
                        {exams.map(exam => {
                            const now = new Date();
                            const hasStarted = !exam.startTime || now >= new Date(exam.startTime);
                            const hasEnded = exam.endTime && now > new Date(exam.endTime);

                            // Simple date formatter to avoid the long toLocaleString()
                            const formatDate = (dateStr) => {
                                const d = new Date(dateStr);
                                return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + " " + 
                                    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            };

                            return (
                                <div key={exam._id} className="student-exam-card">
                                    <div className="card-header">
                                        <h4>{exam.title}</h4>
                                        {exam.requiresAccessCode && <span className="lock-badge" title="Password Protected">🔒 Locked</span>}
                                    </div>
                                    
                                    <p className="desc">{exam.description || "No description provided for this examination."}</p>
                                    
                                    <div className="exam-info-grid">
                                        <div className="info-item">
                                            <span className="info-label">Duration</span>
                                            <span className="info-value">{exam.duration} mins</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Questions</span>
                                            <span className="info-value">{exam.questions?.length || 0} items</span>
                                        </div>
                                    </div>

                                    <div className="exam-timing">
                                        {exam.startTime && (
                                            <div className="time-row">
                                                <span>Starts:</span> <strong>{formatDate(exam.startTime)}</strong>
                                            </div>
                                        )}
                                        {exam.endTime && (
                                            <div className="time-row">
                                                <span>Ends:</span> <strong>{formatDate(exam.endTime)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-footer">
                                        {completedExams.includes(exam._id) ? (
                                            <button className="status-btn completed" disabled>Completed</button>
                                        ) : hasEnded ? (
                                            <button className="status-btn ended" disabled>Expired</button>
                                        ) : !hasStarted ? (
                                            <button className="status-btn soon" disabled>Unavailable</button>
                                        ) : (
                                            <button className="start-exam-btn" onClick={() => handleStartExam(exam)}>
                                                Start Examination
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
