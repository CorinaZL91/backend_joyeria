import { z } from "zod";
export const createCategorySchema = z.object({
    nombre: z.string().trim().min(1, "El nombre de la categoría es obligatorio"),
    descripcion: z.string().trim().optional(),
});
export const updateCategorySchema = z.object({
    nombre: z.string().trim().optional(),
    descripcion: z.string().trim().optional(),
});
//# sourceMappingURL=category.schemas.js.map