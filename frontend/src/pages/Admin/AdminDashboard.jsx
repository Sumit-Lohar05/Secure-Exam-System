import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Copy } from 'lucide-react'
import logo from "../../assets/logo.png";
import api from "../../api/axios";
import toast from 'react-hot-toast';
import "./Admin.css";
import "./AdminExtended.css"; // Import the new styles

// Helper to safely map ISO string from database to HTML5 <input type="datetime-local"> format
const formatDateTimeLocal = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date - offset)).toISOString().slice(0, 16);
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const adminName = user.name || "Admin"; 

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newExamTitle, setNewExamTitle] = useState("");
    const [newExamDescription, setNewExamDescription] = useState("");
    const [newExamDuration, setNewExamDuration] = useState(60);
    const [newExamAccessCode, setNewExamAccessCode] = useState("");
    const [newExamStartTime, setNewExamStartTime] = useState("");
    const [newExamEndTime, setNewExamEndTime] = useState("");
    
    const [showEditModal, setShowEditModal] = useState(false);
    const [editExamData, setEditExamData] = useState({ id: '', title: '', description: '', duration: 60, accessCode: '', startTime: '', endTime: '' });
    
    const [myExams, setMyExams] = useState([]);
    const [activeTab, setActiveTab] = useState("exams"); // 'exams', 'results', 'questionBank', or 'users'
    const [studentResults, setStudentResults] = useState([]);
    const [users, setUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const resultsPerPage = 10;
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [viewResultDetails, setViewResultDetails] = useState(null); // State for detailed review modal
    const [questionBank, setQuestionBank] = useState([]);
    const [searchBankQuery, setSearchBankQuery] = useState("");
    const [editingScore, setEditingScore] = useState(false);
    const [newScore, setNewScore] = useState(0);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [currentBankPage, setCurrentBankPage] = useState(1);

    // Fetch real exams from the database when the dashboard loads
    useEffect(() => {
        api.get('/exams')
           .then(res => setMyExams(res.data))
           .catch(err => console.error("Error fetching exams:", err));
    }, []);

    // Fetch student results when the Results tab is active
    useEffect(() => {
        if (activeTab === "results") {
            api.get('/exams/all-results')
               .then(res => setStudentResults(res.data))
               .catch(err => console.error("Error fetching results:", err));
        }
    }, [activeTab]);

    // Fetch question bank when the Question Bank tab is active
    useEffect(() => {
        if (activeTab === "questionBank") {
            api.get('/exams/all-questions')
               .then(res => setQuestionBank(res.data))
               .catch(err => console.error("Error fetching question bank:", err));
        }
    }, [activeTab]);

    // Apply dark mode class to body and save preference
    useEffect(() => {
        localStorage.setItem('darkMode', darkMode);
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [darkMode]);

    const handleLogout = () => {
        console.log("Logging out Admin...");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
    }

    const handleCreateExam = async (e) => {
        e.preventDefault();
        if (!newExamTitle.trim()) return;

        try {
            // Create the exam in the database
            const res = await api.post('/exams', {
                title: newExamTitle,
                description: newExamDescription || "Add a description here",
                duration: Number(newExamDuration) || 60,
                accessCode: newExamAccessCode,
                startTime: newExamStartTime ? new Date(newExamStartTime).toISOString() : null,
                endTime: newExamEndTime ? new Date(newExamEndTime).toISOString() : null
            });
            
            // Add the newly created exam to our state list 
            setMyExams([res.data, ...myExams]);
            setNewExamTitle("");
            setNewExamDescription("");
            setNewExamDuration(60);
            setNewExamAccessCode("");
            setNewExamStartTime("");
            setNewExamEndTime("");
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error creating exam:", error);
            toast.error(error.response?.data?.message || "Failed to create exam. Check the Node.js console!");
        }
    };

    const openEditModal = (exam) => {
        setEditExamData({
            id: exam._id,
            title: exam.title,
            description: exam.description || "",
            duration: exam.duration || 60,
            accessCode: exam.accessCode || "",
            startTime: formatDateTimeLocal(exam.startTime),
            endTime: formatDateTimeLocal(exam.endTime)
        });
        setShowEditModal(true);
    };

    const handleUpdateExam = async (e) => {
        e.preventDefault();
        if (!editExamData.title.trim()) return;

        try {
            const payload = {
                title: editExamData.title,
                description: editExamData.description,
                duration: Number(editExamData.duration),
                accessCode: editExamData.accessCode,
                startTime: editExamData.startTime ? new Date(editExamData.startTime).toISOString() : null,
                endTime: editExamData.endTime ? new Date(editExamData.endTime).toISOString() : null
            };
            const res = await api.put(`/exams/${editExamData.id}`, payload);
            setMyExams(myExams.map(ex => ex._id === editExamData.id ? res.data : ex));
            setShowEditModal(false);
        } catch (error) {
            console.error("Error updating exam:", error);
            toast.error(error.response?.data?.message || "Failed to update exam details. Check Node.js console!");
        }
    };

    const handleToggleStatus = async (examId, currentStatus, questionCount) => {
        if (currentStatus === 'Draft' && questionCount === 0) {
            toast.error("You cannot publish an exam with 0 questions. Please add questions first.");
            return;
        }
        const newStatus = currentStatus === 'Published' ? 'Draft' : 'Published';
        try {
            const res = await api.put(`/exams/${examId}/status`, { status: newStatus });
            // Update the specific exam's status in our state list
            setMyExams(myExams.map(exam => exam._id === examId ? { ...exam, status: res.data.status } : exam));
        } catch (error) {
            console.error("Error updating exam status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleDeleteExam = async (examId) => {
        toast((t) => (
            <div>
                <p>Are you sure you want to delete this entire exam? This action cannot be undone.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            await api.delete(`/exams/${examId}`);
                            setMyExams(prev => prev.filter(exam => exam._id !== examId));
                            toast.success("Exam deleted successfully");
                        } catch (error) {
                            console.error("Error deleting exam:", error);
                            toast.error("Failed to delete exam");
                        }
                    }} style={{ background: '#ef4444', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Delete</button>
                    <button onClick={() => toast.dismiss(t.id)} style={{ background: '#e2e8f0', color: '#0f172a', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const handleDuplicateExam = async (examId) => {
        toast((t) => (
            <div>
                <p>Are you sure you want to duplicate this exam and all its questions?</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            const res = await api.post(`/exams/${examId}/duplicate`);
                            setMyExams(prev => [res.data, ...prev]);
                            toast.success(`Exam duplicated successfully as "${res.data.title}"!`);
                        } catch (error) {
                            console.error("Error duplicating exam:", error);
                            toast.error(error.response?.data?.message || "Failed to duplicate exam.");
                        }
                    }} style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Duplicate</button>
                    <button onClick={() => toast.dismiss(t.id)} style={{ background: '#e2e8f0', color: '#0f172a', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const openReviewModal = (result) => {
        setViewResultDetails(result);
        setEditingScore(false);
        setNewScore(result.score);
    };

    const handleUpdateScore = async () => {
        try {
            const res = await api.put(`/exams/results/${viewResultDetails._id}/score`, { score: newScore });
            // Update local state to reflect the change immediately
            const updatedResult = { ...viewResultDetails, score: res.data.score };
            setViewResultDetails(updatedResult);
            setStudentResults(studentResults.map(r => r._id === updatedResult._id ? updatedResult : r));
            setEditingScore(false);
            toast.success("Score updated successfully!");
        } catch (error) {
            console.error("Error updating score:", error);
            toast.error("Failed to update score.");
        }
    };

    const handleDeleteResult = async (resultId) => {
        toast((t) => (
            <div>
                <p>Are you sure you want to delete this result? The student will be allowed to retake this exam.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            await api.delete(`/exams/results/${resultId}`);
                            setStudentResults(prev => prev.filter(r => r._id !== resultId));
                            toast.success("Result deleted successfully.");
                        } catch (error) {
                            console.error("Error deleting result:", error);
                            toast.error("Failed to delete result.");
                        }
                    }} style={{ background: '#ef4444', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Delete</button>
                    <button onClick={() => toast.dismiss(t.id)} style={{ background: '#e2e8f0', color: '#0f172a', padding: '6px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    // Filter results based on search query
    const filteredResults = studentResults.filter(result => {
        const searchLower = searchQuery.toLowerCase();
        const name = result.studentId?.name || "Unknown";
        const email = result.studentId?.email || "N/A";
        return name.toLowerCase().includes(searchLower) || email.toLowerCase().includes(searchLower);
    });

    // Sort results
    const sortedResults = [...filteredResults].sort((a, b) => {
        if (sortConfig.key === 'studentName') {
            const nameA = a.studentId?.name || "Unknown";
            const nameB = b.studentId?.name || "Unknown";
            return sortConfig.direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        if (sortConfig.key === 'email') {
            const emailA = a.studentId?.email || "N/A";
            const emailB = b.studentId?.email || "N/A";
            return sortConfig.direction === 'asc' ? emailA.localeCompare(emailB) : emailB.localeCompare(emailA);
        }
        if (sortConfig.key === 'examTitle') {
            const titleA = a.examId?.title || "Deleted Exam";
            const titleB = b.examId?.title || "Deleted Exam";
            return sortConfig.direction === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
        }
        if (sortConfig.key === 'score') {
            // Use percentage to accurately compare scores across exams with different total questions
            const scoreA = a.totalQuestions ? a.score / a.totalQuestions : 0;
            const scoreB = b.totalQuestions ? b.score / b.totalQuestions : 0;
            return sortConfig.direction === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        }
        if (sortConfig.key === 'date') {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        return 0;
    });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination logic
    const indexOfLastResult = currentPage * resultsPerPage;
    const indexOfFirstResult = indexOfLastResult - resultsPerPage;
    const currentResults = sortedResults.slice(indexOfFirstResult, indexOfLastResult);
    const totalPages = Math.ceil(sortedResults.length / resultsPerPage);

    // Pagination logic for Question Bank
    const filteredBank = questionBank.filter(q => q.questionText.toLowerCase().includes(searchBankQuery.toLowerCase()));
    const indexOfLastBankResult = currentBankPage * resultsPerPage;
    const indexOfFirstBankResult = indexOfLastBankResult - resultsPerPage;
    const currentBankResults = filteredBank.slice(indexOfFirstBankResult, indexOfLastBankResult);
    const totalBankPages = Math.ceil(filteredBank.length / resultsPerPage);

    // Export sorted/filtered results to CSV
    const handleExportCSV = () => {
        if (sortedResults.length === 0) {
            toast.error("No results to export.");
            return;
        }

        const headers = ["Student Name", "Email", "Exam Title", "Score", "Total Questions", "Percentage", "Submitted On"];
        
        const csvRows = sortedResults.map(result => {
            const name = (result.studentId?.name || "Unknown").replace(/"/g, '""');
            const email = (result.studentId?.email || "N/A").replace(/"/g, '""');
            const title = (result.examId?.title || "Deleted Exam").replace(/"/g, '""');
            const score = result.score;
            const total = result.totalQuestions;
            const percentage = total > 0 ? ((score / total) * 100).toFixed(1) + "%" : "0%";
            const date = new Date(result.createdAt).toLocaleString().replace(/"/g, '""');

            return `"${name}","${email}","${title}",${score},${total},"${percentage}","${date}"`;
        });

        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Student_Results_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="dashboard-wrapper">
            <nav className="sidebar">  
                <div className="sidebar-header">
                    <img src={logo} alt="SecureExam Logo" className="sidebar-logo" />
                </div>
                <ul className="sidebar-menu">
                    <li className={activeTab === "exams" ? "active" : ""} onClick={() => setActiveTab("exams")}>
                        Manage Exams
                    </li>
                    <li className={activeTab === "results" ? "active" : ""} onClick={() => setActiveTab("results")}>
                        View Results
                    </li>
                    <li className={activeTab === "questionBank" ? "active" : ""} onClick={() => setActiveTab("questionBank")}>
                        Question Bank
                    </li>
                    <li onClick={() => setDarkMode(!darkMode)} style={{ cursor: "pointer" }}>
                        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                    </li>
                    <li className="logout-item" onClick={handleLogout}>Logout</li>
                </ul>
            </nav>

            <main className="main-content">
                {activeTab === "exams" && (
                    <>
                        <div className="dashboard-intro">
                            <h1>Welcome, {adminName}</h1>
                            <p>Manage your examination system and view student performance.</p>
                        </div>
                        <div className="admin-header">
                            <h2>Your Exams</h2>
                            <button className="create-exam-btn" onClick={() => setShowCreateModal(true)}>
                                + Create New Exam
                            </button>
                        </div>
                        <div className="exam-grid">
                            {myExams.map(exam => (
                                <div key={exam._id} className="exam-card">
                                    {/* Top Right Edit Icon */}
                                    <button className="edit-icon-btn" onClick={() => openEditModal(exam)} title="Edit Exam Details">
                                        <Edit size={16} />
                                    </button>
                                    <button className="copy-icon-btn" onClick={() => handleDuplicateExam(exam._id)} title="Duplicate Exam">
                                        <Copy size={16} />
                                    </button>
                                    <button className="delete-icon-btn" onClick={() => handleDeleteExam(exam._id)} title="Delete Exam">
                                        <Trash2 size={16} />
                                    </button>
                                    
                                    <h3>{exam.title}</h3>
                                    <div className="exam-details">
                                        <p>Questions: <strong>{exam.questions?.length || 0}</strong></p>
                                        <p>Duration: <strong>{exam.duration} mins</strong></p>
                                        <p>Status: <span className={`status-badge ${exam.status === 'Published' ? 'published' : 'draft'}`}>{exam.status}</span></p>
                                        <p>Access Code: <strong>{exam.accessCode || "None"}</strong></p>
                                        {exam.startTime && <p>Starts: <strong>{new Date(exam.startTime).toLocaleString()}</strong></p>}
                                        {exam.endTime && <p>Ends: <strong>{new Date(exam.endTime).toLocaleString()}</strong></p>}
                                    </div>
                                    <p className="exam-description">{exam.description}</p>
                                    
                                    {/* 2-Column Action Buttons */}
                                    <div className="exam-actions">
                                        <button 
                                            className="btn-edit-questions"
                                            onClick={() => navigate(`/admin/add-question/${exam._id}`)}
                                        >
                                            Edit Questions
                                        </button>
                                        <button 
                                            className={exam.status === 'Published' ? 'btn-unpublish' : 'btn-publish'}
                                            onClick={() => handleToggleStatus(exam._id, exam.status, exam.questions?.length || 0)}
                                        >
                                            {exam.status === 'Published' ? 'Unpublish' : 'Publish'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                
                {activeTab === "results" && (
                    <div className="results-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0 }}>Student Results</h2>
                            <button className="create-exam-btn" style={{ backgroundColor: '#27ae60', padding: '8px 15px', fontSize: '0.9rem' }} onClick={handleExportCSV}>
                                Export CSV
                            </button>
                        </div>
                        <input 
                            type="text" 
                            className="admin-input admin-search-input" 
                            placeholder="Search by student name or email..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset to page 1 on new search
                            }}
                        />
                        <table className="preview-table results-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('studentName')} className="sortable-header">
                                        Student Name <span className="sort-arrow">{sortConfig.key === 'studentName' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </th>
                                    <th onClick={() => handleSort('email')} className="sortable-header">
                                        Email <span className="sort-arrow">{sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </th>
                                    <th onClick={() => handleSort('examTitle')} className="sortable-header">
                                        Exam Title <span className="sort-arrow">{sortConfig.key === 'examTitle' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </th>
                                    <th onClick={() => handleSort('score')} className="sortable-header">
                                        Score <span className="sort-arrow">{sortConfig.key === 'score' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </th>
                                    <th onClick={() => handleSort('date')} className="sortable-header">
                                        Submitted On <span className="sort-arrow">{sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentResults.map((result) => (
                                    <tr key={result._id}>
                                        <td>{result.studentId?.name || "Unknown"}</td>
                                        <td>{result.studentId?.email || "N/A"}</td>
                                        <td>{result.examId?.title || "Deleted Exam"}</td>
                                        <td className="bold-text">{result.score} / {result.totalQuestions}</td>
                                        <td>{new Date(result.createdAt).toLocaleString()}</td>
                                        <td className="action-btns-flex">
                                            <button className="table-review-btn" onClick={() => openReviewModal(result)} title="Review Answers">
                                                Review
                                            </button>
                                            <button className="table-review-btn" style={{ backgroundColor: '#e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDeleteResult(result._id)} title="Delete Result">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {currentResults.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="empty-table-cell">No results found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="pagination-container">
                                <span className="pagination-info">
                                    Showing {indexOfFirstResult + 1} to {Math.min(indexOfLastResult, filteredResults.length)} of {filteredResults.length} entries
                                </span>
                                <div className="pagination-controls">
                                    <button 
                                        className="page-btn"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span className="page-text">Page {currentPage} of {totalPages}</span>
                                    <button 
                                        className="page-btn"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "questionBank" && (
                    <div className="results-section">
                        <h2>Central Question Bank</h2>
                        <p className="bank-info">This is an automated repository of all questions from every exam. To add questions here, simply add them to any exam!</p>
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
                                    <th>Question Text</th>
                                    <th>Type</th>
                                    <th>Source Exam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentBankResults.map((q, index) => (
                                    <tr key={q._id || index}>
                                        <td>{q.questionText.substring(0, 100)}...</td>
                                        <td><span className={`status-badge ${q.options && q.options.length > 0 ? 'published' : 'draft'}`}>{q.options && q.options.length > 0 ? "MCQ" : "Descriptive"}</span></td>
                                        <td>{q.sourceExamTitle}</td>
                                    </tr>
                                ))}
                                {currentBankResults.length === 0 && (
                                    <tr><td colSpan="3" className="empty-table-cell">No external questions found. Create an exam and add questions!</td></tr>
                                )}
                            </tbody>
                        </table>
                        
                        {/* Question Bank Pagination Controls */}
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
                    </div>
                )}
            </main>

            {/* Create Exam Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Create New Exam</h2>
                        <form onSubmit={handleCreateExam}>
                            <input 
                                type="text" 
                                className="admin-input" 
                                placeholder="Enter Exam Title (e.g. Java Quiz)"
                                value={newExamTitle}
                                onChange={(e) => setNewExamTitle(e.target.value)}
                                required
                                autoFocus
                            />
                            <textarea
                                className="admin-input admin-textarea-ext"
                                placeholder="Exam Description"
                                value={newExamDescription}
                                onChange={(e) => setNewExamDescription(e.target.value)}
                            />
                            <div className="duration-wrapper">
                                <label>Duration (minutes): </label>
                                <input 
                                    type="number"
                                    className="admin-input duration-input" 
                                    value={newExamDuration}
                                    onChange={(e) => setNewExamDuration(e.target.value)}
                                    min="1"
                                    required
                                />
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <label>Access Code (Optional): </label>
                                <input 
                                    type="text"
                                    className="admin-input" 
                                    placeholder="Leave blank for no password"
                                    value={newExamAccessCode}
                                    onChange={(e) => setNewExamAccessCode(e.target.value)}
                                />
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <label>Start Time (Optional): </label>
                                <input 
                                    type="datetime-local" 
                                    className="admin-input" 
                                    value={newExamStartTime}
                                    onChange={(e) => setNewExamStartTime(e.target.value)}
                                />
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <label>End Time (Optional): </label>
                                <input 
                                    type="datetime-local" 
                                    className="admin-input" 
                                    value={newExamEndTime}
                                    onChange={(e) => setNewExamEndTime(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="confirm-btn">Create Exam</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        {/* Edit Exam Modal */}
        {showEditModal && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>Edit Exam Details</h2>
                    <form onSubmit={handleUpdateExam}>
                        <input 
                            type="text" 
                            className="admin-input" 
                            placeholder="Enter Exam Title"
                            value={editExamData.title}
                            onChange={(e) => setEditExamData({...editExamData, title: e.target.value})}
                            required
                            autoFocus
                        />
                        <textarea
                            className="admin-input admin-textarea-ext"
                            placeholder="Exam Description"
                            value={editExamData.description}
                            onChange={(e) => setEditExamData({...editExamData, description: e.target.value})}
                        />
                        <div className="duration-wrapper">
                            <label>Duration (minutes): </label>
                            <input 
                                type="number" 
                                className="admin-input duration-input" 
                                value={editExamData.duration}
                                onChange={(e) => setEditExamData({...editExamData, duration: e.target.value})}
                                min="1"
                                required
                            />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <label>Access Code (Optional): </label>
                            <input 
                                type="text" 
                                className="admin-input" 
                                value={editExamData.accessCode}
                                onChange={(e) => setEditExamData({...editExamData, accessCode: e.target.value})}
                            />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <label>Start Time (Optional): </label>
                            <input 
                                type="datetime-local" 
                                className="admin-input" 
                                value={editExamData.startTime}
                                onChange={(e) => setEditExamData({...editExamData, startTime: e.target.value})}
                            />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <label>End Time (Optional): </label>
                            <input 
                                type="datetime-local" 
                                className="admin-input" 
                                value={editExamData.endTime}
                                onChange={(e) => setEditExamData({...editExamData, endTime: e.target.value})}
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button type="submit" className="confirm-btn">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Review Results Modal */}
        {viewResultDetails && (
            <div className="modal-overlay">
                <div className="modal-content review-modal-content">
                    <h2 className="review-modal-header">Review Answers: {viewResultDetails.studentId?.name || "Unknown"}</h2>
                    <p><strong>Exam:</strong> {viewResultDetails.examId?.title || "Deleted Exam"}</p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <strong>Final Score:</strong> 
                        {editingScore ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input 
                                    type="number" 
                                    value={newScore} 
                                    onChange={(e) => setNewScore(e.target.value)} 
                                    className="admin-input" 
                                    style={{ width: '70px', padding: '5px', margin: 0 }} 
                                    min="0" 
                                    max={viewResultDetails.totalQuestions}
                                />
                                <span>/ {viewResultDetails.totalQuestions}</span>
                                <button className="confirm-btn review-btn" style={{ padding: '5px 10px', margin: 0 }} onClick={handleUpdateScore}>Save</button>
                                <button className="cancel-btn review-btn" style={{ padding: '5px 10px', margin: 0 }} onClick={() => setEditingScore(false)}>Cancel</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>{viewResultDetails.score} / {viewResultDetails.totalQuestions}</span>
                                <button className="edit-mini-btn" onClick={() => setEditingScore(true)}>Adjust Score</button>
                            </div>
                        )}
                    </div>

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
                                            <strong>Student's Answer:</strong> {studentAns} {isCorrect ? "✅" : "❌"}
                                        </p>
                                        {!isCorrect && (
                                            <p className="review-expected-ans"><strong>Correct Answer:</strong> {q.correctAnswer}</p>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="review-deleted-text">Detailed questions are no longer available because this exam was deleted or altered.</p>
                        )}
                    </div>
                    <div className="modal-actions modal-actions-ext">
                        <button className="cancel-btn" onClick={() => setViewResultDetails(null)}>Close Review</button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
};

export default AdminDashboard;