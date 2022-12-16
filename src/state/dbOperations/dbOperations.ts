import * as prisma from "@prisma/client";


export class DbOperations {
  public constructor(protected readonly tx: PrismaTx) {}
}

export type PrismaTx = Omit<
  prisma.PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
>;

export function toUpsert<T extends { id: string | number }>(
  entity: T
): Upsert<T> {
  return {
    where: { id: entity.id },
    create: entity,
    update: entity,
  };
}

export interface Upsert<T> {
  where: { id: any };
  create: T;
  update: T;
}
