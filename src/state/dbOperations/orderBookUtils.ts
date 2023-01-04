import { Offer, OfferVersion, PrismaClient } from "@prisma/client";
import { OfferId, OfferListingId, OfferVersionId } from "src/state/model";
import { OfferListingOperations } from "./offerListOperations";
import { OfferOperations } from "./offerOperations";
import { TokenOperations } from "./tokenOperations";


type Context = {
    prisma: PrismaClient;
};

export class OrderBookUtils {

    tokenOperations: TokenOperations;
    offerListOperations: OfferListingOperations;
    offerOperations: OfferOperations;

    constructor(private prisma: PrismaClient) {
        this.tokenOperations = new TokenOperations(prisma)
        this.offerListOperations = new OfferListingOperations(prisma);
        this.offerOperations = new OfferOperations(prisma);
    }


    public async getMatchingOfferFromOfferListId(offerListId: OfferListingId, time: number) {
        const offers = await this.prisma.offer.findMany({ where: { offerListingId: offerListId.value } });
        const matchingOffers: OfferVersion[] = [];
        for (const index in offers) {
            const offer = offers[index];
            const offerId = new OfferId(offerListId.mangroveId, offerListId.offerListKey, offer.offerNumber);
            const match = await this.findVersionMatchingTime(time, offer, offerId);
            if (match) {
                matchingOffers.push(match);
            }
        }
        return matchingOffers;
    }

    private async findVersionMatchingTime(time: number, offer: Offer, offerId: OfferId): Promise<OfferVersion | null> {
        const currentVersion = await this.prisma.offerVersion.findUnique({ where: { id: offer.currentVersionId } })
        if (!currentVersion) {
            return null;
        }
        let correctVersion: OfferVersion | null = null;
        for (let i = 0; i <= currentVersion.versionNumber; i++) {
            const versionId = new OfferVersionId(offerId, i);
            const thisVersion = await this.prisma.offerVersion.findUnique({ where: { id: versionId.value } })
            if (!thisVersion) {
                return null;
            }
            const thisTransaction = await this.prisma.transaction.findUnique({ where: { id: thisVersion.txId } });
            if (!thisTransaction) {
                return null;
            }
            if (thisTransaction.time.getTime() > time) {
                return correctVersion;
            } else {
                correctVersion = thisVersion;
            }
        }
        return correctVersion;
    }
}