import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { deleteFromCloudinary } from "../utils/cloudinaryDestroy.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { syncStockAlert } from "../utils/stockAlert.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

type ParsedTallaInput = {
  talla: string;
  stock: number;
  activo?: boolean;
};

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return undefined;
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const normalizeTallaText = (value: unknown): string => {
  return String(value ?? "").trim();
};

const parseTallasInput = (value: unknown): ParsedTallaInput[] | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  let rawValue = value;

  if (typeof rawValue === "string") {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      throw new AppError(
        "El formato de tallas es inválido. Debe enviarse como arreglo JSON válido",
        400
      );
    }
  }

  if (!Array.isArray(rawValue)) {
    throw new AppError("Las tallas deben enviarse como un arreglo", 400);
  }

  const parsed = rawValue.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new AppError(
        `La talla en la posición ${index + 1} es inválida`,
        400
      );
    }

    const talla = normalizeTallaText((item as Record<string, unknown>).talla);
    const stock = Number((item as Record<string, unknown>).stock);
    const activo = parseOptionalBoolean(
      (item as Record<string, unknown>).activo
    );

    if (!talla) {
      throw new AppError(
        `La talla en la posición ${index + 1} es obligatoria`,
        400
      );
    }

    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      throw new AppError(
        `El stock de la talla "${talla}" debe ser un entero mayor o igual a 0`,
        400
      );
    }

    return {
      talla,
      stock,
      activo: activo ?? true,
    };
  });

  const normalizedNames = parsed.map((item) => item.talla.toLowerCase());
  const uniqueNames = new Set(normalizedNames);

  if (uniqueNames.size !== normalizedNames.length) {
    throw new AppError(
      "No se permiten tallas repetidas en el mismo producto",
      400
    );
  }

  return parsed;
};

const sumActiveTallasStock = (tallas: ParsedTallaInput[]): number => {
  return tallas
    .filter((item) => item.activo !== false)
    .reduce((acc, item) => acc + item.stock, 0);
};

