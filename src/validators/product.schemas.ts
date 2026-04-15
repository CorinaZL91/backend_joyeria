import { z } from "zod";

const toNumber = (label: string) =>
  z.coerce.number({
    message: `${label} debe ser numérico`,
  });

const toBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return value;
}, z.boolean({ message: "Debe ser un valor booleano" }));

const parseTallas = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

const tallaItemSchema = z.object({
  talla: z.string().trim().min(1, "La talla es obligatoria"),

  stock: toNumber("El stock de la talla")
    .int("El stock de la talla debe ser entero")
    .min(0, "El stock de la talla no puede ser negativo"),

  activo: toBoolean.optional(),
});

export const createProductSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio"),

    descripcion: z.string().trim().min(1, "La descripción es obligatoria"),

    precio: toNumber("El precio").positive("El precio debe ser mayor a 0"),

    material: z.string().trim().min(1, "El material es obligatorio"),

    usar_tallas: toBoolean.optional().default(false),

    stock: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("El stock").int("El stock debe ser entero").min(0, "El stock no puede ser negativo").optional()),

    stock_minimo: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("El stock mínimo").int("El stock mínimo debe ser entero").min(0, "El stock mínimo no puede ser negativo").optional()),

    categoria_id: toNumber("La categoría")
      .int("La categoría debe ser entera")
      .positive("La categoría es obligatoria"),

    activo: toBoolean.optional(),

    tallas: z.preprocess(parseTallas, z.array(tallaItemSchema).optional()),
  })
  .superRefine((data, ctx) => {
    if (data.usar_tallas) {
      if (!data.tallas || data.tallas.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tallas"],
          message:
            "Debes agregar al menos una talla cuando el producto usa tallas",
        });
      }

      if (data.stock !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stock"],
          message:
            "No debes enviar stock general cuando el producto usa tallas",
        });
      }

      if (data.tallas && data.tallas.length > 0) {
        const tallasNormalizadas = data.tallas.map((item) =>
          item.talla.trim().toLowerCase()
        );

        const tallasUnicas = new Set(tallasNormalizadas);

        if (tallasUnicas.size !== tallasNormalizadas.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tallas"],
            message: "No se permiten tallas repetidas en el mismo producto",
          });
        }
      }
    } else {
      if (data.stock === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stock"],
          message: "El stock es obligatorio cuando el producto no usa tallas",
        });
      }
    }
  });

export const updateProductSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),

    descripcion: z
      .string()
      .trim()
      .min(1, "La descripción es obligatoria")
      .optional(),

    precio: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("El precio").positive("El precio debe ser mayor a 0").optional()),

    material: z.string().trim().min(1, "El material es obligatorio").optional(),

    usar_tallas: toBoolean.optional(),

    stock: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("El stock").int("El stock debe ser entero").min(0, "El stock no puede ser negativo").optional()),

    stock_minimo: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("El stock mínimo").int("El stock mínimo debe ser entero").min(0, "El stock mínimo no puede ser negativo").optional()),

    categoria_id: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    }, toNumber("La categoría").int("La categoría debe ser entera").positive("La categoría es obligatoria").optional()),

    activo: toBoolean.optional(),
    removeImage: toBoolean.optional(),

    tallas: z.preprocess(parseTallas, z.array(tallaItemSchema).optional()),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes enviar al menos un campo para actualizar",
      });
    }

    if (data.usar_tallas === true) {
      if (data.stock !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stock"],
          message:
            "No debes enviar stock general cuando el producto usa tallas",
        });
      }

      if (data.tallas && data.tallas.length > 0) {
        const tallasNormalizadas = data.tallas.map((item) =>
          item.talla.trim().toLowerCase()
        );

        const tallasUnicas = new Set(tallasNormalizadas);

        if (tallasUnicas.size !== tallasNormalizadas.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tallas"],
            message: "No se permiten tallas repetidas en el mismo producto",
          });
        }
      }
    }

    if (
      data.usar_tallas === false &&
      data.tallas !== undefined &&
      data.tallas.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tallas"],
        message: "No debes enviar tallas cuando el producto no usa tallas",
      });
    }
  });
