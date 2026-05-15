import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from 'react-hot-toast';
import logo from "../assets/logo.png";
import "./Login.css"; // Reuse login styles

const Register = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "student",
        adminSecret: ""
    });
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [showOtpForm, setShowOtpForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const otpRefs = useRef([]);
    const [resendTimer, setResendTimer] = useState(60);

    // --- OTP Resend Timer Effect ---
    useEffect(() => {
        let interval;
        if (showOtpForm && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showOtpForm, resendTimer]);

    const { name, email, password, role, adminSecret } = formData;

    const onChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError(""); // Clear error when user types
    };

    // --- Password Strength Logic ---
    const calculatePasswordStrength = (pass) => {
        let str = 0;
        if (pass.length > 5) str += 1;
        if (pass.length > 7) str += 1;
        if (/[A-Z]/.test(pass)) str += 1;
        if (/[0-9]/.test(pass)) str += 1;
        if (/[^A-Za-z0-9]/.test(pass)) str += 1;
        return Math.min(str, 5); // Max level is 5
    };

    const strength = calculatePasswordStrength(password);
    const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const strengthColors = ["#ef4444", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981"];

    // --- OTP Input Logic ---
    const handleOtpChange = (index, value) => {
        if (!/^[0-9]*$/.test(value)) return; // Only allow numbers
        const otpArray = Array.from({ length: 6 }).map((_, i) => otp[i] || "");
        otpArray[index] = value.slice(-1); // Take only the last typed character
        setOtp(otpArray.join(""));

        // Auto-focus next input
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        // Auto-focus previous input on backspace
        if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
        if (pastedData.some(char => !/^[0-9]$/.test(char))) return; // Ignore if not all numbers
        setOtp(pastedData.join(""));
        const focusIndex = Math.min(pastedData.length, 5);
        otpRefs.current[focusIndex]?.focus();
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await API.post("/auth/register", formData);
            setSuccessMsg(res.data.message);
            toast.success("Verification email sent!");
            setShowOtpForm(true);
        } catch (err) {
            console.error("Registration error:", err);
            if (err.response) {
                const status = err.response.status;
                const backendMessage = err.response.data?.message;

                if (status === 409) setError(backendMessage || "An account with this email already exists.");
                else if (status === 400) setError(backendMessage || "Please fill in all required fields correctly.");
                else setError(backendMessage || "Registration failed. Please try again later.");
            } else if (err.request) {
                setError("Cannot connect to the server. Please check your internet connection.");
            } else {
                setError("An unexpected error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await API.post("/auth/verify-otp", { email: formData.email, otp });
            toast.success("Account verified successfully!");
            setSuccessMsg(res.data.message);
            setShowOtpForm(false); // This will trigger the final success message render
        } catch (err) {
            console.error("OTP Verification error:", err);
            setError(err.response?.data?.message || "OTP verification failed.");
        } finally {
            setLoading(false);
        }
    };

    // --- Handle Resend OTP ---
    const handleResendOtp = async () => {
        if (resendTimer > 0 || loading) return;
        setLoading(true);
        setError("");
        try {
            const res = await API.post("/auth/resend-otp", { email: formData.email });
            toast.success(res.data.message || "New OTP sent!");
            setResendTimer(60); // Restart the 60s cooldown
            setOtp(""); // Clear any wrong OTP the user might have partially typed
            otpRefs.current[0]?.focus();
        } catch (err) {
            console.error("Resend OTP error:", err);
            setError(err.response?.data?.message || "Failed to resend OTP.");
        } finally {
            setLoading(false);
        }
    };

    return (
    <div className="login-container">
        <form onSubmit={showOtpForm ? handleOtpSubmit : handleRegisterSubmit} className="login-form">
            <img src={logo} alt="SecureExam Logo" className="form-logo" />
            <div className="login-header">
                <h1>{showOtpForm ? "Verify Your Account" : "Create Account"}</h1>
            </div>

            {successMsg && !showOtpForm ? (
                <div style={{ padding: '20px', background: '#d1fae5', color: '#059669', borderRadius: '12px', border: '1px solid #34d399', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>✅ Account Verified!</h3>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>{successMsg}</p>
                    <button 
                        type="button" 
                        className="login-submit-btn" 
                        style={{ marginTop: '20px' }}
                        onClick={() => navigate("/")}
                    >
                        Proceed to Login
                    </button>
                </div>
            ) : showOtpForm ? (
                <>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{successMsg}</p>
                    {error && <p className="error-message" style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
                    
                    <div className="otp-input-group" onPaste={handleOtpPaste}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <input
                                key={index}
                                type="text"
                                maxLength="1"
                                className="otp-block"
                                value={otp[index] || ""}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                ref={(el) => (otpRefs.current[index] = el)}
                                required
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>
                    <button type="submit" className="login-submit-btn" disabled={loading || otp.length !== 6}>
                        {loading ? "Verifying..." : "Verify Account"}
                    </button>
                    
                    <div style={{ marginTop: '20px', fontSize: '0.95rem', color: '#64748b' }}>
                        Didn't receive the code?{' '}
                        <span 
                            onClick={resendTimer === 0 ? handleResendOtp : undefined}
                            style={{ 
                                color: resendTimer === 0 ? '#3b82f6' : '#94a3b8', 
                                cursor: resendTimer === 0 && !loading ? 'pointer' : 'default',
                                fontWeight: resendTimer === 0 ? '600' : 'normal',
                            }}
                        >
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                        </span>
                    </div>
                </>
            ) : (
                <>
            {error && <p className="error-message" style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
            
            <div className="role-selector-group">
                <button 
                    type="button" 
                    className={`role-btn ${role === 'student' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, role: 'student'})}
                >
                    Student
                </button>
                <button 
                    type="button" 
                    className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, role: 'admin'})}
                >
                    Admin
                </button>
            </div>

            <input 
                type="text" 
                placeholder="Full Name" 
                name="name"
                value={name}
                onChange={onChange} 
                required 
            />
            <input 
                type="email" 
                placeholder="Email Address" 
                name="email"
                value={email}
                onChange={onChange} 
                required 
            />
            <input 
                type="password" 
                placeholder="Password" 
                name="password"
                value={password}
                onChange={onChange} 
                required 
            />
            {role === 'admin' && (
                <input 
                    type="password" 
                    placeholder="Admin Secret Key" 
                    name="adminSecret"
                    value={adminSecret}
                    onChange={onChange} 
                    required 
                />
            )}
            {password && (
                <div className="password-strength-meter">
                    <div className="strength-bar-container">
                        <div 
                            className="strength-bar" 
                            style={{ 
                                width: `${(strength / 5) * 100}%`, 
                                backgroundColor: strengthColors[strength] 
                            }}
                        ></div>
                    </div>
                    <span style={{ color: strengthColors[strength] }}>
                        {strengthLabels[strength]}
                    </span>
                </div>
            )}

            <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? "Creating Account..." : "Register Now"}
            </button>

            <p className="login-link-text">
                Already have an account? <span onClick={() => navigate("/")}>Login here</span>
            </p>
                </>
            )}
        </form>
    </div>
);
}
export default Register;