const buildProductFilters = (
  req: Request,
  includeOutOfStock: boolean
): Prisma.ProductoWhereInput => {
  const search = req.query.search?.toString().trim() || "";
  const categoriaId = req.query.categoria_id
    ? Number(req.query.categoria_id)
    : undefined;
  const onlyActive = req.query.activo?.toString();

  const filters: Prisma.ProductoWhereInput[] = [];

  if (search) {
    filters.push({
      OR: [
        {
          nombre: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          descripcion: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          material: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          categoria: {
            nombre: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          tallas: {
            some: {
              talla: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (categoriaId !== undefined && !Number.isNaN(categoriaId)) {
    filters.push({
      categoria_id: categoriaId,
    });
  }

  if (onlyActive !== undefined) {
    filters.push({
      activo: onlyActive.toLowerCase() === "true",
    });
  } else {
    filters.push({
      activo: true,
    });
  }

  if (!includeOutOfStock) {
    filters.push({
      OR: [
        {
          usar_tallas: false,
          stock: {
            gt: 0,
          },
        },
        {
          usar_tallas: true,
          tallas: {
            some: {
              activo: true,
              stock: {
                gt: 0,
              },
            },
          },
        },
      ],
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
};

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

export const getProducts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const products = await prisma.producto.findMany({
      where: buildProductFilters(req, false),
      include: productInclude,
      orderBy: {
        id: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: products,
    });
  }
);

export const getAdminProducts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const products = await prisma.producto.findMany({
      where: buildProductFilters(req, true),
      include: adminProductInclude,
      orderBy: {
        id: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: products,
    });
  }
);

export const getProductById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de producto inválido", 400);
    }

    const isAdminView = req.query.admin?.toString() === "true";

    const product = await prisma.producto.findUnique({
      where: { id },
      include: isAdminView ? adminProductInclude : productInclude,
    });

    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }

    if (!isAdminView && !product.activo) {
      throw new AppError("Producto no encontrado", 404);
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  }
);

export const createProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      nombre,
      descripcion,
      precio,
      stock,
      stock_minimo,
      categoria_id,
      material,
      activo,
      usar_tallas,
      tallas,
    } = req.body;

    const trimmedNombre = String(nombre ?? "").trim();
    const trimmedDescripcion = String(descripcion ?? "").trim();
    const trimmedMaterial = String(material ?? "").trim();
    const parsedActivo = parseOptionalBoolean(activo);
    const parsedUsarTallas = parseOptionalBoolean(usar_tallas) ?? false;

    const parsedPrecio = Number(precio);
    const parsedStock = parseOptionalNumber(stock);
    const parsedStockMinimo =
      stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== ""
        ? Number(stock_minimo)
        : 5;
    const parsedCategoriaId = Number(categoria_id);
    const parsedTallas = parseTallasInput(tallas);

    if (!trimmedNombre) {
      throw new AppError("El nombre del producto es obligatorio", 400);
    }

    if (!trimmedDescripcion) {
      throw new AppError("La descripción del producto es obligatoria", 400);
    }

    if (!trimmedMaterial) {
      throw new AppError("El material del producto es obligatorio", 400);
    }

    if (Number.isNaN(parsedPrecio) || parsedPrecio <= 0) {
      throw new AppError("El precio debe ser mayor a 0", 400);
    }

    if (Number.isNaN(parsedStockMinimo) || parsedStockMinimo < 0) {
      throw new AppError("El stock mínimo no puede ser negativo", 400);
    }

    if (Number.isNaN(parsedCategoriaId) || parsedCategoriaId <= 0) {
      throw new AppError("La categoría es inválida", 400);
    }

    if (parsedUsarTallas) {
      if (!parsedTallas || parsedTallas.length === 0) {
        throw new AppError(
          "Debes agregar al menos una talla cuando el producto usa tallas",
          400
        );
      }

      if (parsedStock !== undefined && parsedStock > 0) {
        throw new AppError(
          "No debes enviar stock general cuando el producto usa tallas",
          400
        );
      }
    } else {
      if (
        parsedStock === undefined ||
        parsedStock < 0 ||
        !Number.isInteger(parsedStock)
      ) {
        throw new AppError(
          "El stock general es obligatorio cuando el producto no usa tallas",
          400
        );
      }
    }

    const categoryExists = await prisma.categoria.findUnique({
      where: { id: parsedCategoriaId },
    });

    if (!categoryExists) {
      throw new AppError("La categoría no existe", 404);
    }

    const existingProduct = await prisma.producto.findFirst({
      where: {
        nombre: trimmedNombre,
        activo: true,
      },
    });

    if (existingProduct) {
      throw new AppError("Ya existe un producto con ese nombre", 409);
    }

    let imagen_url: string | null = null;
    let imagen_public_id: string | null = null;

    try {
      if (req.file) {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
        imagen_url = uploadResult.secure_url;
        imagen_public_id = uploadResult.public_id;
      }

      const product = await prisma.$transaction(async (tx) => {
        const createData: Prisma.ProductoCreateInput = {
          nombre: trimmedNombre,
          descripcion: trimmedDescripcion,
          precio: parsedPrecio,
          material: trimmedMaterial,
          usar_tallas: parsedUsarTallas,
          stock_minimo: parsedStockMinimo,
          activo: parsedActivo ?? true,
          imagen_url,
          imagen_public_id,
          categoria: {
            connect: {
              id: parsedCategoriaId,
            },
          },
        };

        if (parsedUsarTallas) {
          createData.stock = sumActiveTallasStock(parsedTallas!);
        } else if (parsedStock !== undefined) {
          createData.stock = parsedStock;
        }

        if (parsedUsarTallas && parsedTallas) {
          createData.tallas = {
            create: parsedTallas.map((item) => ({
              talla: item.talla,
              stock: item.stock,
              activo: item.activo ?? true,
            })),
          };
        }

        return tx.producto.create({
          data: createData,
          include: adminProductInclude,
        });
      });

      await syncStockAlert(product.id);

      res.status(201).json({
        success: true,
        message: "Producto creado correctamente",
        data: product,
      });
    } catch (error) {
      if (imagen_public_id) {
        await deleteFromCloudinary(imagen_public_id);
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("Ya existe un producto con ese nombre", 409);
      }

      throw error;
    }
  }
);

export const updateProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de producto inválido", 400);
    }

    const existingProduct = await prisma.producto.findUnique({
      where: { id },
      include: {
        tallas: true,
      },
    });

    if (!existingProduct) {
      throw new AppError("Producto no encontrado", 404);
    }

    const {
      nombre,
      descripcion,
      precio,
      stock,
      stock_minimo,
      categoria_id,
      material,
      activo,
      removeImage,
      usar_tallas,
      tallas,
    } = req.body;

    const parsedActivo = parseOptionalBoolean(activo);
    const parsedRemoveImage = parseOptionalBoolean(removeImage);
    const parsedUsarTallas = parseOptionalBoolean(usar_tallas);
    const parsedStock = parseOptionalNumber(stock);
    const parsedTallas = parseTallasInput(tallas);

    const finalUsarTallas = parsedUsarTallas ?? existingProduct.usar_tallas;

    if (categoria_id !== undefined) {
      const parsedCategoriaId = Number(categoria_id);

      if (Number.isNaN(parsedCategoriaId) || parsedCategoriaId <= 0) {
        throw new AppError("La categoría es inválida", 400);
      }

      const categoryExists = await prisma.categoria.findUnique({
        where: { id: parsedCategoriaId },
      });

      if (!categoryExists) {
        throw new AppError("La categoría no existe", 404);
      }
    }

    if (nombre !== undefined) {
      const trimmedNombre = String(nombre).trim();

      if (!trimmedNombre) {
        throw new AppError("El nombre del producto es obligatorio", 400);
      }

      const duplicateProduct = await prisma.producto.findFirst({
        where: {
          nombre: trimmedNombre,
          NOT: {
            id,
          },
        },
      });

      if (duplicateProduct) {
        throw new AppError("Ya existe otro producto con ese nombre", 409);
      }
    }

    if (precio !== undefined) {
      const parsedPrecio = Number(precio);

      if (Number.isNaN(parsedPrecio) || parsedPrecio <= 0) {
        throw new AppError("El precio debe ser mayor a 0", 400);
      }
    }

    if (stock !== undefined) {
      if (
        parsedStock === undefined ||
        parsedStock < 0 ||
        !Number.isInteger(parsedStock)
      ) {
        throw new AppError("El stock no puede ser negativo", 400);
      }
    }

    if (stock_minimo !== undefined) {
      const parsedStockMinimo = Number(stock_minimo);

      if (Number.isNaN(parsedStockMinimo) || parsedStockMinimo < 0) {
        throw new AppError("El stock mínimo no puede ser negativo", 400);
      }
    }

    if (material !== undefined && !String(material).trim()) {
      throw new AppError("El material del producto es obligatorio", 400);
    }

    if (descripcion !== undefined && !String(descripcion).trim()) {
      throw new AppError("La descripción del producto es obligatoria", 400);
    }

    if (finalUsarTallas) {
      const currentOrIncomingTallas =
        parsedTallas ??
        existingProduct.tallas
          .filter((item) => item.activo)
          .map((item) => ({
            talla: item.talla,
            stock: item.stock,
            activo: item.activo,
          }));

      if (!currentOrIncomingTallas || currentOrIncomingTallas.length === 0) {
        throw new AppError(
          "El producto debe tener al menos una talla activa cuando usa tallas",
          400
        );
      }

      if (stock !== undefined && parsedStock !== undefined && parsedStock > 0) {
        throw new AppError(
          "No debes enviar stock general cuando el producto usa tallas",
          400
        );
      }
    } else {
      if (
        parsedStock === undefined &&
        stock === undefined &&
        existingProduct.stock === null
      ) {
        throw new AppError(
          "El stock general es obligatorio cuando el producto no usa tallas",
          400
        );
      }
    }

    if (
      !finalUsarTallas &&
      parsedTallas !== undefined &&
      parsedTallas.length > 0
    ) {
      throw new AppError(
        "No debes enviar tallas cuando el producto no usa tallas",
        400
      );
    }

    let newImageUrl = existingProduct.imagen_url;
    let newImagePublicId = existingProduct.imagen_public_id;
    let uploadedNewImagePublicId: string | null = null;

    try {
      if (req.file) {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
        newImageUrl = uploadResult.secure_url;
        newImagePublicId = uploadResult.public_id;
        uploadedNewImagePublicId = uploadResult.public_id;
      } else if (parsedRemoveImage === true) {
        newImageUrl = null;
        newImagePublicId = null;
      }

      const updatedProduct = await prisma.$transaction(async (tx) => {
        if (
          parsedTallas !== undefined ||
          (existingProduct.usar_tallas && !finalUsarTallas)
        ) {
          await tx.productoTalla.deleteMany({
            where: {
              producto_id: id,
            },
          });
        }

        const updateData: Prisma.ProductoUpdateInput = {
          imagen_url: newImageUrl,
          imagen_public_id: newImagePublicId,
        };

        if (nombre !== undefined) {
          updateData.nombre = String(nombre).trim();
        }

        if (descripcion !== undefined) {
          updateData.descripcion = String(descripcion).trim();
        }

        if (precio !== undefined) {
          updateData.precio = Number(precio);
        }

        if (stock_minimo !== undefined) {
          updateData.stock_minimo = Number(stock_minimo);
        }

        if (categoria_id !== undefined) {
          updateData.categoria = {
            connect: {
              id: Number(categoria_id),
            },
          };
        }

        if (material !== undefined) {
          updateData.material = String(material).trim();
        }

        if (parsedActivo !== undefined) {
          updateData.activo = parsedActivo;
        }

        if (parsedUsarTallas !== undefined) {
          updateData.usar_tallas = parsedUsarTallas;
        }

        if (finalUsarTallas) {
          const tallasToUse =
            parsedTallas ??
            existingProduct.tallas
              .filter((item) => item.activo)
              .map((item) => ({
                talla: item.talla,
                stock: item.stock,
                activo: item.activo,
              }));

          updateData.stock = sumActiveTallasStock(tallasToUse);
        } else if (parsedStock !== undefined) {
          updateData.stock = parsedStock;
        }

        if (parsedTallas !== undefined && finalUsarTallas) {
          updateData.tallas = {
            create: parsedTallas.map((item) => ({
              talla: item.talla,
              stock: item.stock,
              activo: item.activo ?? true,
            })),
          };
        }

        return tx.producto.update({
          where: { id },
          data: updateData,
          include: adminProductInclude,
        });
      });

      if (req.file && existingProduct.imagen_public_id) {
        await deleteFromCloudinary(existingProduct.imagen_public_id);
      }

      if (parsedRemoveImage === true && existingProduct.imagen_public_id) {
        await deleteFromCloudinary(existingProduct.imagen_public_id);
      }

      await syncStockAlert(updatedProduct.id);

      res.status(200).json({
        success: true,
        message: "Producto actualizado correctamente",
        data: updatedProduct,
      });
    } catch (error) {
      if (uploadedNewImagePublicId) {
        await deleteFromCloudinary(uploadedNewImagePublicId);
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("Ya existe otro producto con ese nombre", 409);
      }

      throw error;
    }
  }
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("ID de producto inválido", 400);
    }

    const product = await prisma.producto.findUnique({
      where: { id },
    });

    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }

    if (!product.activo) {
      throw new AppError("El producto ya está inactivo", 400);
    }

    const updatedProduct = await prisma.producto.update({
      where: { id },
      data: {
        activo: false,
      },
      include: adminProductInclude,
    });

    await syncStockAlert(updatedProduct.id);

    res.status(200).json({
      success: true,
      message: "Producto desactivado correctamente",
      data: updatedProduct,
    });
  }
);
