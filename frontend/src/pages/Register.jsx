import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from 'react-hot-toast';
import logo from "../assets/logo.png";
import "./Login.css";

const Register = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "student",
        adminSecret: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { name, email, password, role, adminSecret } = formData;

    const onChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError("");
    };

    const calculatePasswordStrength = (pass) => {
        let str = 0;
        if (pass.length > 5) str += 1;
        if (pass.length > 7) str += 1;
        if (/[A-Z]/.test(pass)) str += 1;
        if (/[0-9]/.test(pass)) str += 1;
        if (/[^A-Za-z0-9]/.test(pass)) str += 1;
        return Math.min(str, 5);
    };

    const strength = calculatePasswordStrength(password);
    const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const strengthColors = ["#ef4444", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981"];

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await API.post("/auth/register", formData);
            toast.success("Verification email sent!");
            navigate('/verify-email', { state: { email: formData.email, message: res.data.message } });
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

    return (
        <div className="login-container">
            <form onSubmit={handleRegisterSubmit} className="login-form">
                <img src={logo} alt="SecureExam Logo" className="form-logo" />
                <div className="login-header">
                    <h1>Create Account</h1>
                </div>

                <div className="field-group">
                    <label htmlFor="register-name">Name</label>
                    <input id="register-name" type="text" name="name" value={name} onChange={onChange} required autoComplete="name" />
                </div>

                <div className="field-group">
                    <label htmlFor="register-email">Email</label>
                    <input id="register-email" type="email" name="email" value={email} onChange={onChange} required autoComplete="email" />
                </div>

                <div className="field-group">
                    <label htmlFor="register-password">Password</label>
                    <input id="register-password" type="password" name="password" value={password} onChange={onChange} required autoComplete="new-password" />
                </div>

                {password && (
                    <div className="password-strength-container">
                        <div className="password-strength-bar">
                            <div
                                className="password-strength-fill"
                                style={{
                                    width: `${(strength / 5) * 100}%`,
                                    backgroundColor: strengthColors[strength],
                                }}
                            ></div>
                        </div>
                        <small style={{ color: strengthColors[strength] }}>
                            Password Strength: {strengthLabels[strength]}
                        </small>
                    </div>
                )}

                <div className="field-group">
                    <label htmlFor="register-role">Role</label>
                    <select id="register-role" name="role" value={role} onChange={onChange}>
                        <option value="student">Student</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                {role === 'admin' && (
                    <div className="field-group">
                        <label htmlFor="admin-secret">Admin Secret Key</label>
                        <input id="admin-secret" type="password" name="adminSecret" value={adminSecret} onChange={onChange} required autoComplete="new-password" />
                    </div>
                )}

                {error && <p className="error-message">{error}</p>}

                <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                </button>

                <p className="login-footer">
                    Already have an account? <button type="button" className="link-button" onClick={() => navigate("/")}>Log In</button>
                </p>
            </form>
        </div>
    );
};

export default Register;
