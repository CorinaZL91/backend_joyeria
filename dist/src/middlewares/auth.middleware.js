import { verifyToken } from "../utils/jwt.js";
export const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Token no proporcionado" });
            return;
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            res.status(401).json({ message: "Token no proporcionado" });
            return;
        }
        const decoded = verifyToken(token);
        req.user = {
            userId: decoded.userId,
            rol: decoded.rol,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Token inválido o expirado" });
    }
};
//# sourceMappingURL=auth.middleware.js.map