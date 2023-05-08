import { Account, Kandel, MangroveOrder, TokenBalance } from "@prisma/client";

export class Id<T extends string | number> {
  public readonly value:T
  public constructor(_value: T) {
    this.value =  typeof _value === "string" ?  _value.toLowerCase() as T : _value;
   }
}

export class AccountId extends Id<string> {
  public constructor(
    public readonly chainId: ChainId,
    public readonly address: string
  ) {
    super(`${chainId.chainlistId}-${address}`);
  }
}

export class TransactionId extends Id<string> {
  public constructor(
    public readonly chainId: ChainId,
    public readonly txHash: string
  ) {
    super(`${chainId.chainlistId}-${txHash}`);
  }
}

export class ChainId extends Id<number> {
  public constructor(public readonly chainlistId: number) {
    super(chainlistId);
  }
}

export class TokenId extends Id<string> {
  public constructor(
    public readonly chainId: ChainId,
    public readonly tokenAddress: string
  ) {
    super(`${chainId.chainlistId}-${tokenAddress}`);
  }
}

// NB: Mangrove ID's in the Proxima event streams already have a chain id prefix,
// so we don't add that to the ID string as we do for other top-level entities.
export class MangroveId extends Id<string> {
  public constructor(
    public readonly chainId: ChainId,
    public readonly mangroveId: string
  ) {
    super(mangroveId);
  }
}

export class MangroveVersionId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly versionNumber: number
  ) {
    super(`${mangroveId.value}-${versionNumber}`);
  }
}

export class OfferId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly offerListKey: OfferListKey,
    public readonly offerNumber: number
  ) {
    super(
      `${mangroveId.value}-${offerListKeyShortStr(offerListKey)}-${offerNumber}`
    );
  }
}

export class OfferVersionId extends Id<string> {
  public constructor(
    public readonly offerId: OfferId,
    public readonly versionNumber: number
  ) {
    super(`${offerId.value}-${versionNumber}`);
  }
}

export class OfferListingId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly offerListKey: OfferListKey
  ) {
    super(`${mangroveId.value}-${offerListKeyShortStr(offerListKey)}`);
  }
}

export class OfferListingVersionId extends Id<string> {
  public constructor(
    public readonly offerListingId: OfferListingId,
    public readonly versionNumber: number
  ) {
    super(`${offerListingId.value}-${versionNumber}`);
  }
}

export class MakerBalanceId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly address: string
  ) {
    super(`${mangroveId.value}-${address}`);
  }
}

export class MakerBalanceVersionId extends Id<string> {
  public constructor(
    public readonly makerBalanceId: MakerBalanceId,
    public readonly versionNumber: number
  ) {
    super(`${makerBalanceId.value}-${versionNumber}`);
  }
}

export class TakerApprovalId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly offerListKey: OfferListKey,
    public readonly ownerAddress: string,
    public readonly spenderAddress: string
  ) {
    super(
      `${mangroveId.value}-${offerListKeyShortStr(
        offerListKey
      )}-${ownerAddress}-${spenderAddress}`
    );
  }
}

export class TakerApprovalVersionId extends Id<string> {
  public constructor(
    public readonly takerApprovalId: TakerApprovalId,
    public readonly versionNumber: number
  ) {
    super(`${takerApprovalId.value}-${versionNumber}`);
  }
}

export class OrderId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly offerListKey: OfferListKey,
    public readonly proximaId: string
  ) {
    super(`${mangroveId.value}-${offerListKeyShortStr(offerListKey)}-${proximaId}`);
  }
}

export class TakenOfferId extends Id<string> {
  public constructor(
    public readonly orderId: OrderId,
    public readonly offerNumber: number
  ) {
    super(`${orderId.value}-${offerNumber}`);
  }
}

function offerListKeyShortStr({
  inboundToken,
  outboundToken,
}: OfferListKey): string {
  return `${outboundToken.substring(0, 6)}x${inboundToken.substring(0, 6)}`;
}

export interface OfferListKey {
  inboundToken: string;
  outboundToken: string;
}

export class MangroveOrderId extends Id<string> {
  public constructor(
    public readonly mangroveId: MangroveId,
    public readonly offerListKey: OfferListKey,
    public readonly proximaId: string,
  ) {
    super(
      `${mangroveId.value}-${offerListKeyShortStr(offerListKey)}-${proximaId}`
    );
  }
}

export class MangroveOrderVersionId extends Id<string> {
  public constructor(
    public readonly params: (
      | {
        mangroveOrderId: MangroveOrderId;
      }
      | { mangroveOrder: MangroveOrder }
    ) & {
      versionNumber: number;
    }
  ) {
    super(
      "mangroveOrderId" in params
        ? `${params.mangroveOrderId.value}-${params.versionNumber}`
        : `${params.mangroveOrder.id}-${params.versionNumber}`
    );
  }
}

export class TokenBalanceId extends Id<string> {
  public constructor(
    public readonly params: (
      | {
        accountId: AccountId;
      }
      | { account: Account }
    ) & {
      tokenId: TokenId,
      stream: string,
    }
  ) {
    super(
      "accountId" in params
        ? `${params.accountId.value}-${params.tokenId.value}-${params.stream}`
        : `${params.account.id}-${params.tokenId.value}-${params.stream}`
    );
  }
}

export class TokenBalanceVersionId extends Id<string> {
  public constructor(
    public readonly params: (
      | {
        tokenBalanceId: TokenBalanceId;
      }
      | { tokenBalance: TokenBalance }
    ) & {
      versionNumber: number;
    }
  ) {
    super(
      "tokenBalanceId" in params
        ? `${params.tokenBalanceId.value}-${params.versionNumber}`
        : `${params.tokenBalance.id}-${params.versionNumber}`
    );
  }
}

export class KandelId extends AccountId {
  public constructor(
    public readonly chainId: ChainId,
    public readonly address: string
  ) {
    super(chainId, address);
  }
}

export class KandelVersionId extends Id<string> {
  public constructor(
    public readonly params: (
      | {
        kandelId: KandelId;
      }
      | { kandel: Kandel }
    ) & {
      versionNumber: number;
    }
  ) {
    super(
      "kandelId" in params
        ? `${params.kandelId.value}-${params.versionNumber}`
        : `${params.kandel.id}-${params.versionNumber}`
    );
  }
}
