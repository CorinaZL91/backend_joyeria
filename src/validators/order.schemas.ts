import { z } from "zod";

export const createOrderSchema = z.object({
  metodo_pago: z.enum(["tarjeta", "tienda"], {
    message: "El método de pago debe ser 'tarjeta' o 'tienda'",
  }),
});

export const updateOrderStatusSchema = z.object({
  estado: z.enum(
    ["pendiente", "en_preparacion", "enviado", "entregado", "cancelado"],
    {
      message:
        "Estado inválido. Usa: pendiente, en_preparacion, enviado, entregado o cancelado",
    }
  ),
});
