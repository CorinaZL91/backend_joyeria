import { z } from "zod";
export declare const createCategorySchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateCategorySchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=category.schemas.d.ts.map