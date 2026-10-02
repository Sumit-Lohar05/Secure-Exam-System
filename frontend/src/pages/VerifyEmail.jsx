import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Login.css';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const emailFromState = location.state?.email || '';
    const [email, setEmail] = useState(emailFromState);
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);
    const [verified, setVerified] = useState(false);
    const [successMsg, setSuccessMsg] = useState(location.state?.message || 'Verification email sent!');
    const otpRefs = useRef([]);

    useEffect(() => {
        if (!email) {
            navigate('/register');
            return;
        }
    }, [email, navigate]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleOtpChange = (index, value) => {
        if (!/^[0-9]*$/.test(value)) return;
        const otpArray = Array.from({ length: 6 }).map((_, i) => otp[i] || '');
        otpArray[index] = value.slice(-1);
        const nextOtp = otpArray.join('');
        setOtp(nextOtp);

        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
        if (pastedData.some((char) => !/^[0-9]$/.test(char))) return;
        setOtp(pastedData.join(''));
        const focusIndex = Math.min(pastedData.length, 5);
        otpRefs.current[focusIndex]?.focus();
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await API.post('/auth/verify-otp', { email, otp });
            setSuccessMsg(res.data.message);
            setVerified(true);
            toast.success('Account verified successfully!');
        } catch (err) {
            console.error('OTP verification error:', err);
            setError(err.response?.data?.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || loading) return;
        setLoading(true);
        setError('');

        try {
            const res = await API.post('/auth/resend-otp', { email });
            toast.success(res.data.message || 'New OTP sent!');
            setResendTimer(60);
            setOtp('');
        } catch (err) {
            console.error('Resend OTP error:', err);
            setError(err.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    if (verified) {
        return (
            <div className="login-container">
                <div className="login-form">
                    <img src={logo} alt="SecureExam Logo" className="form-logo" />
                    <div className="login-header">
                        <h1>Verify Your Account</h1>
                    </div>

                    <div className="verification-success" role="status">
                        <h3>Account verified</h3>
                        <p>{successMsg}</p>
                        <button
                            type="button"
                            className="login-submit-btn"
                            onClick={() => navigate('/')}
                        >
                            Proceed to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <form onSubmit={handleVerifyOtp} className="login-form">
                <img src={logo} alt="SecureExam Logo" className="form-logo" />
                <div className="login-header">
                    <h1>Verify Your Account</h1>
                </div>

                <p className="auth-description">
                    {successMsg}
                </p>

                {error && <p className="error-message" role="alert">{error}</p>}

                <div className="field-group">
                    <label htmlFor="verify-email">Email</label>
                    <input
                        id="verify-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="otp-input-group" onPaste={handleOtpPaste} role="group" aria-label="Six digit verification code">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <input
                            key={index}
                            type="text"
                            maxLength="1"
                            className="otp-block"
                            aria-label={`Verification digit ${index + 1}`}
                            value={otp[index] || ''}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            ref={(el) => (otpRefs.current[index] = el)}
                            autoComplete="one-time-code"
                            autoFocus={index === 0}
                        />
                    ))}
                </div>

                <button type="submit" className="login-submit-btn" disabled={loading || otp.length !== 6}>
                    {loading ? 'Verifying...' : 'Verify Account'}
                </button>

                <p className="resend-otp-text">
                    Didn’t receive the code?{' '}
                    <button
                        type="button"
                        className="link-button"
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || loading}
                    >
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                </p>
            </form>
        </div>
    );
};

export default VerifyEmail;
