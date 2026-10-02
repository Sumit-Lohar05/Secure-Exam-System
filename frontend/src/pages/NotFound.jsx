import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="not-found-page">
            <p className="auth-kicker">SECUREEXAM PORTAL</p>
            <h1>404</h1>
            <h2>Page not found</h2>
            <p>
                This address is unavailable or may have moved.
            </p>
            <button
                onClick={() => navigate('/')} 
                className="login-submit-btn"
            >
                Go Back Home
            </button>
        </div>
    );
};

export default NotFound;
