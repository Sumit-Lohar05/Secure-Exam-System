import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Dashboard.css';

const Dashboard = () => {
    const [exams, setExams] = useState([]);
    const [completedExams, setCompletedExams] = useState([]);
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
                // Fetch student's past results to find which exams are completed
                const resultsRes = await api.get('/exams/student/results');
                const completedIds = resultsRes.data.map(result => result.examId?._id || result.examId);
                setCompletedExams(completedIds);
            } catch (err) {
                console.error("Error fetching exams:", err);
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
        if (exam.accessCode) {
            toast((t) => (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>🔒 Protected Exam</p>
                    <p style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Please enter the access code:</p>
                    <input 
                        id={`toast-input-${t.id}`} 
                        type="text" 
                        style={{ padding: '8px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px', color: '#0f172a' }} 
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button 
                            onClick={async () => {
                                const enteredCode = document.getElementById(`toast-input-${t.id}`).value;
                                if (!enteredCode) return toast.error("Access code required");
                                toast.dismiss(t.id);
                                
                                try {
                                    await api.post(`/exams/${exam._id}/verify`, { accessCode: enteredCode });
                                    startFullscreenAndNavigate(exam, enteredCode);
                                } catch (err) {
                                    toast.error(err.response?.data?.message || "Incorrect access code!");
                                }
                            }} 
                            style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                        >Submit</button>
                        <button onClick={() => toast.dismiss(t.id)} style={{ background: '#e2e8f0', color: '#0f172a', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
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
                <img src={logo} alt="SecureExam Logo" className="navbar-logo" />
                <div className="nav-right">
                    <span>Welcome, {user.name || 'Student'}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="logout-btn" style={{ backgroundColor: darkMode ? '#f1c40f' : '#2c3e50', color: darkMode ? '#2c3e50' : 'white', marginRight: '10px' }}>
                        {darkMode ? '☀️ Light' : '🌙 Dark'}
                    </button>
                    <button onClick={() => navigate('/profile')} className="logout-btn" style={{ backgroundColor: '#27ae60', marginRight: '10px' }}>
                        My Profile
                    </button>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>

            <main className="dashboard-content">
                <h3>Available Exams</h3>
                {exams.length === 0 ? (
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
                                        {exam.accessCode && <span className="lock-badge" title="Password Protected">🔒 Locked</span>}
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
