import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

const parseOptionalTallaId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (Number.isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError("producto_talla_id inválido", 400);
  }

  return parsed;
};

const formatCartItem = (item: any) => {
  const subtotal = Number(item.producto.precio) * item.cantidad;

  return {
    ...item,
    producto_talla: item.productoTalla ?? null,
    subtotal,
  };
};

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
        productoTalla: true,
      },
      orderBy: {
        id: "desc",
      },
    });

    const formattedItems = cartItems.map(formatCartItem);

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

    const usuarioId = req.user.userId;
    const productoId = Number(req.body.producto_id);
    const cantidad = Number(req.body.cantidad);
    const productoTallaId = parseOptionalTallaId(req.body.producto_talla_id);

    if (Number.isNaN(productoId) || productoId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    if (
      Number.isNaN(cantidad) ||
      cantidad <= 0 ||
      !Number.isInteger(cantidad)
    ) {
      throw new AppError("La cantidad debe ser un entero mayor a 0", 400);
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        tallas: true,
      },
    });

    if (!producto || !producto.activo) {
      throw new AppError("Producto no encontrado o inactivo", 404);
    }

    let stockDisponible = 0;

    if (producto.usar_tallas) {
      if (productoTallaId === null) {
        throw new AppError("Debes seleccionar una talla", 400);
      }

      const talla = producto.tallas.find(
        (item) => item.id === productoTallaId && item.activo
      );

      if (!talla) {
        throw new AppError("Talla no válida", 400);
      }

      if (talla.stock <= 0) {
        throw new AppError("Esa talla no tiene stock disponible", 400);
      }

      stockDisponible = talla.stock;
    } else {
      if (productoTallaId !== null) {
        throw new AppError(
          "Este producto no usa tallas, no debes enviar producto_talla_id",
          400
        );
      }

      if (producto.stock === null || producto.stock <= 0) {
        throw new AppError("Producto sin stock", 400);
      }

      stockDisponible = producto.stock;
    }

    const existingCartItem =
      productoTallaId !== null
        ? await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: productoTallaId,
            },
          })
        : await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: null,
            },
          });

    const nuevaCantidad = existingCartItem
      ? existingCartItem.cantidad + cantidad
      : cantidad;

    if (nuevaCantidad > stockDisponible) {
      throw new AppError(
        `La cantidad solicitada excede el stock disponible. Solo hay ${stockDisponible} pieza(s).`,
        400
      );
    }

    const cartItem = existingCartItem
      ? await prisma.carrito.update({
          where: {
            id: existingCartItem.id,
          },
          data: {
            cantidad: nuevaCantidad,
          },
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
            productoTalla: true,
          },
        })
      : await prisma.carrito.create({
          data: {
            usuario_id: usuarioId,
            producto_id: productoId,
            ...(productoTallaId !== null
              ? { producto_talla_id: productoTallaId }
              : {}),
            cantidad,
          },
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
            productoTalla: true,
          },
        });

    res.status(existingCartItem ? 200 : 201).json({
      success: true,
      message: existingCartItem
        ? "Cantidad actualizada en el carrito"
        : "Producto agregado al carrito correctamente",
      data: formatCartItem(cartItem),
    });
  }
);

export const updateCartItemQuantity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const usuarioId = req.user.userId;
    const productoId = Number(req.params.producto_id);
    const cantidad = Number(req.body.cantidad);
    const productoTallaId = parseOptionalTallaId(req.body.producto_talla_id);

    if (Number.isNaN(productoId) || productoId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    if (
      Number.isNaN(cantidad) ||
      cantidad <= 0 ||
      !Number.isInteger(cantidad)
    ) {
      throw new AppError("La cantidad debe ser un entero mayor a 0", 400);
    }

    const cartItem =
      productoTallaId !== null
        ? await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: productoTallaId,
            },
            include: {
              producto: {
                include: {
                  tallas: true,
                  categoria: true,
                },
              },
              productoTalla: true,
            },
          })
        : await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: null,
            },
            include: {
              producto: {
                include: {
                  tallas: true,
                  categoria: true,
                },
              },
              productoTalla: true,
            },
          });

    if (!cartItem) {
      throw new AppError("Producto no encontrado en el carrito", 404);
    }

    let stockDisponible = 0;

    if (cartItem.producto.usar_tallas) {
      if (!cartItem.productoTalla || !cartItem.productoTalla.activo) {
        throw new AppError("La talla seleccionada ya no está disponible", 400);
      }

      stockDisponible = cartItem.productoTalla.stock;
    } else {
      if (cartItem.producto.stock === null || cartItem.producto.stock <= 0) {
        throw new AppError("Producto sin stock disponible", 400);
      }

      stockDisponible = cartItem.producto.stock;
    }

    if (cantidad > stockDisponible) {
      throw new AppError(
        `La cantidad solicitada excede el stock disponible. Solo hay ${stockDisponible} pieza(s).`,
        400
      );
    }

    const updatedCartItem = await prisma.carrito.update({
      where: {
        id: cartItem.id,
      },
      data: {
        cantidad,
      },
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
        productoTalla: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Cantidad actualizada correctamente",
      data: formatCartItem(updatedCartItem),
    });
  }
);

export const removeCartItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const usuarioId = req.user.userId;
    const productoId = Number(req.params.producto_id);
    const productoTallaId = parseOptionalTallaId(req.body.producto_talla_id);

    if (Number.isNaN(productoId) || productoId <= 0) {
      throw new AppError("producto_id inválido", 400);
    }

    const cartItem =
      productoTallaId !== null
        ? await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: productoTallaId,
            },
          })
        : await prisma.carrito.findFirst({
            where: {
              usuario_id: usuarioId,
              producto_id: productoId,
              producto_talla_id: null,
            },
          });

    if (!cartItem) {
      throw new AppError("Producto no encontrado en el carrito", 404);
    }

    await prisma.carrito.delete({
      where: {
        id: cartItem.id,
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
