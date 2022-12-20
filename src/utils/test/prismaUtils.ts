import { Prisma, PrismaClient } from "@prisma/client";


export async function clearPostgres(prisma:PrismaClient) {
  const models = Prisma.dmmf.datamodel.models;
  const tables = models.map((model) => model.name);
  const schema = process.env["DEV_SCHEMA"];

  await prisma.$transaction([
    ...tables.map((table) => {
      return prisma.$executeRawUnsafe(`DELETE FROM ${schema}."${table}";`);
    }),
  ]);
}
