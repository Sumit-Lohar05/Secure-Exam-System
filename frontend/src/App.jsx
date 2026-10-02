import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExamRoom from './pages/ExamRoom';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AddQuestion from './pages/Admin/AddQuestion';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import StudentProfile from './pages/StudentProfile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      {/* Injecting CSS Variables for Dark Mode Toasts */}
      <style>{`
        body.dark-mode {
          --toast-bg: #1e293b;
          --toast-text: #f8fafc;
          --toast-border: #334155;
          --toast-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
        }
      `}</style>
      {/* Global Toast Notifications Configuration */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--toast-bg, #ffffff)',
            color: 'var(--toast-text, #0f172a)',
            border: '1px solid var(--toast-border, #e2e8f0)',
            boxShadow: 'var(--toast-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1))',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: '600',
            padding: '16px',
            transition: 'all 0.4s ease',
          },
          success: { iconTheme: { primary: '#10b981', secondary: 'var(--toast-bg, #ffffff)' } },
          error: { iconTheme: { primary: '#ef4444', secondary: 'var(--toast-bg, #ffffff)' } },
        }} 
      />
      
      <Router>
        <Routes>
          {/* Student Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Student Routes */}
        <Route element={<ProtectedRoute allowedRole="student" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path='/exam/:id' element={<ExamRoom />} />
          <Route path="/profile" element={<StudentProfile />} />
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute allowedRole="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/add-question/:examId" element={<AddQuestion />} />
        </Route>

        {/* Catch-all Route for 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Router>
    </>
  );
}
export default App;