import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { productService } from "../services/product.service.js";
import type {
  CreateProductInput,
  ProductIdParamsInput,
  ProductQueryInput,
  UpdateProductInput,
} from "../validators/product.schemas.js";

export const getProducts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("========== GET /products ==========");

      const query = req.query as unknown as ProductQueryInput;

      console.log("Query recibida:", query);

      const products = await productService.getProducts(query);

      console.log("Productos encontrados:", products.length);

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      console.error("ERROR DIRECTO EN GET /products:", error);

      if (error instanceof Error) {
        console.error("Nombre:", error.name);
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Error interno del servidor",
      });
    }
  }
);

export const getAdminProducts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("========== GET /admin/products ==========");

      const query = req.query as unknown as ProductQueryInput;

      const products = await productService.getAdminProducts(query);

      console.log("Productos admin encontrados:", products.length);

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      console.error("ERROR DIRECTO EN GET ADMIN PRODUCTS:", error);

      if (error instanceof Error) {
        console.error("Nombre:", error.name);
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Error interno del servidor",
      });
    }
  }
);

export const getProductById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("========== GET /products/:id ==========");

      const params = req.params as unknown as ProductIdParamsInput;
      const query = req.query as unknown as ProductQueryInput;

      console.log("ID recibido:", params.id);

      const product = await productService.getProductById(
        params.id,
        query.admin === true
      );

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error("ERROR DIRECTO EN GET PRODUCT BY ID:", error);

      if (error instanceof Error) {
        console.error("Nombre:", error.name);
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);
      }

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Error interno del servidor",
      });
    }
  }
);

export const createProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateProductInput;

    const product = await productService.createProduct(body, req.file);

    res.status(201).json({
      success: true,
      message: "Producto creado correctamente",
      data: product,
    });
  }
);

export const updateProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const params = req.params as unknown as ProductIdParamsInput;
    const body = req.body as UpdateProductInput;

    const updatedProduct = await productService.updateProduct(
      params.id,
      body,
      req.file
    );

    res.status(200).json({
      success: true,
      message: "Producto actualizado correctamente",
      data: updatedProduct,
    });
  }
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const params = req.params as unknown as ProductIdParamsInput;

    const updatedProduct = await productService.deleteProduct(params.id);

    res.status(200).json({
      success: true,
      message: "Producto desactivado correctamente",
      data: updatedProduct,
    });
  }
);
