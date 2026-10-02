import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import './Dashboard.css'; // Reuse some styles
import './Admin/Admin.css'; // Reuse table styles
import './Profile.css'; // Dedicated profile layout styles

const StudentProfile = () => {
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [viewResultDetails, setViewResultDetails] = useState(null); // State for detailed review modal
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await api.get('/exams/student/results');
                setResults(res.data);
            } catch (err) {
                console.error("Error fetching results:", err);
                setLoadError('Your results could not be loaded. Please try again shortly.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchResults();
    }, []);

    const handleViewResult = async (resultId) => {
        try {
            const res = await api.get(`/exams/student/results/${resultId}`);
            setViewResultDetails(res.data);
        } catch (err) {
            console.error("Error fetching result details:", err);
        }
    };

    // Calculate Profile Statistics
    const totalExams = results.length;
    const avgScore = totalExams > 0 
        ? (results.reduce((acc, curr) => acc + (curr.totalQuestions > 0 ? (curr.score / curr.totalQuestions) * 100 : 0), 0) / totalExams).toFixed(1) 
        : 0;

    return (
        <div className="student-dashboard">
            <nav className="student-navbar">
                <div className="student-brand"><span>SecureExam</span></div>
                <div className="nav-right">
                    <button onClick={() => navigate('/dashboard')} className="back-nav-btn">Back to Dashboard</button>
                </div>
            </nav>

            <main className="profile-dashboard">
                <section className="profile-card">
                    <div className="profile-header">
                        <div className="profile-avatar">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div className="profile-info">
                            <h3>{user.name}</h3>
                            <p>{user.email}</p>
                        </div>
                    </div>
                </section>

                <div className="stats-container">
                    <div className="stat-card">
                        <h4>Total Exams Taken</h4>
                        <p className="stat-value">{totalExams}</p>
                    </div>
                    <div className="stat-card" style={{ borderTopColor: avgScore > 75 ? '#27ae60' : avgScore < 40 ? '#e74c3c' : '#f39c12' }}>
                        <h4>Average Score</h4>
                        <p className="stat-value">{avgScore}%</p>
                    </div>
                </div>

                <section className="profile-results-section">
                    <div className="profile-section-heading"><div><p className="dashboard-eyebrow">ASSESSMENT HISTORY</p><h3>My past results</h3></div></div>
                    {isLoading ? (
                        <p className="empty-table-cell" role="status">Loading your results...</p>
                    ) : loadError ? (
                        <p className="empty-table-cell profile-error" role="alert">{loadError}</p>
                    ) : results.length === 0 ? (
                        <p className="empty-table-cell">You have not completed any exams yet.</p>
                    ) : (
                        <div className="profile-table-wrap"><table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Exam Title</th>
                                    <th>Score</th>
                                    <th>Percentage</th>
                                    <th>Date Taken</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(result => {
                                    const percentage = result.totalQuestions > 0 ? ((result.score / result.totalQuestions) * 100).toFixed(1) : 0;
                                    let badgeClass = "badge-warning";
                                    if (percentage >= 75) badgeClass = "badge-success";
                                    else if (percentage < 40) badgeClass = "badge-danger";
                                    
                                    return (
                                        <tr key={result._id}>
                                            <td>{result.examId?.title || <span className="deleted-exam-text">Deleted Exam</span>}</td>
                                            <td className="bold-text">{result.score} / {result.totalQuestions}</td>
                                            <td><span className={`score-badge ${badgeClass}`}>{percentage}%</span></td>
                                            <td>{new Date(result.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <button className="table-review-btn" onClick={() => handleViewResult(result._id)}>
                                                    View Report
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table></div>
                    )}
                </section>
            </main>

            {/* Detailed Review Modal */}
            {viewResultDetails && (
                <div className="modal-overlay">
                    <div className="modal-content review-modal-content">
                        <h2 className="review-modal-header">Detailed Report: {viewResultDetails.examId?.title || "Deleted Exam"}</h2>
                        <p><strong>Final Score:</strong> {viewResultDetails.score} / {viewResultDetails.totalQuestions}</p>
                        
                        <div className="review-questions-wrapper">
                            {viewResultDetails.examId && viewResultDetails.examId.questions ? (
                                viewResultDetails.examId.questions.map((q, index) => {
                                    const studentAns = (viewResultDetails.answers && viewResultDetails.answers[index]) ? viewResultDetails.answers[index] : "No Answer Provided";
                                    const isDescriptive = q.options && q.options.length === 0;
                                    const isCorrect = isDescriptive
                                        ? studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
                                        : studentAns === q.correctAnswer;

                                    return (
                                        <div key={index} className="review-question-item">
                                            <p className="review-q-text">Q{index + 1}: {q.questionText}</p>
                                            {isDescriptive && <span className="review-q-tag">Descriptive / Text</span>}
                                            <p className="review-ans-text" style={{ color: isCorrect ? '#27ae60' : '#c0392b' }}>
                                                <strong>Your Answer:</strong> {studentAns} {isCorrect ? "✅" : "❌"}
                                            </p>
                                            {!isCorrect && (
                                                <p className="review-expected-ans"><strong>Correct Answer:</strong> {q.correctAnswer}</p>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="review-deleted-text">Detailed questions are no longer available because this exam was deleted by the administrator.</p>
                            )}
                        </div>
                        <div className="modal-actions modal-actions-ext">
                            <button className="cancel-btn" onClick={() => setViewResultDetails(null)}>Close Report</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentProfile;
