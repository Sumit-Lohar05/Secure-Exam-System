import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6' }}>
            <div style={{ background: 'white', padding: '40px 30px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50', marginBottom: '10px', marginTop: 0 }}>Set New Password</h2>
                <p style={{ color: '#7f8c8d', marginBottom: '20px', fontSize: '0.9rem' }}>Please enter your new password below.</p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="password" 
                        placeholder="New Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        minLength="6"
                        style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem', outline: 'none' }}
                    />
                    <input 
                        type="password" 
                        placeholder="Confirm New Password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        minLength="6"
                        style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem', outline: 'none' }}
                    />
                    <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1rem', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}>
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                <div style={{ marginTop: '20px' }}>
                    <Link to="/" style={{ color: '#7f8c8d', textDecoration: 'none', fontSize: '0.9rem' }}>Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
