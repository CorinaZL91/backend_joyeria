import { Prisma } from "../../generated/prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/appError.js";
export const errorMiddleware = (error, _req, res, _next) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
        });
        return;
    }
    if (error instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Error de validación",
            errors: error.flatten(),
        });
        return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") {
        res.status(409).json({
            success: false,
            message: "Valor único duplicado",
        });
        return;
    }
    if (error instanceof Error) {
        console.error("Error no controlado:", error);
    }
    else {
        console.error("Error no controlado:", error);
    }
    res.status(500).json({
        success: false,
        message: "Error interno del servidor",
    });
};
//# sourceMappingURL=error.middleware.js.map