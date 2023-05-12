import {
  OfferListing,
  OfferVersion,
  TakenOffer,
  Token
} from "@generated/type-graphql";
import { PrismaClient } from "@prisma/client";
import { Arg, Ctx, Query, Resolver } from "type-graphql";

// At most re-fetch once per 1000 ms for each token
import BigNumber from "bignumber.js";
import { GraphQLError } from "graphql";
import { MemoryCache, fetchBuilder } from "node-fetch-cache";
import { AccountId, ChainId, KandelId } from "src/state/model";
import { KandelReturnUtils } from "src/utils/KandelReturnUtils";
import { fromBigNumber, getFromBigNumber } from "src/utils/numberUtils";
import { KandelDepositWithdraw, KandelFailedOffer, KandelFill, KandelOffer, KandelParameter, KandelPopulateRetract, KandelStrategy } from "./kandelObjects";
import { MangroveOrderFillWithTokens, MangroveOrderOpenOrder } from "./mangroveOrderObjects";
const fetch = fetchBuilder.withCache(new MemoryCache({ ttl: 1000 }));
async function fetchTokenPriceIn(token: Token, inSymbol: string) {
  return (await fetch(
    `https://min-api.cryptocompare.com/data/price?fsym=${token.symbol}&tsyms=${inSymbol}`
  )
    .then((response: any) => response.json())
    .then((json: any) => json[inSymbol])
    .catch(() => undefined)) as number;
}

type Context = {
  prisma: PrismaClient;
};

const kandelReturnUtils = new KandelReturnUtils();

@Resolver()
export class KandelManageStrategyPageResolver {

  @Query(() => [KandelOffer])
  async kandelOffers(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Ctx() ctx: Context
  ): Promise<KandelOffer[]> {
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const kandel = await ctx.prisma.kandel.findUnique({
      where: {
        id: kandelId.value
      },
      select: {
        strat: {
          include: {
            offers: {
              where: {
                currentVersion: {
                  deleted: false
                }
              },
              include: {
                currentVersion: true,
                kandelOfferIndexes: true,
                offerVersions: {
                  where: {
                    versionNumber: 0
                  },
                  include: {
                    tx: true
                  }
                }
              }
            }
          }
        },
        baseToken: true,
        quoteToken: true,
      }
    })
    if (!kandel) {
      throw new GraphQLError(`Cannot find kandel with address: ${address} and chain: ${chain}`);
    }
    return kandel.strat.offers.map(offer => new KandelOffer({
        gives: offer.currentVersion?.gives ?? "0",
        wants: offer.currentVersion?.wants ?? "0",
        index: offer.kandelOfferIndexes?.index ?? 0,
        base: kandel.baseToken,
        quote: kandel.quoteToken,
        offerId: offer.offerNumber,
        live: offer.currentVersion?.deleted ? false : true,
        price: (offer.kandelOfferIndexes?.ba == "ask" ? offer.currentVersion?.takerPaysPrice : offer.currentVersion?.makerPaysPrice) ?? 0,
        gasreq: offer.currentVersion?.gasreq ?? 0,
        gasprice: offer.currentVersion?.gasprice ?? 0,
        BA: offer.kandelOfferIndexes?.ba ?? "",
        initialTxHash: offer.offerVersions[0].tx?.txHash ?? "",
      }));

  }

}

@Resolver()
export class MangroveOrderResolver {

