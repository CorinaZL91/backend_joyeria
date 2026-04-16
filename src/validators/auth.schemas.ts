import { z } from "zod";

export const registerSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),

  correo: z.string().trim().email("El correo no tiene un formato válido"),

  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),

  telefono: z
    .string()
    .trim()
    .min(1, "El teléfono es obligatorio")
    .min(10, "El teléfono debe tener al menos 10 caracteres")
    .max(20, "El teléfono no puede exceder 20 caracteres"),
});

export const loginSchema = z.object({
  correo: z.string().trim().email("El correo no tiene un formato válido"),

  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
