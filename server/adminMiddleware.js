module.exports = function (req, res, next) {
    // Ensure the user exists (meaning authMiddleware must be called first)
    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if the user role is 'admin'
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    next();
};
