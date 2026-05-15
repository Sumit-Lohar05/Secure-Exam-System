const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Get the token from the header
    // We are expecting a header like: "x-auth-token: eyJhbG..."
    const token = req.header('x-auth-token');

    // 2. Check if no token exists
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // 3. Verify the token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // Attach user payload to the request
        next(); // Move on to the next middleware or route handler
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};