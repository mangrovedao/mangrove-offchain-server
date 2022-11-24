import { Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import {
  MakerBalance,
  MakerBalanceVersion,
  Mangrove,
  MangroveVersion,
  Offer,
  OfferList,
  OfferListVersion,
  OfferVersion,
  Order,
  OrderSummary,
  TakenOffer,
  TakerApproval,
  TakerApprovalVersion,
  Token,
} from "@generated/type-graphql";
import { PrismaClient } from "@prisma/client";

// At most re-fetch once per 1000 ms for each token
import { fetchBuilder, MemoryCache } from "node-fetch-cache";
const fetch = fetchBuilder.withCache(new MemoryCache({ ttl: 1000 }));
async function fetchTokenPriceInUsd(token: Token) {
  return (await fetch(
    `https://min-api.cryptocompare.com/data/price?fsym=${token.symbol}&tsyms=USD`
  )
    .then((response: any) => response.json())
    .then((json: any) => json["USD"])
    .catch(() => undefined)) as number;
}

type Context = {
  prisma: PrismaClient;
};

@Resolver((of) => Mangrove)
export class CustomMangroveFieldsResolver {
  @FieldResolver((type) => MangroveVersion, { nullable: true })
  async currentVersion(
    @Root() mangrove: Mangrove,
    @Ctx() ctx: Context
  ): Promise<MangroveVersion | null> {
    return await ctx.prisma.mangroveVersion.findUnique({
      where: { id: mangrove.currentVersionId },
    });
  }
}

@Resolver((of) => TakerApproval)
export class CustomTakerApprovalFieldsResolver {
  @FieldResolver((type) => TakerApprovalVersion, { nullable: true })
  async currentVersion(
    @Root() takerApproval: TakerApproval,
    @Ctx() ctx: Context
  ): Promise<TakerApprovalVersion | null> {
    return await ctx.prisma.takerApprovalVersion.findUnique({
      where: { id: takerApproval.currentVersionId },
    });
  }
}

@Resolver((of) => MakerBalance)
export class CustomMakerBalanceFieldsResolver {
  @FieldResolver((type) => MakerBalanceVersion, { nullable: true })
  async currentVersion(
    @Root() makerBalance: MakerBalance,
    @Ctx() ctx: Context
  ): Promise<MakerBalanceVersion | null> {
    return await ctx.prisma.makerBalanceVersion.findUnique({
      where: { id: makerBalance.currentVersionId },
    });
  }
}

@Resolver((of) => OfferList)
export class CustomOfferListFieldsResolver {
  @FieldResolver((type) => OfferListVersion, { nullable: true })
  async currentVersion(
    @Root() offerList: OfferList,
    @Ctx() ctx: Context
  ): Promise<OfferListVersion | null> {
    return await ctx.prisma.offerListVersion.findUnique({
      where: { id: offerList.currentVersionId },
    });
  }
}

@Resolver((of) => Token)
export class CustomTokenFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async priceInUsd(
    @Root() token: Token,
    @Ctx() { prisma }: Context
  ): Promise<number | undefined> {
    return await fetchTokenPriceInUsd(token);
  }
}

@Resolver((of) => Offer)
export class CustomOfferFieldsResolver {
  @FieldResolver((type) => OfferVersion, { nullable: true })
  async currentVersion(
    @Root() offer: Offer,
    @Ctx() ctx: Context
  ): Promise<OfferVersion | null> {
    return await ctx.prisma.offerVersion.findUnique({
      where: { id: offer.currentVersionId },
    });
  }
}

@Resolver((of) => OfferVersion)
export class CustomOfferVersionFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async givesInUsd(
    @Root() offerVersion: OfferVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      offerVersion,
      offerVersion.givesNumber,
      findOutboundTokenFromOfferVersionOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async wantsInUsd(
    @Root() offerVersion: OfferVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      offerVersion,
      offerVersion.wantsNumber,
      findInboundTokenFromOfferVersionOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerPaysPriceInUsd(
    @Root() offerVersion: OfferVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      offerVersion,
      offerVersion.takerPaysPrice,
      findInboundTokenFromOfferVersionOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async makerPaysPriceInUsd(
    @Root() offerVersion: OfferVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      offerVersion,
      offerVersion.makerPaysPrice,
      findOutboundTokenFromOfferVersionOrFail,
      ctx
    );
  }
}

@Resolver((of) => Order)
export class CustomOrderFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async takerGotInUsd(
    @Root() order: Order,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerGotNumber,
      findOutboundTokenFromOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGaveInUsd(
    @Root() order: Order,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerGaveNumber,
      findInboundTokenFromOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerPaidPriceInUsd(
    @Root() order: Order,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerPaidPrice,
      findInboundTokenFromOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async makerPaidPriceInUsd(
    @Root() order: Order,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.makerPaidPrice,
      findOutboundTokenFromOrderOrFail,
      ctx
    );
  }
}

@Resolver((of) => TakenOffer)
export class CustomTakenOfferFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async takerWantsInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerWantsNumber,
      findOutboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGivesInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerGivesNumber,
      findInboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerPaysPriceInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerPaysPrice,
      findInboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async makerPaysPriceInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.makerPaysPrice,
      findOutboundTokenFromTakenOfferOrFail,
      ctx
    );
  }
}

