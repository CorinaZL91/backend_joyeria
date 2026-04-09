import { z } from "zod";
export declare const registerSchema: z.ZodObject<{
    nombre: z.ZodString;
    correo: z.ZodString;
    password: z.ZodString;
    telefono: z.ZodOptional<z.ZodString>;
    direccion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    correo: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=auth.schemas.d.ts.map