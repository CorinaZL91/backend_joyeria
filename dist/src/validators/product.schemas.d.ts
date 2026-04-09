import { z } from "zod";
export declare const createProductSchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodString;
    precio: z.ZodCoercedNumber<unknown>;
    material: z.ZodString;
    stock: z.ZodCoercedNumber<unknown>;
    stock_minimo: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    categoria_id: z.ZodCoercedNumber<unknown>;
    activo: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | undefined, unknown>, z.ZodBoolean>>;
}, z.core.$strip>;
export declare const updateProductSchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodString>;
    precio: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    material: z.ZodOptional<z.ZodString>;
    stock: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    stock_minimo: z.ZodOptional<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    categoria_id: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    activo: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | undefined, unknown>, z.ZodBoolean>>;
    removeImage: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | undefined, unknown>, z.ZodBoolean>>;
}, z.core.$strip>;
//# sourceMappingURL=product.schemas.d.ts.map