  @Query(() => [MangroveOrderOpenOrder])
  async mangroveOrderOpenOrders(
    @Arg("taker") taker: string,
    @Arg("mangrove") mangrove: string,
    @Arg("chain") chain: number,
    @Arg("token1") token1: string,
    @Arg("token2") token2: string,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<MangroveOrderOpenOrder[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const mangroveOrders = await ctx.prisma.mangroveOrder.findMany({
      take, skip,
      where: {
        mangrove: { address: { contains: mangrove.toLowerCase(), mode: 'insensitive' }, chainId: chain },
        taker: { address: { contains: taker.toLowerCase(), mode: 'insensitive' } },
        order: {
          offerListing: {
            inboundToken: {
              OR: [{
                address: {
                  contains: token1.toLowerCase(),
                  mode: 'insensitive'
                }

              },
              {
                address: {
                  contains: token2.toLowerCase(),
                  mode: 'insensitive'
                }
              }],
            },
            outboundToken: {
              OR: [{
                address: {
                  contains: token1.toLowerCase(),
                  mode: 'insensitive'
                }
              },
              {
                address: {
                  contains: token2.toLowerCase(),
                  mode: 'insensitive'
                }
              }]
            }
          }
        }
      },
      include: {
        currentVersion: true,
        offer: { include: { currentVersion: { include: { takenOffer: true, OfferRetractEvent: true } }, offerVersions: { include: { takenOffer: true } } } },
        order: { include: { tx: true } },
        taker: true,
        offerListing: { include: { inboundToken: true, outboundToken: true } }
      }, orderBy: [
        { hasRestingOrder: "desc" },
        { offer: { currentVersion: { isRetracted: "asc" } } },
        { offer: { currentVersion: { takenOffer: { failReason: { sort: "desc", nulls: "first" } } } } },
        { offer: { currentVersion: { takenOffer: { fullyTaken: { sort: "desc", nulls: "first" } } } } },
        { currentVersion: { expiryDate: "desc" } },
        { order: { tx: { time: "desc" } } },
      ]
    })

    return mangroveOrders.map(m => {
      const takerGot = this.getTakerGot(m.offer?.offerVersions.map(v => v.takenOffer), new BigNumber(m.order.takerGot));
      const takerGave = this.getTakerGave(m.offer?.offerVersions.map(v => v.takenOffer), new BigNumber(m.order.takerGave));
      const expiryDate = m.currentVersion?.expiryDate.getTime() == new Date(0).getTime() ? undefined : m.currentVersion?.expiryDate;
      const takerGotPlusFee = takerGot.plus(m.totalFee)
      const status = this.getStatus(expiryDate, m.offer?.currentVersion, new BigNumber(m.takerWants), takerGotPlusFee);
      return new MangroveOrderOpenOrder({
        mangroveOrderId: m.id,
        isBuy: m.fillWants ? true : false,
        isOpen: m.currentVersion ? status == "Open" : true,
        offerId: m.offer?.offerNumber,
        taker: m.taker.address,
        inboundToken: m.offerListing.inboundToken,
        outboundToken: m.offerListing.outboundToken,
        price: this.getPrice(takerGot, takerGave, m.offerListing, m.fillWants),
        status: status,
        isFailed: this.getIsFailed(m.offer?.currentVersion?.takenOffer?.failReason),
        isFilled: takerGotPlusFee.gte(m.takerWants),
        failedReason: m.offer?.currentVersion?.takenOffer?.failReason ?? undefined,
        expiryDate: expiryDate,
        filled: this.getOpenOrderFiled(takerGot, takerGave, m.offerListing, m.fillWants),
        date: m.order.tx.time,
        amount: m.fillWants ? m.takerWantsNumber : m.takerGivesNumber,
        txHash: m.order.tx.txHash
      })
    }
    );
  }



  private getOpenOrderFiled(takerGot: BigNumber, takerGave: BigNumber, offerListing: { inboundToken: Token, outboundToken: Token }, fillWants: boolean): number | undefined {
    if (!fillWants) {
      return getFromBigNumber({ value: takerGave.toString(), token: offerListing.inboundToken }).toNumber();
    }
    return getFromBigNumber({ value: takerGot.toString(), token: offerListing.outboundToken }).toNumber();
  }

  private getPrice(takerGot: BigNumber, takerGave: BigNumber, offerListing: OfferListing, fillWants: boolean): number {
    if (takerGot.gt(0)) {
      const gave = fromBigNumber({ value: takerGave.toString(), token: offerListing.inboundToken! });
      const got = fromBigNumber({ value: takerGot.toString(), token: offerListing.outboundToken! })
      return fillWants ? gave / got : got / gave;
    }
    return 0;
  }

  private getTakerGave(takenOffers: (TakenOffer | null)[] | undefined, gaveFromOrder: BigNumber): BigNumber {
    if (takenOffers == undefined) {
      return gaveFromOrder
    }
    return takenOffers.filter(v => (v?.failReason ? v.failReason == "" : true) && !(v?.posthookFailed ?? false)).reduce((prev, current) => current == null ? prev : prev.plus(current.takerGot), new BigNumber(0)).plus(gaveFromOrder);
  }

  private getTakerGot(takenOffers: (TakenOffer | null)[] | undefined, gotFromOrder: BigNumber): BigNumber {
    if (takenOffers == undefined) {
      return gotFromOrder
    }
    return takenOffers.filter(v => (v?.failReason ? v.failReason == "" : true) && !(v?.posthookFailed ?? false)).reduce((prev, current) => current == null ? prev : prev.plus(current.takerGave), new BigNumber(0)).plus(gotFromOrder);
  }

  private getIsFailed(failReason: string | null | undefined): boolean {
    if (failReason == undefined || failReason == null) {
      return false;
    }
    return failReason != "";
  }


  private getStatus(expiryDate: Date | undefined, currentVersion: OfferVersion | null | undefined, takerWants: BigNumber, takerGotPlusFee: BigNumber): "Cancelled" | "Failed" | "Filled" | "Partial Fill" | "Open" | undefined {
    if (currentVersion == undefined || currentVersion == null) {
      return takerGotPlusFee.gte(takerWants) ? "Filled" : "Partial Fill";
    }
    const failReason = currentVersion.takenOffer?.failReason ?? undefined;
    const isFilled = takerGotPlusFee.gte(takerWants);
    const isFailed = this.getIsFailed(failReason);
    if (isFilled) {
      return "Filled"
    } else if (isFailed) {
      return "Failed"
    } else if (
      !currentVersion.OfferRetractEvent &&
      !currentVersion.deleted &&
      (expiryDate == undefined || expiryDate.getTime() >= new Date().getTime())) {
      return "Open";
    }
    if (currentVersion.OfferRetractEvent || (expiryDate && expiryDate.getTime() < new Date().getTime())) {
      return "Cancelled";
    }
    return "Partial Fill";
  }

  @Query(() => [MangroveOrderFillWithTokens])
  async mangroveOrderFills(
    @Arg("taker") taker: string,
    @Arg("mangrove") mangrove: string,
    @Arg("chain") chain: number,
    @Arg("token1") token1: string,
    @Arg("token2") token2: string,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<MangroveOrderFillWithTokens[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const prismaMangrove = await ctx.prisma.mangrove.findFirst({ where: { address: mangrove, chainId: chain } })
    const fills = await ctx.prisma.mangroveOrderFill.findMany({
      where: {
        takerId: {
          contains: new AccountId(new ChainId(chain), taker).value.toLowerCase(),
          mode: 'insensitive'
        },
        mangroveId: prismaMangrove?.id,
        offerListing: {
          inboundToken: {
            OR: [{
              address: {
                contains: token1.toLowerCase(),
                mode: 'insensitive'
              }

            },
            {
              address: {
                contains: token2.toLowerCase(),
                mode: 'insensitive'
              }
            }],
          },
          outboundToken: {
            OR: [{
              address: {
                contains: token1.toLowerCase(),
                mode: 'insensitive'
              }
            },
            {
              address: {
                contains: token2.toLowerCase(),
                mode: 'insensitive'
              }
            }]
          }
        }

      },
      include: {
        offerListing: { include: { inboundToken: true, outboundToken: true } },
        order: true,
        takenOffer: true
      },
      orderBy: { time: 'desc' },
      take, skip
    });

    return fills.map(m => {
      const hasTakenOffer = m.takenOffer != null;
      const fillsAmount = this.getFillsAmount(m.offerListing.outboundToken.address, token2, m.takerGot, m.takerGave, hasTakenOffer) ?? 0;
      const paid = this.getFillsPaid(m.offerListing.outboundToken.address, token2, m.takerGot, m.takerGave, hasTakenOffer) ?? 0;
      return new MangroveOrderFillWithTokens({
        fillsId: m.fillsId,
        txHash: m.txHash,
        totalFee: m.totalFee,
        mangroveOrderId: m.mangroveOrderId ?? undefined,
        taker: taker,
        inboundToken: m.offerListing.inboundToken,
        outboundToken: m.offerListing.outboundToken,
        price: this.getFillsPrice(m.offerListing.outboundToken.address, m.type, token2, m.takerPrice, m.makerPrice, hasTakenOffer) ?? 0,
        amount: fillsAmount,
        time: m.time,
        type: m.type,
        totalPaid: paid
      })
    }
    );
  }

  private getFillsPaid(outboundTokenAddress: string, token2: string, takerGot: number | null, takerGave: number | null, hasTakenOffer: boolean): number | null {
    const isOutboundToken = outboundTokenAddress.toLowerCase() == token2.toLowerCase();
    if (isOutboundToken) {
      return (hasTakenOffer ? takerGave : takerGot);
    }
    return (hasTakenOffer ? takerGot : takerGave);
  }

  private getFillsAmount(outboundTokenAddress: string, token2: string, takerGot: number | null, takerGave: number | null, hasTakenOffer: boolean): number | null {
    const isOutboundToken = outboundTokenAddress.toLowerCase() == token2.toLowerCase();
    if (isOutboundToken) {
      return (hasTakenOffer ? takerGot : takerGave);
    }
    return (hasTakenOffer ? takerGave : takerGot);
  }

  private getFillsPrice(outboundTokenAddress: string, type: string, token2: string, takerPrice: number | null, makerPrice: number | null, hasTakenOffer: boolean): number | null {
    const isOutboundToken = outboundTokenAddress.toLowerCase() == token2.toLowerCase();
    if (type == "Limit") {
      if (isOutboundToken) {
        return (hasTakenOffer ? takerPrice : makerPrice);
      }
      return (hasTakenOffer ? makerPrice : takerPrice);
    }
    return (isOutboundToken ? makerPrice : takerPrice);
  }
}

@Resolver()
export class KandelHomePageResolver {

  @Query(() => [KandelStrategy])
  async kandelStrategies(
    @Arg("admin") admin: string,
    @Arg("chain") chain: number,
    @Arg("mangrove") mangrove: string,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelStrategy[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandels = await ctx.prisma.kandel.findMany({
      skip, take,
      where: {
        currentVersion: { admin: { chainId: chain, address: { contains: admin.toLowerCase(), mode: "insensitive" } } },
        mangrove: { address: { contains: mangrove.toLowerCase(), mode: "insensitive" }, chainId: chain }
      },
      select: {
        strat: {
          include: {
            offers: {
              where: { 
                currentVersion: { deleted: false } }, 
                include: {
                  currentVersion: true,
                  kandelOfferIndexes: true,
                  offerVersions: {
                    where: {
                      versionNumber: 0
                    },
                    include: {
                      tx: true
                    }
                  }
                }
            }
          }
        },
        id: true,
        type: true,
        baseToken: true,
        quoteToken: true,
        reserve: {
          select: {
            address: true,
          }
        }
      }
    })

    return (await Promise.all(kandels.map(async kandel => {
      return new KandelStrategy({
        name: kandel.type,
        address: kandel.strat.address,
        reserve: kandel.reserve.address,
        base: kandel.baseToken,
        quote: kandel.quoteToken,
        return: await kandelReturnUtils.getKandelReturn(new KandelId(chainId, kandel.strat.address), ctx.prisma, (token) => fetchTokenPriceIn(token, 'USDC')),
        offers: kandel.strat.offers.map(offer => new KandelOffer({
          gives: offer.currentVersion?.gives ?? "0",
          wants: offer.currentVersion?.wants ?? "0",
          index: offer.kandelOfferIndexes?.index ?? 0,
          base: kandel.baseToken,
          quote: kandel.quoteToken,
          offerId: offer.offerNumber,
          live: offer.currentVersion?.deleted ? false : true,
          price: (offer.kandelOfferIndexes?.ba == "ask" ? offer.currentVersion?.takerPaysPrice : offer.currentVersion?.makerPaysPrice) ?? 0,
          gasreq: offer.currentVersion?.gasreq ?? 0,
          gasprice: offer.currentVersion?.gasprice ?? 0,
          BA: offer.kandelOfferIndexes?.ba ?? "",
          initialTxHash: offer.offerVersions[0]?.tx.txHash ?? "",
        }))
      });
    })));
  }

  @Query(() => KandelStrategy)
  async kandelStrategy(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Ctx() ctx: Context
  ): Promise<KandelStrategy> {
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const kandel = await ctx.prisma.kandel.findUnique({
      where: {
        id: kandelId.value
      },
      select: {
        strat: {
          include: {
            offers: {
              where: {
                currentVersion: {
                  deleted: false
                }
              },
              include: {
                currentVersion: true,
                kandelOfferIndexes: true,
                offerVersions: {
                  where: {
                    versionNumber: 0
                  },
                  include: {
                    tx: true
                  }
                }
              }
            }
          }
        },
        id: true,
        type: true,
        baseToken: true,
        quoteToken: true,
        reserve: {
          select: {
            address: true,
          }
        }
      }
    })
    if (!kandel) {
      throw new GraphQLError(`Cannot find kandel with address: ${address} and chain: ${chain}`);
    }
    return new KandelStrategy({
      name: kandel.type,
      address: kandel.strat.address,
      reserve: kandel.reserve.address,
      base: kandel.baseToken,
      quote: kandel.quoteToken,
      return: await kandelReturnUtils.getKandelReturn(new KandelId(chainId, kandel.strat.address), ctx.prisma, (token) => fetchTokenPriceIn(token, 'USDC')),
      offers: kandel.strat.offers.map(offer => new KandelOffer({
        gives: offer.currentVersion?.gives ?? "0",
        wants: offer.currentVersion?.wants ?? "0",
        index: offer.kandelOfferIndexes?.index ?? 0,
        base: kandel.baseToken,
        quote: kandel.quoteToken,
        offerId: offer.offerNumber,
        live: offer.currentVersion?.deleted ? false : true,
        price: (offer.kandelOfferIndexes?.ba == "ask" ? offer.currentVersion?.takerPaysPrice : offer.currentVersion?.makerPaysPrice) ?? 0,
        gasreq: offer.currentVersion?.gasreq ?? 0,
        gasprice: offer.currentVersion?.gasprice ?? 0,
        BA: offer.kandelOfferIndexes?.ba ?? "",
        initialTxHash: offer.offerVersions[0]?.tx.txHash ?? "",
      }))
    });
  }
}

@Resolver()
export class KandelHistoryResolver {

  @Query(() => [KandelFill])
  async kandelFills(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelFill[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const fills = await ctx.prisma.takenOffer.findMany({
      skip, take,
      where: {
        offerVersion: {
          offer: {
            makerId: kandelId.value
          }
        },
        failReason: null
      },
      select: {
        takerGave: true,
        takerGot: true,
        order: {
          select: {
            tx: {
              select: {
                time: true
              }
            },
            offerListing: {
              select: {
                inboundToken: true,
                outboundToken: true
              }
            }
          }
        }
      },
      orderBy: {
        order: {
          tx: {
            time: 'desc'
          }
        }
      }
    });
    return fills.map(v => new KandelFill(v));
  }

  @Query(() => [KandelFailedOffer])
  async kandelFailedOffers(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelFailedOffer[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const failedOffer = await ctx.prisma.takenOffer.findMany({
      skip, take,
      where: {
        offerVersion: {
          offer: {
            makerId: kandelId.value
          }
        },
        OR: [
          { NOT: { failReason: null } }, { posthookFailed: true }]
      },
      select: {
        takerGave: true,
        takerGot: true,
        order: {
          select: {
            tx: {
              select: {
                time: true
              }
            },
            offerListing: {
              select: {
                inboundToken: true,
                outboundToken: true
              }
            }
          }
        }
      },
      orderBy: { order: { tx: { time: 'desc' } } }
    });
    return failedOffer.map(v => new KandelFailedOffer(v));
  }


  @Query(() => KandelDepositWithdraw)
  async kandelDepositWithdraw(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelDepositWithdraw[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const events = await ctx.prisma.tokenBalanceEvent.findMany({
      take, skip,
      where: {
        OR: [
          { TokenBalanceDepositEvent: { source: kandelId.value } },
          { TokenBalanceWithdrawalEvent: { source: kandelId.value } }
        ]
      },
      include: {
        TokenBalanceDepositEvent: {
          select: {
            value: true,
            tokenBalanceEvent: {
              select: {
                token: true,
                tokenBalanceVersion: {
                  select: {
                    tx: {
                      select: {
                        time: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        TokenBalanceWithdrawalEvent: {
          select: {
            value: true,
            tokenBalanceEvent: {
              select: {
                token: true,
                tokenBalanceVersion: {
                  select: {
                    tx: {
                      select: {
                        time: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        tokenBalanceVersion: {
          tx: {
            time: 'desc'
          }
        }
      }
    })
    return events.map(v => {
      if (v.TokenBalanceDepositEvent) {
        return new KandelDepositWithdraw({ ...v.TokenBalanceDepositEvent, event: "deposit" })
      } else if (v.TokenBalanceWithdrawalEvent) {
        return new KandelDepositWithdraw({ ...v.TokenBalanceWithdrawalEvent, event: "withdraw" });
      }
      throw new GraphQLError("missing deposit/withdrawal event");
    });
  }


  @Query(() => [KandelParameter])
  async kandelParameters(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelParameter[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const paramEvents = await ctx.prisma.kandelEvent.findMany({
      where: { kandelId: kandelId.value, NOT: { KandelVersion: null, OR: [{ KandelAdminEvent: null }, { KandelGasReqEvent: null }, { KandelLengthEvent: null }, { KandelRouterEvent: null }, { gasPriceEvent: null }, { compoundRateEvent: null }, { KandelGeometricParamsEvent: null }] } },
      include: {
        KandelVersion: { include: { tx: true, prevVersion: { include: { admin: true, configuration: true } } } },
        KandelAdminEvent: { select: { admin: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { admin: { select: { address: true } } } } } } } } } },
        KandelGasReqEvent: { select: { gasReq: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { configuration: { select: { gasReq: true } } } } } } } } } },
        KandelLengthEvent: { select: { length: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { configuration: { select: { length: true } } } } } } } } } },
        KandelRouterEvent: { select: { router: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { routerAddress: true } } } } } } } },
        gasPriceEvent: { select: { gasPrice: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { configuration: { select: { gasPrice: true } } } } } } } } } },
        compoundRateEvent: { select: { compoundRateBase: true, compoundRateQuote: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { configuration: { select: { compoundRateBase: true, compoundRateQuote: true } } } } } } } } } },
        KandelGeometricParamsEvent: { select: { ratio: true, spread: true, event: { select: { KandelVersion: { select: { tx: { select: { time: true } }, prevVersion: { select: { configuration: { select: { ratio: true, spread: true } } } } } } } } } }
      },
      orderBy: { KandelVersion: { tx: { time: 'desc' } } },
      take, skip
    })

    return paramEvents.map(event => {
      if (event.KandelAdminEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: event.KandelVersion?.prevVersion?.admin.address }) }, type: "admin", value: JSON.stringify(({ value: event.KandelAdminEvent.admin })) })
      } else if (event.KandelGasReqEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: event.KandelVersion?.prevVersion?.configuration.gasReq }) }, type: "gasReq", value: JSON.stringify({ value: event.KandelGasReqEvent.gasReq }) })
      } else if (event.KandelLengthEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: event.KandelVersion?.prevVersion?.configuration.length.toString() }) }, type: "length", value: JSON.stringify({ value: event.KandelLengthEvent.length.toString() }) })
      } else if (event.KandelRouterEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: event.KandelVersion?.prevVersion?.routerAddress }) }, type: "router", value: JSON.stringify({ value: event.KandelRouterEvent.router }) });
      } else if (event.gasPriceEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: event.KandelVersion?.prevVersion?.configuration.gasPrice }) }, type: "gasPrice", value: JSON.stringify({ value: event.gasPriceEvent.gasPrice }) });
      } else if (event.compoundRateEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: { base: event.KandelVersion?.prevVersion?.configuration.compoundRateBase.toString(), quote: event.KandelVersion?.prevVersion?.configuration.compoundRateQuote.toString() } }) }, type: "compoundRateBase", value: JSON.stringify({ value: { base: event.compoundRateEvent.compoundRateBase.toString(), quote: event.compoundRateEvent.compoundRateQuote.toString() } }) })
      } else if (event.KandelGeometricParamsEvent) {
        return new KandelParameter({ event: { tx: { time: event.KandelVersion?.tx.time }, prevVersion: JSON.stringify({ value: { ratio: event.KandelVersion?.prevVersion?.configuration.ratio.toString(), spread: event.KandelVersion?.prevVersion?.configuration.spread.toString() } }) }, type: "ratio", value: JSON.stringify({ value: { ratio: event.KandelGeometricParamsEvent.ratio.toString(), spread: event.KandelGeometricParamsEvent.spread.toString() } }) })
      }
    }).filter(v => v == undefined ? false : true) as KandelParameter[];


  }


  @Query(() => [KandelPopulateRetract])
  async kandelPopulateRetract(
    @Arg("address") address: string,
    @Arg("chain") chain: number,
    @Arg("take") take: number,
    @Arg("skip") skip: number,
    @Ctx() ctx: Context
  ): Promise<KandelPopulateRetract[]> {
    if (take > 100) {
      throw new GraphQLError(`Cannot take more than 100, take:${take}`)
    }
    const chainId = new ChainId(chain);
    const kandelId = new KandelId(chainId, address);
    const events = await ctx.prisma.kandelEvent.findMany({
      where: { kandelId: kandelId.value, NOT: [{ KandelVersion: null }, { OR: [{ KandelPopulateEvent: null }, { KandelRetractEvent: null }] }] },
      include: {
        KandelVersion: { include: { tx: true, prevVersion: { include: { admin: true, configuration: true } } } },
        KandelPopulateEvent: { select: { KandelOfferUpdate: { select: { offer: { select: { offerListing: { select: { outboundToken: true, inboundToken: true } } } }, gives: true } }, event: { select: { KandelVersion: { select: { tx: { select: { time: true } } } } } } } },
        KandelRetractEvent: { select: { KandelOfferUpdate: { select: { offer: { select: { offerListing: { select: { outboundToken: true, inboundToken: true } } } }, gives: true } }, event: { select: { KandelVersion: { select: { tx: { select: { time: true } } } } } } } }
      },
      orderBy: { KandelVersion: { tx: { time: 'desc' } } },
      take, skip
    })

    const { inboundToken: tokenA, outboundToken: tokenB } = events[0].KandelPopulateEvent!.KandelOfferUpdate[0].offer.offerListing;
    const retractsAndPopulates = events.map(v => {
      if (v.KandelPopulateEvent || v.KandelRetractEvent) {
        const e = (v.KandelPopulateEvent ? v.KandelPopulateEvent.KandelOfferUpdate : v.KandelRetractEvent?.KandelOfferUpdate)
        return new KandelPopulateRetract({
          tokenA,
          tokenAAmount: e?.filter(o => o.offer.offerListing.inboundToken.id === tokenA.id).map(o => o.gives).reduce((result, current) => new BigNumber(result).plus(new BigNumber(current)).toString()) ?? "0",
          tokenB,
          tokenBAmount: e?.filter(o => o.offer.offerListing.inboundToken.id === tokenB.id).map(o => o.gives).reduce((result, current) => new BigNumber(result).plus(new BigNumber(current)).toString()) ?? "0",
          date: v.KandelVersion?.tx.time,
          event: v.KandelPopulateEvent ? "populate" : "retract"
        })
      }
    });

    return retractsAndPopulates.filter(v => v == undefined ? false : true) as KandelPopulateRetract[];
  }

}