@Resolver((of) => OrderSummary)
export class CustomOrderSummaryFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async takerGotInUsd(
    @Root() order: OrderSummary,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerGotNumber,
      findOutboundTokenFromOrderSummaryOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGaveInUsd(
    @Root() order: OrderSummary,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerGaveNumber,
      findInboundTokenFromOrderSummaryOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async priceInUsd(
    @Root() order: OrderSummary,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.price,
      findInboundTokenFromOrderSummaryOrFail,
      ctx
    );
  }
}

async function amountFieldToUsd<Entity>(
  entity: Entity,
  amount: number | null | undefined,
  tokenGetter: (e: Entity, prisma: PrismaClient) => Promise<Token>,
  ctx: Context
): Promise<number | undefined> {
  if (!amount) return undefined;
  const token = await tokenGetter(entity, ctx.prisma);
  const tokenPriceInUsd = await fetchTokenPriceInUsd(token);
  if (!tokenPriceInUsd) return undefined;
  return amount * tokenPriceInUsd;
}

async function findOutboundTokenFromOfferVersionOrFail(
  offerVersion: OfferVersion,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.offer
    .findUnique({
      where: { id: offerVersion.offerId },
    })
    .offerList()
    .outboundToken();
  if (!outboundToken)
    throw Error(`Cannot find outbound token from offer '${offerVersion.id}'`);
  return outboundToken;
}

async function findInboundTokenFromOfferVersionOrFail(
  offerVersion: OfferVersion,
  prisma: PrismaClient
): Promise<Token> {
  const inboundToken = await prisma.offer
    .findUnique({
      where: { id: offerVersion.offerId },
    })
    .offerList()
    .inboundToken();
  if (!inboundToken)
    throw Error(`Cannot find inbound token from offer '${offerVersion.id}'`);
  return inboundToken;
}

async function findOutboundTokenFromOrderOrFail(
  order: Order,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.order
    .findUnique({
      where: { id: order.id },
    })
    .offerList()
    .outboundToken();
  if (!outboundToken)
    throw Error(`Cannot find outbound token from order '${order.id}'`);
  return outboundToken;
}

async function findInboundTokenFromOrderOrFail(
  order: Order,
  prisma: PrismaClient
): Promise<Token> {
  const inboundToken = await prisma.order
    .findUnique({
      where: { id: order.id },
    })
    .offerList()
    .inboundToken();
  if (!inboundToken)
    throw Error(`Cannot find inbound token from order '${order.id}'`);
  return inboundToken;
}

async function findOutboundTokenFromTakenOfferOrFail(
  takenOffer: TakenOffer,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.takenOffer
    .findUnique({
      where: { id: takenOffer.id },
    })
    .order()
    .offerList()
    .outboundToken();
  if (!outboundToken)
    throw Error(
      `Cannot find outbound token from takenOffer '${takenOffer.id}'`
    );
  return outboundToken;
}

async function findInboundTokenFromTakenOfferOrFail(
  takenOffer: TakenOffer,
  prisma: PrismaClient
): Promise<Token> {
  const inboundToken = await prisma.takenOffer
    .findUnique({
      where: { id: takenOffer.id },
    })
    .order()
    .offerList()
    .inboundToken();
  if (!inboundToken)
    throw Error(`Cannot find inbound token from takenOffer '${takenOffer.id}'`);
  return inboundToken;
}

async function findOutboundTokenFromOrderSummaryOrFail(
  orderSummary: OrderSummary,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.orderSummary
    .findUnique({
      where: { id: orderSummary.id },
    })
    .offerList()
    .outboundToken();
  if (!outboundToken)
    throw Error(
      `Cannot find outbound token from orderSummary '${orderSummary.id}'`
    );
  return outboundToken;
}

async function findInboundTokenFromOrderSummaryOrFail(
  orderSummary: OrderSummary,
  prisma: PrismaClient
): Promise<Token> {
  const inboundToken = await prisma.orderSummary
    .findUnique({
      where: { id: orderSummary.id },
    })
    .offerList()
    .inboundToken();
  if (!inboundToken)
    throw Error(
      `Cannot find inbound token from orderSummary '${orderSummary.id}'`
    );
  return inboundToken;
}
