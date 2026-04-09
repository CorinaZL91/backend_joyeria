import { z } from "zod";
const toNumber = (label) => z.coerce.number({
    message: `${label} debe ser numérico`,
});
const toBoolean = z.preprocess((value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "boolean")
        return value;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    return value;
}, z.boolean({ message: "Debe ser un valor booleano" }));
export const createProductSchema = z.object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio"),
    descripcion: z.string().trim().min(1, "La descripción es obligatoria"),
    precio: toNumber("El precio").positive("El precio debe ser mayor a 0"),
    material: z.string().trim().min(1, "El material es obligatorio"),
    stock: toNumber("El stock")
        .int("El stock debe ser entero")
        .min(0, "El stock no puede ser negativo"),
    stock_minimo: toNumber("El stock mínimo")
        .int("El stock mínimo debe ser entero")
        .min(0, "El stock mínimo no puede ser negativo")
        .optional(),
    categoria_id: toNumber("La categoría")
        .int("La categoría debe ser entera")
        .positive("La categoría es obligatoria"),
    activo: toBoolean.optional(),
});
export const updateProductSchema = createProductSchema
    .partial()
    .extend({
    activo: toBoolean.optional(),
    removeImage: toBoolean.optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
});
//# sourceMappingURL=product.schemas.js.map