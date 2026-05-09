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
    const query = req.query as unknown as ProductQueryInput;

    const products = await productService.getProducts(query);

    res.status(200).json({
      success: true,
      data: products,
    });
  }
);

export const getAdminProducts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ProductQueryInput;

    const products = await productService.getAdminProducts(query);

    res.status(200).json({
      success: true,
      data: products,
    });
  }
);

export const getProductById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const params = req.params as unknown as ProductIdParamsInput;
    const query = req.query as unknown as ProductQueryInput;

    const product = await productService.getProductById(
      params.id,
      query.admin === true
    );

    res.status(200).json({
      success: true,
      data: product,
    });
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
