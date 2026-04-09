import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

export const getCategories = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const categories = await prisma.categoria.findMany({
      orderBy: {
        nombre: "asc",
      },
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  }
);

export const getCategoryById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de categoría inválido", 400);
    }

    const category = await prisma.categoria.findUnique({
      where: { id },
      include: {
        productos: true,
      },
    });

    if (!category) {
      throw new AppError("Categoría no encontrada", 404);
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  }
);

export const createCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { nombre, descripcion } = req.body;

    const trimmedNombre = nombre.trim();

    const existingCategory = await prisma.categoria.findUnique({
      where: {
        nombre: trimmedNombre,
      },
    });

    if (existingCategory) {
      throw new AppError("La categoría ya existe", 409);
    }

    const newCategory = await prisma.categoria.create({
      data: {
        nombre: trimmedNombre,
        descripcion: descripcion?.trim() || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Categoría creada correctamente",
      data: newCategory,
    });
  }
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const { nombre, descripcion } = req.body;

    if (Number.isNaN(id)) {
      throw new AppError("ID de categoría inválido", 400);
    }

    const category = await prisma.categoria.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError("Categoría no encontrada", 404);
    }

    const data: { nombre?: string; descripcion?: string | null } = {};

    if (nombre !== undefined) {
      const trimmedNombre = nombre.trim();

      const duplicateCategory = await prisma.categoria.findFirst({
        where: {
          nombre: trimmedNombre,
          NOT: {
            id,
          },
        },
      });

      if (duplicateCategory) {
        throw new AppError("Ya existe otra categoría con ese nombre", 409);
      }

      data.nombre = trimmedNombre;
    }

    if (descripcion !== undefined) {
      data.descripcion = descripcion?.trim() || null;
    }

    const updatedCategory = await prisma.categoria.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Categoría actualizada correctamente",
      data: updatedCategory,
    });
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de categoría inválido", 400);
    }

    const category = await prisma.categoria.findUnique({
      where: { id },
      include: {
        productos: true,
      },
    });

    if (!category) {
      throw new AppError("Categoría no encontrada", 404);
    }

    if (category.productos.length > 0) {
      throw new AppError(
        "No se puede eliminar la categoría porque tiene productos asociados",
        400
      );
    }

    await prisma.categoria.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Categoría eliminada correctamente",
    });
  }
);
