import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import logo from "../assets/logo.png";
import "./Login.css";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await API.post("/auth/login", { email, password });
            
            // Store token and user data
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));

            console.log("Login successful:", res.data.user.name);
            
            // Redirect based on role
            if (res.data.user.role === "admin") {
                navigate("/admin/dashboard");
            } else {
                navigate("/dashboard");
            }
        } catch (err) {
            console.error("Login error:", err);
            
            if (err.response) {
                // The backend responded with a status code outside the 2xx range
                const status = err.response.status;
                const backendMessage = err.response.data?.message;

                if (status === 404) setError(backendMessage || "User is not registered. Please create an account.");
                else if (status === 401) setError(backendMessage || "Invalid email or password.");
                else if (status === 403) setError(backendMessage || "Please verify your email before logging in.");
                else if (status === 400) setError(backendMessage || "Please provide a valid email and password.");
                else setError(backendMessage || "Login failed. Please try again later.");
            } else if (err.request) {
                // The request was made but no response was received
                setError("Cannot connect to the server. Please check your internet connection.");
            } else {
                // Something happened in setting up the request
                setError("An unexpected error occurred. Please try again.");
            }
            setLoading(false);
        }
    }

    return (
        <div className="login-container">
            <form onSubmit={handleLogin} className="login-form">
                <img src={logo} alt="SecureExam Logo" className="form-logo" />
                <h1>Portal Login</h1>
                {error && <p className="error-message" style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
                <label className="auth-field-label" htmlFor="login-email">Email address</label>
                <input 
                    id="login-email"
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(""); // Clear error when typing
                    }} 
                    required 
                />
                <label className="auth-field-label" htmlFor="login-password">Password</label>
                <input 
                    id="login-password"
                    type="password" 
                    placeholder="Enter your password" 
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(""); // Clear error when typing
                    }} 
                    required 
                />
                <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => navigate("/forgot-password")}
                >
                    Forgot Password?
                </button>
                <button className="login-submit-btn" type="submit" disabled={loading} style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Logging in..." : "Login"}
                </button>
                <p className="login-footer">
                    <span>Don't have an account?</span>
                    <button
                        type="button"
                        className="register-link"
                        onClick={() => navigate("/register")}
                    >
                        Register here
                    </button>
                </p>
            </form>
        </div>
    );
}
export default Login;
