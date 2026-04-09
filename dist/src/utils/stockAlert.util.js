import { prisma } from "../config/prisma.js";
export const syncStockAlert = async (productoId) => {
    const product = await prisma.producto.findUnique({
        where: { id: productoId },
    });
    if (!product) {
        return;
    }
    const shouldAlert = product.stock <= product.stock_minimo;
    const existingAlert = await prisma.alertaStock.findFirst({
        where: {
            producto_id: productoId,
            activa: true,
        },
    });
    if (shouldAlert) {
        const mensaje = `El producto "${product.nombre}" tiene stock bajo (${product.stock} unidades disponibles).`;
        if (existingAlert) {
            await prisma.alertaStock.update({
                where: { id: existingAlert.id },
                data: {
                    stock_minimo: product.stock_minimo,
                    mensaje,
                    activa: true,
                },
            });
        }
        else {
            await prisma.alertaStock.create({
                data: {
                    producto_id: productoId,
                    stock_minimo: product.stock_minimo,
                    mensaje,
                    activa: true,
                },
            });
        }
    }
    else {
        if (existingAlert) {
            await prisma.alertaStock.update({
                where: { id: existingAlert.id },
                data: {
                    activa: false,
                },
            });
        }
    }
};
//# sourceMappingURL=stockAlert.util.js.map