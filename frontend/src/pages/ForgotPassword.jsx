import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Login.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await api.post('/auth/forgot-password', { email });
            toast.success(res.data.message);
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
                <p className="auth-kicker">ACCOUNT RECOVERY</p>
                <h1>Forgot password</h1>
                <p className="auth-description">Enter your email address and we'll send you a link to reset your password.</p>
                
                <form onSubmit={handleSubmit} className="auth-form">
                    <label className="auth-field-label" htmlFor="recovery-email">Email address</label>
                    <input 
                        id="recovery-email"
                        type="email" 
                        placeholder="name@example.com" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        autoComplete="email"
                    />
                    <button type="submit" disabled={isLoading} className="login-submit-btn">
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                <div className="auth-return">
                    <Link to="/">Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
