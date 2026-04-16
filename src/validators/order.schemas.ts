import { z } from "zod";

export const createOrderSchema = z
  .object({
    metodo_pago: z.enum(["tarjeta", "tienda"], {
      message: "El método de pago debe ser 'tarjeta' o 'tienda'",
    }),

    direccion_calle: z
      .string()
      .trim()
      .min(1, "La calle es obligatoria")
      .optional(),

    direccion_ciudad: z
      .string()
      .trim()
      .min(1, "La ciudad es obligatoria")
      .optional(),

    direccion_codigo_postal: z
      .string()
      .trim()
      .min(4, "Código postal inválido")
      .max(10, "Código postal demasiado largo")
      .optional(),
  })
  .refine(
    (data) => {
      // 🔥 si es tarjeta → dirección obligatoria
      if (data.metodo_pago === "tarjeta") {
        return (
          data.direccion_calle &&
          data.direccion_ciudad &&
          data.direccion_codigo_postal
        );
      }
      return true;
    },
    {
      message: "Debes proporcionar dirección completa para pagos con tarjeta",
      path: ["direccion_calle"],
    }
  );

export const updateOrderStatusSchema = z.object({
  estado: z.enum(
    ["pendiente", "en_preparacion", "enviado", "entregado", "cancelado"],
    {
      message:
        "Estado inválido. Usa: pendiente, en_preparacion, enviado, entregado o cancelado",
    }
  ),
});
