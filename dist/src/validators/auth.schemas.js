import { z } from "zod";
export const registerSchema = z.object({
    nombre: z
        .string()
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres"),
    correo: z.string().trim().email("El correo no tiene un formato válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    telefono: z.string().trim().optional(),
    direccion: z.string().trim().optional(),
});
export const loginSchema = z.object({
    correo: z.string().trim().email("El correo no tiene un formato válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
//# sourceMappingURL=auth.schemas.js.map