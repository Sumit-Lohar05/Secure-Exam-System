const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
        },
        role: {
            type: String,
            enum: ['student', 'admin'],
            default: 'student',
        },
        // Add these inside your UserSchema object:
        isVerified: {
            type: Boolean,
            default: false
        },
        verificationOtp: {
            type: String,
        },
        verificationOtpExpire: {
            type: Date,
        },
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    { timestamps: true }
);

// TTL index to automatically delete unverified users after 12 hours
userSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 43200, // 12 hours in seconds
        partialFilterExpression: { isVerified: false }
    }
);

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function () {
    // Generate raw token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field (to prevent database leaks from exposing active tokens)
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set expiration to 10 minutes from now
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

module.exports = mongoose.model('User', userSchema);