import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6' }}>
            <div style={{ background: 'white', padding: '40px 30px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50', marginBottom: '10px', marginTop: 0 }}>Forgot Password</h2>
                <p style={{ color: '#7f8c8d', marginBottom: '20px', fontSize: '0.9rem' }}>Enter your email address and we'll send you a link to reset your password.</p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="email" 
                        placeholder="Enter your email address" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem', outline: 'none' }}
                    />
                    <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1rem', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}>
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                <div style={{ marginTop: '20px' }}>
                    <Link to="/" style={{ color: '#3498db', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>&larr; Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
