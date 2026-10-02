import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Login.css';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            return toast.error('Passwords do not match');
        }

        setIsLoading(true);

        try {
            const res = await api.put(`/auth/reset-password/${token}`, { password });
            toast.success(res.data.message);
            setTimeout(() => {
                navigate('/'); // Redirect to login automatically after 3 seconds
            }, 3000);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container recovery-page">
            <div className="login-form">
                <img src={logo} alt="SecureExam" className="form-logo" />
                <p className="auth-kicker">ACCOUNT SECURITY</p>
                <h1>Set new password</h1>
                <p className="auth-description">Choose a new password for your account.</p>
                
                <form onSubmit={handleSubmit} className="auth-form">
                    <label className="auth-field-label" htmlFor="new-password">New password</label>
                    <input 
                        id="new-password"
                        type="password" 
                        placeholder="At least 6 characters" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        minLength="6"
                        autoComplete="new-password"
                    />
                    <label className="auth-field-label" htmlFor="confirm-password">Confirm new password</label>
                    <input 
                        id="confirm-password"
                        type="password" 
                        placeholder="Enter it again" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        minLength="6"
                        autoComplete="new-password"
                    />
                    <button type="submit" disabled={isLoading} className="login-submit-btn">
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                <div className="auth-return">
                    <Link to="/">Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
