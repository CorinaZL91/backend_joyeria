import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

export const getCart = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const cartItems = await prisma.carrito.findMany({
      where: {
        usuario_id: req.user.userId,
      },
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    const formattedItems = cartItems.map((item) => {
      const subtotal = Number(item.producto.precio) * item.cantidad;

      return {
        ...item,
        subtotal,
      };
    });

    const total = formattedItems.reduce((acc, item) => acc + item.subtotal, 0);

    res.status(200).json({
      success: true,
      data: {
        items: formattedItems,
        total,
      },
    });
  }
);

export const addToCart = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const productId = Number(req.body.producto_id);
    const quantity = Number(req.body.cantidad);

    if (Number.isNaN(productId) || productId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new AppError("La cantidad debe ser mayor a 0", 400);
    }

    const product = await prisma.producto.findUnique({
      where: { id: productId },
    });

    if (!product || !product.activo) {
      throw new AppError("Producto no encontrado o inactivo", 404);
    }

    if (product.stock <= 0) {
      throw new AppError("Producto sin stock", 400);
    }

    const existingCartItem = await prisma.carrito.findUnique({
      where: {
        usuario_id_producto_id: {
          usuario_id: req.user.userId,
          producto_id: productId,
        },
      },
    });

    const newQuantity = existingCartItem
      ? existingCartItem.cantidad + quantity
      : quantity;

    if (newQuantity > product.stock) {
      throw new AppError(
        `La cantidad solicitada excede el stock disponible. Solo hay ${product.stock} pieza(s).`,
        400
      );
    }

    const cartItem = existingCartItem
      ? await prisma.carrito.update({
          where: {
            usuario_id_producto_id: {
              usuario_id: req.user.userId,
              producto_id: productId,
            },
          },
          data: {
            cantidad: newQuantity,
          },
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
          },
        })
      : await prisma.carrito.create({
          data: {
            usuario_id: req.user.userId,
            producto_id: productId,
            cantidad: quantity,
          },
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
          },
        });

    res.status(existingCartItem ? 200 : 201).json({
      success: true,
      message: existingCartItem
        ? "Cantidad actualizada en el carrito"
        : "Producto agregado al carrito correctamente",
      data: cartItem,
    });
  }
);

export const updateCartItemQuantity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const productoId = Number(req.params.producto_id);
    const quantity = Number(req.body.cantidad);

    if (Number.isNaN(productoId) || productoId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new AppError("La cantidad debe ser mayor a 0", 400);
    }

    const cartItem = await prisma.carrito.findUnique({
      where: {
        usuario_id_producto_id: {
          usuario_id: req.user.userId,
          producto_id: productoId,
        },
      },
      include: {
        producto: true,
      },
    });

    if (!cartItem) {
      throw new AppError("Producto no encontrado en el carrito", 404);
    }

    if (quantity > cartItem.producto.stock) {
      throw new AppError(
        `La cantidad solicitada excede el stock disponible. Solo hay ${cartItem.producto.stock} pieza(s).`,
        400
      );
    }

    const updatedCartItem = await prisma.carrito.update({
      where: {
        usuario_id_producto_id: {
          usuario_id: req.user.userId,
          producto_id: productoId,
        },
      },
      data: {
        cantidad: quantity,
      },
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Cantidad actualizada correctamente",
      data: updatedCartItem,
    });
  }
);

export const removeCartItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const productoId = Number(req.params.producto_id);

    if (Number.isNaN(productoId) || productoId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    const cartItem = await prisma.carrito.findUnique({
      where: {
        usuario_id_producto_id: {
          usuario_id: req.user.userId,
          producto_id: productoId,
        },
      },
    });

    if (!cartItem) {
      throw new AppError("Producto no encontrado en el carrito", 404);
    }

    await prisma.carrito.delete({
      where: {
        usuario_id_producto_id: {
          usuario_id: req.user.userId,
          producto_id: productoId,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Producto eliminado del carrito correctamente",
    });
  }
);

export const clearCart = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    await prisma.carrito.deleteMany({
      where: {
        usuario_id: req.user.userId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Carrito vaciado correctamente",
    });
  }
);
