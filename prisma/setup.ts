import "dotenv/config";
import { PrismaClient, RolUsuario } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const envAdminName = process.env.ADMIN_NAME;
const envAdminEmail = process.env.ADMIN_EMAIL;
const envAdminPassword = process.env.ADMIN_PASSWORD;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL");
}

if (!envAdminName) {
  throw new Error("Falta ADMIN_NAME");
}

if (!envAdminEmail) {
  throw new Error("Falta ADMIN_EMAIL");
}

if (!envAdminPassword) {
  throw new Error("Falta ADMIN_PASSWORD");
}

const adminName: string = envAdminName;
const adminEmail: string = envAdminEmail;
const adminPassword: string = envAdminPassword;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Inicializando sistema...");

  const existingAdmin = await prisma.usuario.findUnique({
    where: { correo: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword: string = await bcrypt.hash(adminPassword, 12);

    await prisma.usuario.create({
      data: {
        nombre: adminName,
        correo: adminEmail,
        password_hash: hashedPassword,
        rol: RolUsuario.administrador,
      },
    });

    console.log("Usuario administrador creado");
  } else {
    console.log("Usuario administrador ya existe");
  }

  console.log("Sistema inicializado correctamente");
}

main()
  .catch((error) => {
    console.error("Error en setup:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
