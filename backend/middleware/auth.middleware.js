const { verifyToken } = require("../services/auth.service");

// Authentication middleware
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header is missing" });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
}

module.exports = authMiddleware;
