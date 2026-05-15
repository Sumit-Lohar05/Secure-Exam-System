import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--toast-bg, #f8fafc)', color: 'var(--toast-text, #0f172a)', textAlign: 'center', padding: '20px', transition: 'all 0.4s ease' }}>
            <h1 style={{ fontSize: '6rem', margin: '0', color: '#3b82f6' }}>404</h1>
            <h2 style={{ fontSize: '2rem', marginTop: '10px', marginBottom: '20px' }}>Page Not Found</h2>
            <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '30px', maxWidth: '500px' }}>
                Oops! The page you are looking for doesn't exist, requires authentication, or has been moved.
            </p>
            <button
                onClick={() => navigate('/')} 
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', transition: 'transform 0.2s ease' }}
            >
                Go Back Home
            </button>
        </div>
    );
};

export default NotFound;
