import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = ({ allowedRole }) => {
    const token = localStorage.getItem("token");
    const userString = localStorage.getItem("user");
    let user = null;

    if (userString) {
        try {
            user = JSON.parse(userString);
        } catch (err) {
            console.error("Error parsing user data:", err);
        }
    }

    // 1. If there's no token, redirect to the login page
    if (!token) {
        return <Navigate to="/" replace />;
    }

    // 2. If a specific role is required (like 'admin') and the user doesn't match, redirect them
    if (allowedRole && user?.role !== allowedRole) {
        return <Navigate to={user?.role === "admin" ? "/admin/dashboard" : "/dashboard"} replace />;
    }

    // 3. If authenticated and authorized, render the child routes
    return <Outlet />;
};

export default ProtectedRoute;