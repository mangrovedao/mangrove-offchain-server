import * as prisma from "@prisma/client";
import _ from "lodash";
import { AccountId, KandelId, KandelVersionId, MangroveId, OfferId, TokenId } from "../model";
import { DbOperations, toNewVersionUpsert } from "./dbOperations";
import { AccountOperations } from "./accountOperations";
import { TokenBalanceOperations } from "./tokenBalanceOperations";


export class KandelOperations extends DbOperations {

  tokenBalanceOperations = new TokenBalanceOperations(this.tx);

  public async addVersionedKandel(params: {
    id: KandelId,
    txId: string,
    updateFunc?: (model: Omit<prisma.KandelVersion, "id" | "kandelId" | "versionNumber" | "prevVersionId">) => void,
    constParams?: {
      reserveId?: AccountId
      mangroveId: MangroveId,
      base: TokenId,
      quote: TokenId,
      type: "NewKandel" | "NewAaveKandel"
    }
  }) {
    let kandel: prisma.Kandel | null = await this.tx.kandel.findUnique({
      where: { id: params.id.value },
    });

    if (kandel && !params.updateFunc) {
      throw new Error(`You are trying to create a new version of an existing Kandel ${kandel.id}, but gave no updateFunction`)
    }

    let newVersion: prisma.KandelVersion;

    if (kandel === null) {
      if (!params.constParams?.type) {
        throw new Error(`Can't create Kandel without a type, id:${params.id.value}`);
      }
      if (params.constParams?.type == "NewAaveKandel" && !params.constParams?.reserveId?.value) {
        throw new Error(`Can't create Kandel without an reserveId, id:${params.id.value}`);
      }
      const newVersionId = new KandelVersionId({ kandelId: params.id, versionNumber: 0 });
      kandel = {
        id: params.id.value,
        mangroveId: params.constParams.mangroveId.value,
        baseId: params.constParams.base.value,
        quoteId: params.constParams.quote.value,
        reserveId: params.constParams.reserveId?.value ?? new AccountId(params.constParams.mangroveId.chainId, params.id.address).value,
        currentVersionId: newVersionId.value,
        type: params.constParams.type
      };
      newVersion = {
        id: newVersionId.value,
        kandelId: params.id.value,
        txId: params.txId,
        congigurationId: "",
        adminId: "",
        routerAddress: "",
        versionNumber: 0,
        prevVersionId: null
      };
      await new AccountOperations(this.tx).ensureAccount(params.id);
      if( params.constParams.reserveId && await this.tx.account.findUnique({where: {id:params.constParams.reserveId.value}}) ==null ){
        await this.tx.account.create({ data: {
          id: params.constParams.reserveId.value,
          chainId: params.constParams.reserveId.chainId.value,
          address: params.constParams.reserveId.address
        } });
      }

      const kandelEvent = await this.createKandelEvent(kandel,params.txId, newVersion);
      await this.createNewKandelEvent(kandelEvent);

    } else {
      const oldVersion = await this.getCurrentKandelVersion(kandel);
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new KandelVersionId({ kandelId: params.id, versionNumber: newVersionNumber });
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        txId: params.txId,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersion.id,
      });

    }
    if (params.updateFunc) {
      params.updateFunc(newVersion);
    }

    const updatedKandel = await this.tx.kandel.upsert(
      toNewVersionUpsert(kandel, newVersion.id)
    );

    const newKandelVersion = await this.tx.kandelVersion.create({ data: newVersion });
    return {kandel:updatedKandel, kandelVersion:newKandelVersion }
  }

  async createNewKandelConfiguration(configuration: Omit<prisma.KandelConfiguration, "id">) {
    return await this.tx.kandelConfiguration.create({ data: { ...configuration } })
  }

  async getCurrentKandelConfigration(kandelId: KandelId) {
    const currentVersion = await this.getCurrentKandelVersion(kandelId);
    const config = await this.tx.kandelConfiguration.findUnique({ where: { id: currentVersion.congigurationId } });
    if (!config) {
      throw new Error(`Cannot find kandel config for kandelId: ${kandelId.value}, currentVersion: ${currentVersion.id} and configId: ${currentVersion.congigurationId}`)
    }
    return config;
  }

  async getCurrentKandelVersion(idOrKandel: KandelId | prisma.Kandel): Promise<prisma.KandelVersion> {
    const id = this.getId(idOrKandel);
    const kandel = await this.tx.kandel.findUnique({ where: { id: id } })
    if (!kandel) {
      throw new Error(`Could not find kandel from id: ${id}`);
    }
    const currentVersion = await this.tx.kandelVersion.findUnique({
      where: { id: kandel.currentVersionId },
    });
    if (currentVersion === null) {
      throw new Error(`Current KandelVersion not found, currentVersionId: ${kandel.currentVersionId}`);
    }
    return currentVersion;
  }

  getId(idOrKandel: KandelId | prisma.Kandel) {
    return "id" in idOrKandel ? idOrKandel.id : (idOrKandel as KandelId).value;
  }

  public async deleteLatestKandelVersion(id: KandelId) {
    const kandel = await this.tx.kandel.findUnique({
      where: { id: id.value },
    });
    if (kandel === null) {
      throw Error(`Kandel not found - id: ${id}`);
    }

    const kandelVersion = await this.tx.kandelVersion.findUnique({
      where: { id: kandel.currentVersionId },
    });

    if (kandelVersion!.prevVersionId === null) {
      await this.tx.kandel.update({
        where: { id: id.value },
        data: {
          currentVersionId: "",
        },
      });

      await this.tx.kandelVersion.delete({
        where: { id: kandel.currentVersionId },
      });
      await this.tx.kandel.delete({ where: { id: id.value } });
    } else {
      await this.tx.kandel.update({
        where: { id: id.value },
        data: {
          currentVersionId: kandelVersion!.prevVersionId,
        },
      });
      await this.tx.kandelVersion.delete({
        where: { id: kandel.currentVersionId },
      });
    }
    await this.deleteKandelConfigIfNotUsed(kandelVersion!.congigurationId)
  }

  async deleteKandelConfigIfNotUsed(id: string) {
    const kandels = await this.tx.kandelVersion.findMany({ where: { congigurationId: id } })
    if (kandels.length == 0) {
      await this.tx.kandelConfiguration.delete({ where: { id: id } });
      return true;
    }
    return false;

  }

  async getReserveAddress(params: { kandelId: KandelId } | { kandel: prisma.Kandel }) {
    const kandel = "kandelId" in params ? await this.getKandel(params.kandelId) : params.kandel;
    const reserve = await this.tx.account.findUnique({ where: { id: kandel.reserveId } })
    if (!reserve) {
      throw new Error(`Cannot find reserve from kandel id: ${kandel.id}, with reserveId: ${kandel.reserveId}`)
    }

    return reserve.address;
  }

  async getToken(kandelId: KandelId, baseOrQuote: "baseId" | "quoteId") {
    const kandel = await this.getKandel(kandelId);
    const token = await this.tx.token.findUnique({ where: { id: kandel[baseOrQuote] } })
    if (!token) {
      throw new Error(`Cannot find base token from kandelId: ${kandelId.value}, with ${baseOrQuote}: ${kandel[baseOrQuote]}`)
    }
    return token;
  }

  async getKandel(kandelId: KandelId | string) {
    const id =typeof kandelId === "string" ? kandelId : kandelId.value;
    const kandel = await this.tx.kandel.findUnique({ where: { id: id } });
    if (!kandel) {
      throw new Error(`Cannot find kandel instance from kandel id: ${id}`)
    }
    return kandel;
  }

  async createOfferIndex(kandelId: KandelId, txId: string, offerId: OfferId, index: number, ba: "ask" | "bid") {
    return await this.tx.kandelOfferIndex.create({
      data: {
        kandelId: kandelId.value,
        txId: txId,
        offerId: offerId.value,
        index: index,
        ba: ba
      }
    })
  }

  async deleteOfferIndex(kandelId: KandelId, offerId: OfferId, ba: "ask" | "bid") {
    await this.tx.kandelOfferIndex.delete({
      where: {
        offerId_kandelId_ba: {
          kandelId: kandelId.value,
          offerId: offerId.value,
          ba: ba
        }
      }
    })
  }

  async getKandelFromOffer(offer: prisma.Offer) {
    const account = await this.tx.account.findUnique({
      where: {
        id: offer.makerId
      }
    })
    if (!account) {
      throw new Error(`Cannot find maker of offer: ${offer.id}, with makerId: ${offer.makerId}`)
    }
    const kandel = await this.tx.kandel.findFirst({
      where: {
        strat: {
          address: account.address
        }
      }
    })
    return kandel
  }

  async deleteAllKandelEventsForTransaction( kandelId: KandelId | prisma.Kandel, txId: string ){
    return await this.tx.kandelEvent.deleteMany({where: { txId: txId}})
  }

  async createKandelEvent(kandelId: KandelId | prisma.Kandel, txId: string, kandelVersionId?: KandelVersionId | prisma.KandelVersion) {
    return await this.tx.kandelEvent.create({
      data: {
        txId: txId,
        kandelId: "id" in kandelId ? kandelId.id : kandelId.value,
        kandelVersionId: kandelVersionId ? (  "id" in kandelVersionId ? kandelVersionId.id : kandelVersionId.value ) : null,
      }
    })
  }

  async createNewKandelEvent(kandelEvent: prisma.KandelEvent) {
    return await this.tx.newKandelEvent.create({
      data: {
        eventId: kandelEvent.id
      }
    })
  }

  async createKandelAdminEvent(kandelEvent: prisma.KandelEvent, admin: string) {
    return this.tx.kandelAdminEvent.create({
      data: {
        eventId: kandelEvent.id,
        admin: admin
      }
    })
  }

  async createKandelRouterEvent(kandelEvent: prisma.KandelEvent, router: string) {
    return this.tx.kandelRouterEvent.create({
      data: {
        eventId: kandelEvent.id,
        router: router
      }
    })
  }

  async createKandelGasReqEvent(kandelEvent: prisma.KandelEvent, gasReq: string) {
    return this.tx.kandelGasReqEvent.create({
      data: {
        eventId: kandelEvent.id,
        gasReq: gasReq
      }
    })
  }

  async createKandelGasPriceEvent(kandelEvent: prisma.KandelEvent, gasPrice: string) {
    return this.tx.kandelGasPriceEvent.create({
      data: {
        eventId: kandelEvent.id,
        gasPrice: gasPrice
      }
    })
  }

  async createKandelLengthEvent(kandelEvent: prisma.KandelEvent, length: number) {
    return this.tx.kandelLengthEvent.create({
      data: {
        eventId: kandelEvent.id,
        length: length
      }
    })
  }

  async createKandelGeometricParamsEvent(kandelEvent: prisma.KandelEvent, ratio: number, spread: number) {
    return this.tx.kandelGeometricParamsEvent.create({
      data: {
        eventId: kandelEvent.id,
        ratio: ratio,
        spread: spread
      }
    })
  }

  async createKandelCompoundRateEvent(kandelEvent: prisma.KandelEvent, base: number, quote: number) {
    return this.tx.kandelCompoundRateEvent.create({
      data: {
        eventId: kandelEvent.id,
        compoundRateBase: base,
        compoundRateQuote: quote
      }
    })
  }

  async createKandelUpdateOffer( event: prisma.KandelPopulateEvent | prisma.KandelRetractEvent, offerId: OfferId, gives: string ){
    return this.tx.kandelOfferUpdate.create({
      data: {
        eventId: event.id,
        offerId:offerId.value,
        gives
      }
    })
  }

  async createKandelPopulateEvent(kandelEvent: prisma.KandelEvent, tx: prisma.Transaction ) {
    const kandel = await this.getKandel(kandelEvent.kandelId);
    const balance = await this.tokenBalanceOperations.getCurrentBaseAndQuoteBalanceForAddress(kandelEvent.kandelId, kandel.baseId, kandel.quoteId, tx);
    return this.tx.kandelPopulateEvent.create({
      data: {
        eventId: kandelEvent.id,
        baseTokenId: kandel.baseId,
        quoteTokenId: kandel.quoteId,
        ...balance
      }
    })
  }

  async createKandelRetractEvent(kandelEvent: prisma.KandelEvent, tx: prisma.Transaction) {
    const kandel = await this.getKandel(kandelEvent.kandelId);
    const balance = await this.tokenBalanceOperations.getCurrentBaseAndQuoteBalanceForAddress(kandelEvent.kandelId, kandel.baseId, kandel.quoteId, tx);
    return this.tx.kandelRetractEvent.create({
      data: {
        eventId: kandelEvent.id,
        baseTokenId: kandel.baseId,
        quoteTokenId: kandel.quoteId,
        ...balance
      }
    })
  }

  async deleteRetractEventIfNoReferences( id: string ){
    const offerVersion = await this.tx.offerVersion.findFirst({where: { kandelRetractEventId: id}})
    if( !offerVersion) {
      const retractEvent = await this.tx.kandelRetractEvent.findUnique({where: { id:id}});
      if( !retractEvent) {
        throw new Error( `Cannot fund retract event to delete: id: ${id}`)
      }
      await this.tx.kandelEvent.delete({where: { id: retractEvent?.eventId}});
    }
  }

  async deletePopulateEventIfNoReferences( id: string ){
    const offerVersion = await this.tx.offerVersion.findFirst({where: { kandelPopulateEventId: id}});
    if( !offerVersion) {
      const populateEvent = await this.tx.kandelPopulateEvent.findUnique({where: { id:id}});
      if( !populateEvent) {
        throw new Error( `Cannot fund populate event to delete: id: ${id}`)
      }
      await this.tx.kandelEvent.delete({where: { id: populateEvent?.eventId}});
    }
  }
}