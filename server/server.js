const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');
const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests from frontend
app.use(express.json()); // Parse incoming JSON payloads

// Basic health check route
app.get('/api/status', (req, res) => {
    res.json({ message: 'Secure Exam System API is running!' });
});

// API Routes
app.use('/api/auth', require('./auth'));
app.use('/api/exams', require('./exams'));

// Example of a Protected Route
app.get('/api/profile', authMiddleware, (req, res) => {
    res.json({ message: 'Welcome to your protected profile!', user: req.user });
});

// Admin-Only Route
app.get('/api/admin-dashboard', authMiddleware, adminMiddleware, (req, res) => {
    res.json({ message: 'Welcome Admin! You have special access.', user: req.user });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});