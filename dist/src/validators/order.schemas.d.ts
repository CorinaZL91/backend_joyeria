import { z } from "zod";
export declare const createOrderSchema: z.ZodObject<{
    metodo_pago: z.ZodEnum<{
        tarjeta: "tarjeta";
        tienda: "tienda";
    }>;
}, z.core.$strip>;
export declare const updateOrderStatusSchema: z.ZodObject<{
    estado: z.ZodEnum<{
        pendiente: "pendiente";
        en_preparacion: "en_preparacion";
        enviado: "enviado";
        entregado: "entregado";
        cancelado: "cancelado";
    }>;
}, z.core.$strip>;
//# sourceMappingURL=order.schemas.d.ts.map