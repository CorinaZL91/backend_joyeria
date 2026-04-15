import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { syncStockAlert } from "../utils/stockAlert.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import {
  EstadoPedido,
  MetodoPago,
  RolUsuario,
} from "../../generated/prisma/client.js";

const userSelect = {
  id: true,
  nombre: true,
  correo: true,
  telefono: true,
  direccion: true,
};

const roundToTwo = (value: number): number => {
  return Number(value.toFixed(2));
};

const formatOrderDetail = (detail: any) => ({
  ...detail,
  producto_talla: detail.productoTalla ?? null,
});

const formatOrder = (order: any) => ({
  ...order,
  detalles: order.detalles?.map(formatOrderDetail) ?? [],
});

export const createOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const { metodo_pago } = req.body as { metodo_pago: MetodoPago };

    const cartItems = await prisma.carrito.findMany({
      where: {
        usuario_id: req.user.userId,
      },
      include: {
        producto: {
          include: {
            tallas: true,
          },
        },
        productoTalla: true,
      },
    });

    if (cartItems.length === 0) {
      throw new AppError("El carrito está vacío", 400);
    }

    for (const item of cartItems) {
      const producto = item.producto;

      if (!producto) {
        throw new AppError(
          "Uno de los productos del carrito ya no existe",
          400
        );
      }

      if (!producto.activo) {
        throw new AppError(
          `El producto "${producto.nombre}" no está disponible`,
          400
        );
      }

      if (item.cantidad <= 0) {
        throw new AppError(`Cantidad inválida para "${producto.nombre}"`, 400);
      }

      if (producto.usar_tallas) {
        if (!item.producto_talla_id || !item.productoTalla) {
          throw new AppError(
            `Debes seleccionar una talla válida para "${producto.nombre}"`,
            400
          );
        }

        if (!item.productoTalla.activo) {
          throw new AppError(
            `La talla "${item.productoTalla.talla}" de "${producto.nombre}" ya no está disponible`,
            400
          );
        }

        if (item.productoTalla.producto_id !== producto.id) {
          throw new AppError(
            `La talla seleccionada no pertenece al producto "${producto.nombre}"`,
            400
          );
        }

        if (item.cantidad > item.productoTalla.stock) {
          throw new AppError(
            `Stock insuficiente para "${producto.nombre}" en talla "${item.productoTalla.talla}"`,
            400
          );
        }
      } else {
        if (item.producto_talla_id !== null) {
          throw new AppError(
            `El producto "${producto.nombre}" no debería tener talla asociada en el carrito`,
            400
          );
        }

        if (producto.stock === null || item.cantidad > producto.stock) {
          throw new AppError(
            `Stock insuficiente para "${producto.nombre}"`,
            400
          );
        }
      }
    }

    const subtotal = roundToTwo(
      cartItems.reduce((acc, item) => {
        return acc + Number(item.producto.precio) * item.cantidad;
      }, 0)
    );

    const iva = roundToTwo(subtotal * 0.16);
    const total = roundToTwo(subtotal + iva);

    const newOrder = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.pedido.create({
        data: {
          usuario_id: req.user!.userId,
          total,
          metodo_pago,
          estado: EstadoPedido.pendiente,
        },
      });

      for (const item of cartItems) {
        const productoActual = await tx.producto.findUnique({
          where: {
            id: item.producto_id,
          },
        });

        if (!productoActual) {
          throw new AppError(
            `El producto con ID ${item.producto_id} ya no existe durante el procesamiento del pedido`,
            400
          );
        }

        if (!productoActual.activo) {
          throw new AppError(
            `El producto "${productoActual.nombre}" ya no está disponible`,
            400
          );
        }

        let tallaActual = null as null | {
          id: number;
          talla: string;
          stock: number;
          activo: boolean;
          producto_id: number;
        };

        if (productoActual.usar_tallas) {
          if (!item.producto_talla_id) {
            throw new AppError(
              `Debes seleccionar una talla válida para "${productoActual.nombre}"`,
              400
            );
          }

          tallaActual = await tx.productoTalla.findUnique({
            where: {
              id: item.producto_talla_id,
            },
          });

          if (!tallaActual || !tallaActual.activo) {
            throw new AppError(
              `La talla seleccionada para "${productoActual.nombre}" ya no está disponible`,
              400
            );
          }

          if (tallaActual.producto_id !== productoActual.id) {
            throw new AppError(
              `La talla seleccionada no pertenece al producto "${productoActual.nombre}"`,
              400
            );
          }

          if (tallaActual.stock < item.cantidad) {
            throw new AppError(
              `Stock insuficiente para "${productoActual.nombre}" en talla "${tallaActual.talla}" durante el procesamiento del pedido`,
              400
            );
          }
        } else {
          if (
            productoActual.stock === null ||
            productoActual.stock < item.cantidad
          ) {
            throw new AppError(
              `Stock insuficiente para "${productoActual.nombre}" durante el procesamiento del pedido`,
              400
            );
          }
        }

        const precioUnitario = roundToTwo(Number(productoActual.precio));
        const subtotalDetalle = roundToTwo(precioUnitario * item.cantidad);

        await tx.detallePedido.create({
          data: {
            pedido_id: createdOrder.id,
            producto_id: item.producto_id,
            ...(item.producto_talla_id !== null
              ? { producto_talla_id: item.producto_talla_id }
              : {}),
            talla: productoActual.usar_tallas
              ? tallaActual?.talla ?? null
              : null,
            cantidad: item.cantidad,
            precio_unitario: precioUnitario,
            subtotal: subtotalDetalle,
          },
        });

        if (productoActual.usar_tallas) {
          await tx.productoTalla.update({
            where: {
              id: item.producto_talla_id!,
            },
            data: {
              stock: {
                decrement: item.cantidad,
              },
            },
          });
        } else {
          await tx.producto.update({
            where: {
              id: item.producto_id,
            },
            data: {
              stock: {
                decrement: item.cantidad,
              },
            },
          });
        }
      }

      await tx.carrito.deleteMany({
        where: {
          usuario_id: req.user!.userId,
        },
      });

      return createdOrder;
    });

    for (const item of cartItems) {
      await syncStockAlert(item.producto_id);
    }

    const createdOrderWithRelations = await prisma.pedido.findUnique({
      where: { id: newOrder.id },
      include: {
        usuario: {
          select: userSelect,
        },
        detalles: {
          include: {
            producto: true,
            productoTalla: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Pedido creado correctamente",
      data: createdOrderWithRelations
        ? formatOrder(createdOrderWithRelations)
        : null,
    });
  }
);

export const getMyOrders = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const orders = await prisma.pedido.findMany({
      where: {
        usuario_id: req.user.userId,
      },
      include: {
        usuario: {
          select: userSelect,
        },
        detalles: {
          include: {
            producto: true,
            productoTalla: true,
          },
        },
      },
      orderBy: {
        fecha_pedido: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: orders.map(formatOrder),
    });
  }
);

