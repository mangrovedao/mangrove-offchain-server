import * as prisma from "@prisma/client";
import BigNumber from "bignumber.js";
import _ from "lodash";
import { getBigNumber } from "state/handlerUtils";
import { ChainId, OfferListId, OfferListVersionId, TokenId } from "state/model";
import { DbOperations, toUpsert } from "./dbOperations";

export class OfferListOperations extends DbOperations{
    public async getOfferListTokens(
        id: OfferListId
      ): Promise<{ outboundToken: prisma.Token; inboundToken: prisma.Token }> {
        const offerList = await this.tx.offerList.findUnique({
          where: { id: id.value },
          include: {
            outboundToken: true,
            inboundToken: true,
          },
        });
        if (offerList === null) {
          throw new Error(
            `offer list ${id.value} doesn't exist - chainId=${id.mangroveId.chainId.chainlistId}, mangroveId=${id.mangroveId.value}, outboundToken=${id.offerListKey.outboundToken},  inboundToken=${id.offerListKey.inboundToken}`
          );
        }
        return {
          outboundToken: offerList!.outboundToken,
          inboundToken: offerList!.inboundToken,
        };
      }

      async getInboundOutboundTokensFromOfferList(offerListId: string) {
        const offerList = await this.tx.offerList.findUnique({
          where: { id: offerListId },
        });
        const outboundToken = await this.tx.token.findUnique({
          where: { id: offerList?.outboundTokenId },
        });
    
        const inboundToken = await this.tx.token.findUnique({
          where: { id: offerList?.inboundTokenId },
        });
        if (!outboundToken) {
          throw Error(
            `Could not find outbound token from offerListId: ${offerListId}`
          );
        }
        if (!inboundToken) {
          throw Error(
            `Could not find inbound token from offerListId: ${offerListId}`
          );
        }
        return { inboundToken, outboundToken };
      }

      async feeForThisOffer(offerListId: string, takerGot: string) {
        const offerList = await this.tx.offerList.findUnique({
          where: { id: offerListId },
        });
        const currentOfferList = await this.tx.offerListVersion.findUnique({
          where: { id: offerList?.currentVersionId },
        });
        const outbound = await this.tx.token.findUnique({
          where: { id: offerList?.outboundTokenId },
        });
        return currentOfferList && outbound
          ? getBigNumber({
              value: currentOfferList.fee ? currentOfferList.fee : "0",
              decimals: 4, // FIXME: correct?
            }).times(getBigNumber({ value: takerGot, token: outbound }))
          : new BigNumber("0");
      }

        // Add a new OfferListVersion to a (possibly new) OfferList
  public async addVersionedOfferList(
    id: OfferListId,
    tx: prisma.Transaction,
    updateFunc: (model: prisma.OfferListVersion) => void
  ) {
    let offerList: prisma.OfferList | null = await this.tx.offerList.findUnique(
      {
        where: { id: id.value },
      }
    );
    let newVersion: prisma.OfferListVersion;

    if (offerList === null) {
      const mangrove = await this.tx.mangrove.findUnique({
        where: { id: id.mangroveId.value },
      });
      const chainId = new ChainId(mangrove!.chainId);
      const inboundTokenId = new TokenId(chainId, id.offerListKey.inboundToken);
      const outboundTokenId = new TokenId(
        chainId,
        id.offerListKey.outboundToken
      );
      const newVersionId = new OfferListVersionId(id, 0);
      offerList = {
        id: id.value,
        mangroveId: id.mangroveId.value,
        outboundTokenId: outboundTokenId.value,
        inboundTokenId: inboundTokenId.value,
        currentVersionId: newVersionId.value,
      };
      newVersion = {
        id: newVersionId.value,
        offerListId: id.value,
        txId: tx.id,
        versionNumber: 0,
        prevVersionId: null,
        active: null,
        density: null,
        gasbase: null,
        fee: null,
      };
    } else {
      const oldVersionId = offerList.currentVersionId;
      const oldVersion = await this.tx.offerListVersion.findUnique({
        where: { id: oldVersionId },
      });
      if (oldVersion === null) {
        throw new Error(`Old OfferListVersion not found, id: ${oldVersionId}`);
      }
      const newVersionNumber = oldVersion.versionNumber + 1;
      const newVersionId = new OfferListVersionId(id, newVersionNumber);
      newVersion = _.merge(oldVersion, {
        id: newVersionId.value,
        versionNumber: newVersionNumber,
        prevVersionId: oldVersionId,
      });
    }

    updateFunc(newVersion);

    await this.tx.offerList.upsert(
      toUpsert(
        _.merge(offerList, {
          currentVersionId: newVersion.id,
        })
      )
    );

    await this.tx.offerListVersion.create({ data: newVersion });
  }

  public async deleteLatestOfferListVersion(id: OfferListId) {
    const offerList = await this.tx.offerList.findUnique({
      where: { id: id.value },
    });
    if (offerList === null)
      throw Error(`OfferList not found - id: ${id.value}`);

    const offerListVersion = await this.tx.offerListVersion.findUnique({
      where: { id: offerList.currentVersionId },
    });
    await this.tx.offerListVersion.delete({
      where: { id: offerList.currentVersionId },
    });

    if (offerListVersion!.prevVersionId === null) {
      await this.tx.offerList.delete({ where: { id: id.value } });
    } else {
      offerList.currentVersionId = offerListVersion!.prevVersionId;
      await this.tx.offerList.update({
        where: { id: id.value },
        data: offerList,
      });
    }
  }
}