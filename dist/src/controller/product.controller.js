import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/prisma.js";
import { deleteFromCloudinary } from "../utils/cloudinaryDestroy.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { syncStockAlert } from "../utils/stockAlert.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
const parseOptionalBoolean = (value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
    }
    return undefined;
};
const buildProductFilters = (req, includeOutOfStock) => {
    const search = req.query.search?.toString().trim() || "";
    const categoriaId = req.query.categoria_id
        ? Number(req.query.categoria_id)
        : undefined;
    const onlyActive = req.query.activo?.toString();
    return {
        ...(search
            ? {
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
                ],
            }
            : {}),
        ...(categoriaId !== undefined && !Number.isNaN(categoriaId)
            ? {
                categoria_id: categoriaId,
            }
            : {}),
        ...(onlyActive !== undefined
            ? {
                activo: onlyActive.toLowerCase() === "true",
            }
            : {
                activo: true,
            }),
        ...(includeOutOfStock
            ? {}
            : {
                stock: {
                    gt: 0,
                },
            }),
    };
};
export const getProducts = asyncHandler(async (req, res) => {
    const products = await prisma.producto.findMany({
        where: buildProductFilters(req, false),
        include: {
            categoria: true,
        },
        orderBy: {
            id: "desc",
        },
    });
    res.status(200).json({
        success: true,
        data: products,
    });
});
export const getAdminProducts = asyncHandler(async (req, res) => {
    const products = await prisma.producto.findMany({
        where: buildProductFilters(req, true),
        include: {
            categoria: true,
        },
        orderBy: {
            id: "desc",
        },
    });
    res.status(200).json({
        success: true,
        data: products,
    });
});
export const getProductById = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
        throw new AppError("ID de producto inválido", 400);
    }
    const product = await prisma.producto.findUnique({
        where: { id },
        include: {
            categoria: true,
        },
    });
    if (!product) {
        throw new AppError("Producto no encontrado", 404);
    }
    res.status(200).json({
        success: true,
        data: product,
    });
});
export const createProduct = asyncHandler(async (req, res) => {
    const { nombre, descripcion, precio, stock, stock_minimo, categoria_id, material, activo, } = req.body;
    const trimmedNombre = String(nombre).trim();
    const trimmedDescripcion = String(descripcion).trim();
    const trimmedMaterial = String(material ?? "").trim();
    const parsedActivo = parseOptionalBoolean(activo);
    const parsedPrecio = Number(precio);
    const parsedStock = Number(stock);
    const parsedStockMinimo = stock_minimo !== undefined ? Number(stock_minimo) : 5;
    const parsedCategoriaId = Number(categoria_id);
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
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
        throw new AppError("El stock no puede ser negativo", 400);
    }
    if (Number.isNaN(parsedStockMinimo) || parsedStockMinimo < 0) {
        throw new AppError("El stock mínimo no puede ser negativo", 400);
    }
    if (Number.isNaN(parsedCategoriaId) || parsedCategoriaId <= 0) {
        throw new AppError("La categoría es inválida", 400);
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
        },
    });
    if (existingProduct) {
        throw new AppError("Ya existe un producto con ese nombre", 409);
    }
    let imagen_url = null;
    let imagen_public_id = null;
    try {
        if (req.file) {
            const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
            imagen_url = uploadResult.secure_url;
            imagen_public_id = uploadResult.public_id;
        }
        const product = await prisma.producto.create({
            data: {
                nombre: trimmedNombre,
                descripcion: trimmedDescripcion,
                precio: parsedPrecio,
                stock: parsedStock,
                stock_minimo: parsedStockMinimo,
                categoria_id: parsedCategoriaId,
                material: trimmedMaterial,
                activo: parsedActivo ?? true,
                imagen_url,
                imagen_public_id,
            },
            include: {
                categoria: true,
            },
        });
        await syncStockAlert(product.id);
        res.status(201).json({
            success: true,
            message: "Producto creado correctamente",
            data: product,
        });
    }
    catch (error) {
        if (imagen_public_id) {
            await deleteFromCloudinary(imagen_public_id);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new AppError("Ya existe un producto con ese nombre", 409);
        }
        throw error;
    }
});
export const updateProduct = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
        throw new AppError("ID de producto inválido", 400);
    }
    const existingProduct = await prisma.producto.findUnique({
        where: { id },
    });
    if (!existingProduct) {
        throw new AppError("Producto no encontrado", 404);
    }
    const { nombre, descripcion, precio, stock, stock_minimo, categoria_id, material, activo, removeImage, } = req.body;
    const parsedActivo = parseOptionalBoolean(activo);
    const parsedRemoveImage = parseOptionalBoolean(removeImage);
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
        const parsedStock = Number(stock);
        if (Number.isNaN(parsedStock) || parsedStock < 0) {
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
    let newImageUrl = existingProduct.imagen_url;
    let newImagePublicId = existingProduct.imagen_public_id;
    let uploadedNewImagePublicId = null;
    try {
        if (req.file) {
            const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
            newImageUrl = uploadResult.secure_url;
            newImagePublicId = uploadResult.public_id;
            uploadedNewImagePublicId = uploadResult.public_id;
        }
        else if (parsedRemoveImage === true) {
            newImageUrl = null;
            newImagePublicId = null;
        }
        const updatedProduct = await prisma.producto.update({
            where: { id },
            data: {
                ...(nombre !== undefined ? { nombre: String(nombre).trim() } : {}),
                ...(descripcion !== undefined
                    ? { descripcion: String(descripcion).trim() }
                    : {}),
                ...(precio !== undefined ? { precio: Number(precio) } : {}),
                ...(stock !== undefined ? { stock: Number(stock) } : {}),
                ...(stock_minimo !== undefined
                    ? { stock_minimo: Number(stock_minimo) }
                    : {}),
                ...(categoria_id !== undefined
                    ? { categoria_id: Number(categoria_id) }
                    : {}),
                ...(material !== undefined
                    ? { material: String(material).trim() }
                    : {}),
                ...(parsedActivo !== undefined ? { activo: parsedActivo } : {}),
                imagen_url: newImageUrl,
                imagen_public_id: newImagePublicId,
            },
            include: {
                categoria: true,
            },
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
    }
    catch (error) {
        if (uploadedNewImagePublicId) {
            await deleteFromCloudinary(uploadedNewImagePublicId);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw new AppError("Ya existe otro producto con ese nombre", 409);
        }
        throw error;
    }
});
export const deleteProduct = asyncHandler(async (req, res) => {
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
        include: {
            categoria: true,
        },
    });
    await syncStockAlert(updatedProduct.id);
    res.status(200).json({
        success: true,
        message: "Producto desactivado correctamente",
        data: updatedProduct,
    });
});
//# sourceMappingURL=product.controller.js.map