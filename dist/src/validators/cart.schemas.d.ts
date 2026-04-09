import { z } from "zod";
export declare const addToCartSchema: z.ZodObject<{
    producto_id: z.ZodCoercedNumber<unknown>;
    cantidad: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const cartItemParamsSchema: z.ZodObject<{
    producto_id: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const updateCartItemQuantityBodySchema: z.ZodObject<{
    cantidad: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
//# sourceMappingURL=cart.schemas.d.ts.map