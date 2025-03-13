// Basic role-based example. Extend as needed.
module.exports = (requiredRole) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(403).json({ message: 'No user context' });
    }
    // Example: if user name is "Superadmin" or user has certain role
    if (user.name === 'Superadmin') {
      return next();
    }
    // Fallback: user doesn't have the required role
    return res.status(403).json({ message: 'Forbidden: Insufficient role' });
  };
};
