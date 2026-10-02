const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('./User');
const sendEmail = require('./utils/sendEmail');

const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');

const serializeAdminUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

const createRateLimiter = ({ windowMs = 60000, maxRequests = 5, keyBuilder } = {}) => {
    const store = new Map();

    return {
        allow(req) {
            const key = keyBuilder ? keyBuilder(req) : (req.ip || req.headers['x-forwarded-for'] || 'unknown');
            const now = Date.now();
            const current = store.get(key);

            if (!current || current.resetAt <= now) {
                store.set(key, { count: 1, resetAt: now + windowMs });
                return true;
            }

            if (current.count >= maxRequests) {
                return false;
            }

            current.count += 1;
            return true;
        }
    };
};

const getRequiredEnv = (name) => {
    const value = process.env[name];
    if (!value || !String(value).trim()) {
        throw new Error(`${name} is not configured.`);
    }
    return value.replace(/\/$/, '');
};

const getFrontendUrl = () => getRequiredEnv('FRONTEND_URL');
const buildResetUrl = (token) => `${getFrontendUrl()}/reset-password/${token}`;

const router = express.Router();
const ipRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 });
const emailRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 3,
    keyBuilder: (req) => `email:${String(req.body?.email || '').trim().toLowerCase()}`
});
const resetRequestLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyBuilder: (req) => `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`
});

const enforceAuthRateLimit = (req, res) => {
    const ipAllowed = ipRateLimiter.allow(req);
    const emailAllowed = emailRateLimiter.allow(req);

    if (!ipAllowed || !emailAllowed) {
        res.status(429).json({ message: 'Too many attempts. Please try again later.' });
        return false;
    }

    return true;
};

// @route   GET /api/auth/users
// @desc    Get all users (Admins Only)
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find()
            .select('name email role isVerified createdAt updatedAt')
            .sort({ createdAt: -1 });
        res.json(users.map(serializeAdminUser));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/auth/users/:id/role
// @desc    Update user role (Admins Only)
router.put('/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['student', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.role = role;
        await user.save();
        res.json({ message: 'User role updated successfully', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete a user (Admins Only)
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
    try {
        if (!enforceAuthRateLimit(req, res)) {
            return;
        }

        const { name, email, password, role, adminSecret } = req.body;

        // Security Check: Require a valid secret key to register as an admin
        if (role === 'admin') {
            if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
                return res.status(403).json({ message: 'Invalid or missing Admin Secret Key.' });
            }
        }

        // 1. Check if user already exists and is verified
        let user = await User.findOne({ email });
        if (user && user.isVerified) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        // If user exists but is not verified, they will be updated.
        // If user does not exist, they will be created.

        if (!user) {
            user = new User({ email }); // Create new user instance
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        // Update or set user properties
        user.name = name;
        user.password = hashedPassword;
        user.role = role;
        user.verificationOtp = hashedOtp;
        user.verificationOtpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        user.isVerified = false; // Ensure this is false for re-registrations

        await user.save();

        // 5. Send Verification Email
        const message = `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <h2>Verify Your Email Address</h2>
                    <p>Thank you for registering for SecureExam!</p>
                    <p>Your One-Time Password (OTP) to activate your account is:</p>
                    <h3 style="background: #f0f2f5; padding: 10px 20px; text-align: center; letter-spacing: 2px; border-radius: 5px;">${otp}</h3>
                    <p>This OTP is valid for 10 minutes.</p>
                    <p>If you did not register for this account, please ignore this email.</p>
                </div>
            `;

        try {
            await sendEmail({ email: user.email, subject: 'SecureExam - Verify your Email', message });
            res.status(201).json({ message: 'Registration successful! Please check your email for the OTP to verify your account.' });
        } catch (emailErr) {
            console.error("Email sending failed:", emailErr.message);
            // Don't delete user, just fail. They can try to register again.
            return res.status(500).json({ message: 'Failed to send verification email. Please try registering again later.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP to unverified user
router.post('/resend-otp', async (req, res) => {
    try {
        if (!enforceAuthRateLimit(req, res)) {
            return;
        }

        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.isVerified) {
            return res.status(400).json({ message: 'User is already verified. You can log in.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        user.verificationOtp = hashedOtp;
        user.verificationOtpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        const message = `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2>Verify Your Email Address</h2>
                <p>Your new One-Time Password (OTP) to activate your account is:</p>
                <h3 style="background: #f0f2f5; padding: 10px 20px; text-align: center; letter-spacing: 2px; border-radius: 5px;">${otp}</h3>
                <p>This OTP is valid for 10 minutes.</p>
            </div>
        `;

        await sendEmail({ email: user.email, subject: 'SecureExam - Your New OTP', message });
        res.status(200).json({ message: 'A new OTP has been sent to your email.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify user email with OTP
router.post('/verify-otp', async (req, res) => {
    try {
        if (!enforceAuthRateLimit(req, res)) {
            return;
        }

        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Please provide email and OTP.' });
        }

        // Hash the incoming OTP to compare with the stored one
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        const user = await User.findOne({
            email,
            verificationOtp: hashedOtp,
            verificationOtpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP or OTP has expired.' });
        }

        user.isVerified = true;
        user.verificationOtp = undefined;
        user.verificationOtpExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Email successfully verified. You can now log in.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    try {
        if (!enforceAuthRateLimit(req, res)) {
            return;
        }

        const { email, password } = req.body;

        // 1. Check if user exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not registered.' });
        }

        // 2. Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password.' });
        }

        // 3. Prevent login if email is not verified
        if (!user.isVerified) {
            return res.status(403).json({ message: 'Please verify your email address before logging in. Check your inbox.' });
        }

        // 4. Create JWT payload
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // 4. Sign and return the token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
router.post('/forgot-password', async (req, res) => {
    try {
        if (!resetRequestLimiter.allow(req)) {
            return res.status(429).json({ message: 'Too many password reset requests. Please try again later.' });
        }

        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(200).json({ message: 'If this email is registered, a password reset link will be sent.' });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();
        
        // Save the hashed token and expiration to the database
        await user.save({ validateBeforeSave: false });

        // Create reset URL from the configured frontend origin.
        const resetUrl = buildResetUrl(resetToken);

        const message = `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2>Password Reset Request</h2>
                <p>You are receiving this email because you (or someone else) requested a password reset for your SecureExam account.</p>
                <p>Please click the button below to set a new password:</p>
                <a href="${resetUrl}" style="display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <p style="color: #e74c3c; font-size: 0.9em;"><strong>Note:</strong> This link is only valid for 10 minutes.</p>
            </div>
        `;

        try {
            await sendEmail({ email: user.email, subject: 'SecureExam Password Reset', message });
            res.status(200).json({ message: 'If this email is registered, a password reset link will be sent.' });
        } catch (err) {
            console.error('Password reset email failed:', err.message);
            // If the email fails to send, clear the token from the DB so it can't be exploited
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/auth/reset-password/:token
// @desc    Verify token and reset password
router.put('/reset-password/:token', async (req, res) => {
    try {
        if (!resetRequestLimiter.allow(req)) {
            return res.status(429).json({ message: 'Too many reset attempts. Please try again later.' });
        }

        // Re-hash the raw token from the URL to compare it with the hashed token in the database
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        // Hash the new password and clear the tokens
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful! You can now log in.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.createRateLimiter = createRateLimiter;
router.buildResetUrl = buildResetUrl;
router.getApiBaseUrl = () => getRequiredEnv('API_BASE_URL');

module.exports = router;
module.exports.serializeAdminUser = serializeAdminUser;