export const getAllOrders = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const orders = await prisma.pedido.findMany({
      include: {
        usuario: {
          select: userSelect,
        },
        detalles: {
          include: {
            producto: true,
            productoTalla: true,
          },
        },
      },
      orderBy: {
        fecha_pedido: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: orders.map(formatOrder),
    });
  }
);

export const getOrderById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de pedido inválido", 400);
    }

    const order = await prisma.pedido.findUnique({
      where: { id },
      include: {
        usuario: {
          select: userSelect,
        },
        detalles: {
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
            productoTalla: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError("Pedido no encontrado", 404);
    }

    const isOwner = order.usuario_id === req.user.userId;
    const isAdmin = req.user.rol === RolUsuario.administrador;

    if (!isOwner && !isAdmin) {
      throw new AppError("No autorizado para ver este pedido", 403);
    }

    res.status(200).json({
      success: true,
      data: formatOrder(order),
    });
  }
);

export const cancelOrder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de pedido inválido", 400);
    }

    const order = await prisma.pedido.findUnique({
      where: { id },
      include: {
        detalles: true,
      },
    });

    if (!order) {
      throw new AppError("Pedido no encontrado", 404);
    }

    if (order.usuario_id !== req.user.userId) {
      throw new AppError("No autorizado para cancelar este pedido", 403);
    }

    if (order.estado !== EstadoPedido.pendiente) {
      throw new AppError(
        "Solo se pueden cancelar pedidos en estado pendiente",
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          estado: EstadoPedido.cancelado,
        },
      });

      for (const detalle of order.detalles) {
        if (detalle.producto_talla_id !== null) {
          await tx.productoTalla.update({
            where: {
              id: detalle.producto_talla_id,
            },
            data: {
              stock: {
                increment: detalle.cantidad,
              },
            },
          });
        } else {
          await tx.producto.update({
            where: {
              id: detalle.producto_id,
            },
            data: {
              stock: {
                increment: detalle.cantidad,
              },
            },
          });
        }
      }
    });

    for (const detalle of order.detalles) {
      await syncStockAlert(detalle.producto_id);
    }

    res.status(200).json({
      success: true,
      message: "Pedido cancelado correctamente",
    });
  }
);

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const { estado } = req.body as { estado: EstadoPedido };

    if (Number.isNaN(id)) {
      throw new AppError("ID de pedido inválido", 400);
    }

    const order = await prisma.pedido.findUnique({
      where: { id },
      include: {
        detalles: true,
      },
    });

    if (!order) {
      throw new AppError("Pedido no encontrado", 404);
    }

    if (order.estado === EstadoPedido.cancelado) {
      throw new AppError(
        "No se puede cambiar el estado de un pedido cancelado",
        400
      );
    }

    if (order.estado === EstadoPedido.entregado) {
      throw new AppError(
        "No se puede cambiar el estado de un pedido entregado",
        400
      );
    }

    if (
      estado === EstadoPedido.cancelado &&
      order.estado !== EstadoPedido.pendiente
    ) {
      throw new AppError("Solo se puede cancelar desde estado pendiente", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          estado,
        },
      });

      if (estado === EstadoPedido.cancelado) {
        for (const detalle of order.detalles) {
          if (detalle.producto_talla_id !== null) {
            await tx.productoTalla.update({
              where: {
                id: detalle.producto_talla_id,
              },
              data: {
                stock: {
                  increment: detalle.cantidad,
                },
              },
            });
          } else {
            await tx.producto.update({
              where: {
                id: detalle.producto_id,
              },
              data: {
                stock: {
                  increment: detalle.cantidad,
                },
              },
            });
          }
        }
      }
    });

    if (estado === EstadoPedido.cancelado) {
      for (const detalle of order.detalles) {
        await syncStockAlert(detalle.producto_id);
      }
    }

    const updatedOrder = await prisma.pedido.findUnique({
      where: { id },
      include: {
        usuario: {
          select: userSelect,
        },
        detalles: {
          include: {
            producto: true,
            productoTalla: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Estado del pedido actualizado correctamente",
      data: updatedOrder ? formatOrder(updatedOrder) : null,
    });
  }
);
