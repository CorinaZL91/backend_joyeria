import { z } from "zod";

export const addToCartSchema = z.object({
  producto_id: z.coerce
    .number()
    .int()
    .positive("El ID del producto debe ser válido"),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});

export const cartItemParamsSchema = z.object({
  producto_id: z.coerce
    .number()
    .int()
    .positive("El ID del producto debe ser válido"),
});

export const updateCartItemQuantityBodySchema = z.object({
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});
