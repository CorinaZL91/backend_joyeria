import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

const productInclude = {
  categoria: true,
  tallas: {
    where: {
      activo: true,
    },
    orderBy: {
      id: "asc" as const,
    },
  },
};

const adminProductInclude = {
  categoria: true,
  tallas: {
    orderBy: {
      id: "asc" as const,
    },
  },
};

export const productRepository = {
  findPublicProducts: async (where: Prisma.ProductoWhereInput) => {
    return prisma.producto.findMany({
      where,
      include: productInclude,
      orderBy: {
        id: "desc",
      },
    });
  },

  findAdminProducts: async (where: Prisma.ProductoWhereInput) => {
    return prisma.producto.findMany({
      where,
      include: adminProductInclude,
      orderBy: {
        id: "desc",
      },
    });
  },

  findByIdPublic: async (id: number) => {
    return prisma.producto.findUnique({
      where: { id },
      include: productInclude,
    });
  },

  findByIdAdmin: async (id: number) => {
    return prisma.producto.findUnique({
      where: { id },
      include: adminProductInclude,
    });
  },

  findById: async (id: number) => {
    return prisma.producto.findUnique({
      where: { id },
    });
  },

  findByIdWithTallas: async (id: number) => {
    return prisma.producto.findUnique({
      where: { id },
      include: {
        tallas: true,
      },
    });
  },

  findCategoryById: async (id: number) => {
    return prisma.categoria.findUnique({
      where: { id },
    });
  },

  findActiveProductByName: async (nombre: string) => {
    return prisma.producto.findFirst({
      where: {
        nombre,
        activo: true,
      },
    });
  },

  findProductByNameExceptId: async (nombre: string, id: number) => {
    return prisma.producto.findFirst({
      where: {
        nombre,
        NOT: {
          id,
        },
      },
    });
  },

  createProduct: async (data: Prisma.ProductoCreateInput) => {
    return prisma.$transaction(async (tx) => {
      return tx.producto.create({
        data,
        include: adminProductInclude,
      });
    });
  },

  updateProduct: async (
    id: number,
    data: Prisma.ProductoUpdateInput,
    shouldDeleteTallas: boolean
  ) => {
    return prisma.$transaction(async (tx) => {
      if (shouldDeleteTallas) {
        await tx.productoTalla.deleteMany({
          where: {
            producto_id: id,
          },
        });
      }

      return tx.producto.update({
        where: { id },
        data,
        include: adminProductInclude,
      });
    });
  },

  deactivateById: async (id: number) => {
    return prisma.producto.update({
      where: { id },
      data: {
        activo: false,
      },
      include: adminProductInclude,
    });
  },
};