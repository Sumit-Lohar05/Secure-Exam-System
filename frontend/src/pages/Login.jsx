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
                <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(""); // Clear error when typing
                    }} 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(""); // Clear error when typing
                    }} 
                    required 
                />
               <p 
                    className="forgot-password-link" 
                    onClick={() => navigate("/forgot-password")}
                    style={{ textAlign: "right", marginTop: "-10px", marginBottom: "15px", cursor: "pointer", color: "#3498db", fontSize: "0.9rem" }}
                >
                    Forgot Password?
                </p>
                <button type="submit" disabled={loading} style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Logging in..." : "Login"}
                </button>
                <p 
                    className="register-link" 
                    onClick={() => navigate("/register")}
                    style={{ marginTop: "15px", cursor: "pointer", color: "#3498db" }}
                >
                    Don't have an account? Register here
                </p>
            </form>
        </div>
    );
}
export default Login;
