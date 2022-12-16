// TODO do not distribute in browser version

import { PrismaClient } from "@prisma/client";
import { clearPostgres } from "./prismaUtils";

export const prisma:PrismaClient = new PrismaClient();

export const mochaHooks = {

  async afterEach() {
    await clearPostgres(prisma);
  },


  async afterAll() {
    await prisma.$disconnect();
  }


  
};
