import {
  MakerBalance,
  MakerBalanceVersion,
  MangroveOrder,
  MangroveOrderVersion,
  Offer,
  OfferListing,
  OfferListingVersion,
  OfferVersion,
  Order,
  TakenOffer,
  Token
} from "@generated/type-graphql";
import { PrismaClient } from "@prisma/client";
import { Arg, Ctx, FieldResolver, Resolver, Root } from "type-graphql";

// At most re-fetch once per 1000 ms for each token
import { MemoryCache, fetchBuilder } from "node-fetch-cache";
import { OfferListingUtils } from "src/state/dbOperations/offerListingUtils";
import { ChainId, MangroveId, OfferListingId } from "src/state/model";
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


@Resolver((of) => OfferListing)
export class CustomOfferListingFieldsResolver {

  @FieldResolver((type) => [OfferVersion], { nullable: true })
  async offersAtTime(
    @Arg("time") time:number,
    @Root() offerListing: OfferListing,
    @Ctx() ctx: Context
  ): Promise<OfferVersion[] | null> {
    const mangrove = await ctx.prisma.mangrove.findUnique({where: {id: offerListing.mangroveId}})
    const inboundToken = await ctx.prisma.token.findUnique({where: {id: offerListing.inboundTokenId}})
    const outboundToken = await ctx.prisma.token.findUnique({where: {id: offerListing.outboundTokenId}})
    if(!mangrove || !inboundToken || !outboundToken){
      return null;
    }
    const chainId = new ChainId( mangrove.chainId );
    const mangroveId = new MangroveId(chainId, offerListing.mangroveId);
    const offerListingId =  new OfferListingId(mangroveId, { inboundToken: inboundToken.address, outboundToken: outboundToken.address } )
    return await new OfferListingUtils(ctx.prisma).getMatchingOfferFromOfferListingId(offerListingId, time);

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
  async takerGotInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerGotNumber,
      findOutboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGaveInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerGaveNumber,
      findInboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerPaidPriceInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.takerPaidPrice,
      findInboundTokenFromTakenOfferOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async makerPaidPriceInUsd(
    @Root() takenOffer: TakenOffer,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      takenOffer,
      takenOffer.makerPaidPrice,
      findOutboundTokenFromTakenOfferOrFail,
      ctx
    );
  }
}

@Resolver((of) => MangroveOrder)
export class CustomMangroveOrderFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async takerWantsInUsd(
    @Root() order: MangroveOrder,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerWantsNumber,
      findOutboundTokenFromMangroveOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGivesInUsd(
    @Root() order: MangroveOrder,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.takerGivesNumber,
      findInboundTokenFromMangroveOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async totalFeeInUsd(
    @Root() order: MangroveOrder,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      order,
      order.totalFeeNumber,
      findOutboundTokenFromMangroveOrderOrFail,
      ctx
    );
  }


  @FieldResolver((type) => MangroveOrderVersion, { nullable: true })
  async currentVersion(
    @Root() mangroveOrder: MangroveOrder,
    @Ctx() ctx: Context
  ): Promise<MangroveOrderVersion | null> {
    return await ctx.prisma.mangroveOrderVersion.findUnique({
      where: { id: mangroveOrder.currentVersionId },
    });
  }

}

@Resolver((of) => MangroveOrderVersion)
export class CustomMangroveOrderVersionFieldsResolver {
  @FieldResolver((type) => Number, { nullable: true })
  async takerGotInUsd(
    @Root() order: MangroveOrderVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      await findMangroveOrderFromMangroveOrderVersion(order, ctx.prisma),
      order.takerGotNumber,
      findOutboundTokenFromMangroveOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async takerGaveInUsd(
    @Root() order: MangroveOrderVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      await findMangroveOrderFromMangroveOrderVersion(order, ctx.prisma),
      order.takerGaveNumber,
      findInboundTokenFromMangroveOrderOrFail,
      ctx
    );
  }

  @FieldResolver((type) => Number, { nullable: true })
  async priceInclFeeInUsd(
    @Root() order: MangroveOrderVersion,
    @Ctx() ctx: Context
  ): Promise<number | undefined> {
    return amountFieldToUsd(
      await findMangroveOrderFromMangroveOrderVersion(order, ctx.prisma),
      order.price,
      findInboundTokenFromMangroveOrderOrFail,
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

async function findMangroveOrderFromMangroveOrderVersion(
  mangroveOrderVersion: MangroveOrderVersion,
  prisma: PrismaClient
): Promise<MangroveOrder> {
  const mangroveOrder = await prisma.mangroveOrder.findUnique({
    where: { id: mangroveOrderVersion.mangroveOrderId },
  });
  if (!mangroveOrder) {
    throw Error(
      `Cannot find MangroveOrder from the MangroveOrder id '${mangroveOrderVersion.mangroveOrderId}`
    );
  }
  return mangroveOrder;
}

async function findOutboundTokenFromOfferVersionOrFail(
  offerVersion: OfferVersion,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.offer
    .findUnique({
      where: { id: offerVersion.offerId },
    })
    .offerListing()
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
    .offerListing()
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
    .offerListing()
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
    .offerListing()
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
    .offerListing()
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
    .offerListing()
    .inboundToken();
  if (!inboundToken)
    throw Error(`Cannot find inbound token from takenOffer '${takenOffer.id}'`);
  return inboundToken;
}

async function findOutboundTokenFromMangroveOrderOrFail(
  mangroveOrder: MangroveOrder,
  prisma: PrismaClient
): Promise<Token> {
  const outboundToken = await prisma.mangroveOrder
    .findUnique({
      where: { id: mangroveOrder.id },
    })
    .offerListing()
    .outboundToken();
  if (!outboundToken)
    throw Error(
      `Cannot find outbound token from mangroveOrder '${mangroveOrder.id}'`
    );
  return outboundToken;
}

async function findInboundTokenFromMangroveOrderOrFail(
  mangroveOrder: MangroveOrder,
  prisma: PrismaClient
): Promise<Token> {
  const inboundToken = await prisma.mangroveOrder
    .findUnique({
      where: { id: mangroveOrder.id },
    })
    .offerListing()
    .inboundToken();
  if (!inboundToken)
    throw Error(
      `Cannot find inbound token from mangroveOrder '${mangroveOrder.id}'`
    );
  return inboundToken;
}
