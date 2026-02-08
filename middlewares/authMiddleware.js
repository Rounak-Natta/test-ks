import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

const authMiddleware = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No Token Provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);
      if (!user) return res.status(401).json({ success: false, message: "User Not Found" });

      // Role check
      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ success: false, message: "Access Forbidden: Insufficient Permissions" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      return res.status(401).json({ success: false, message: "Invalid or Expired Token" });
    }
  };
};

export default authMiddleware;
