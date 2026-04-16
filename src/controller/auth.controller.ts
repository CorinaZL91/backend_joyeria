import type { Request, Response } from "express";
import { Prisma, RolUsuario } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { nombre, correo, password, telefono } = req.body;

    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      throw new AppError("El nombre es obligatorio", 400);
    }

    if (!correo || typeof correo !== "string" || correo.trim() === "") {
      throw new AppError("El correo es obligatorio", 400);
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
      throw new AppError("La contraseña es obligatoria", 400);
    }

    if (!telefono || typeof telefono !== "string" || telefono.trim() === "") {
      throw new AppError("El teléfono es obligatorio", 400);
    }

    const nombreNormalizado = nombre.trim();
    const correoNormalizado = correo.trim().toLowerCase();
    const telefonoNormalizado = telefono.trim();

    const existingUser = await prisma.usuario.findUnique({
      where: { correo: correoNormalizado },
    });

    if (existingUser) {
      throw new AppError("Ya existe un usuario con ese correo", 409);
    }

    const hashedPassword = await hashPassword(password);

    try {
      const newUser = await prisma.usuario.create({
        data: {
          nombre: nombreNormalizado,
          correo: correoNormalizado,
          password_hash: hashedPassword,
          telefono: telefonoNormalizado,
          rol: RolUsuario.cliente,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          telefono: true,
          direccion: true,
          direccion_calle: true,
          direccion_ciudad: true,
          direccion_codigo_postal: true,
          rol: true,
        },
      });

      const token = generateToken({
        userId: newUser.id,
        rol: newUser.rol,
      });

      res.status(201).json({
        success: true,
        message: "Usuario registrado correctamente",
        data: {
          token,
          user: newUser,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[])
          : [];

        if (target.includes("correo")) {
          throw new AppError("Ya existe un usuario con ese correo", 409);
        }

        if (target.includes("telefono")) {
          throw new AppError("Ya existe un usuario con ese teléfono", 409);
        }

        throw new AppError("Ya existe un dato duplicado", 409);
      }

      throw error;
    }
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { correo, password } = req.body;

    if (!correo || typeof correo !== "string" || correo.trim() === "") {
      throw new AppError("El correo es obligatorio", 400);
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
      throw new AppError("La contraseña es obligatoria", 400);
    }

    const correoNormalizado = correo.trim().toLowerCase();

    const user = await prisma.usuario.findUnique({
      where: { correo: correoNormalizado },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        direccion: true,
        direccion_calle: true,
        direccion_ciudad: true,
        direccion_codigo_postal: true,
        rol: true,
        password_hash: true,
      },
    });

    if (!user) {
      throw new AppError("Credenciales inválidas", 401);
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new AppError("Credenciales inválidas", 401);
    }

    const token = generateToken({
      userId: user.id,
      rol: user.rol,
    });

    res.status(200).json({
      success: true,
      message: "Inicio de sesión exitoso",
      data: {
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          correo: user.correo,
          telefono: user.telefono,
          direccion: user.direccion,
          direccion_calle: user.direccion_calle,
          direccion_ciudad: user.direccion_ciudad,
          direccion_codigo_postal: user.direccion_codigo_postal,
          rol: user.rol,
        },
      },
    });
  }
);

export const me = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("No autenticado", 401);
    }

    const user = await prisma.usuario.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        direccion: true,
        direccion_calle: true,
        direccion_ciudad: true,
        direccion_codigo_postal: true,
        rol: true,
      },
    });

    if (!user) {
      throw new AppError("Usuario no encontrado", 404);
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  }
);
