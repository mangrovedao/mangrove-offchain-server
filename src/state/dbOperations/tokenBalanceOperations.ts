import * as prisma from "@prisma/client";
import _ from "lodash";
import { AccountId, KandelId, TakenOfferId, TokenBalanceId, TokenBalanceVersionId, TokenId } from "../model";
import { DbOperations, toNewVersionUpsert } from "./dbOperations";
import BigNumber from "bignumber.js";


export class TokenBalanceOperations extends DbOperations {

  public async addTokenBalanceVersion(params: {
    tokenBalanceId: TokenBalanceId,
    txId: string,
    updateFunc?: (model: Omit<prisma.TokenBalanceVersion, "id" | "tokenBalanceId" | "versionNumber" | "prevVersionId">) => void,
  }) {
    let reserve: prisma.Account | null = await this.tx.account.findUnique({
      where: { id: "accountId" in params.tokenBalanceId.params ? params.tokenBalanceId.params.accountId.value: params.tokenBalanceId.params.account.id },
    });

    let tokenBalance: prisma.TokenBalance | null = await this.tx.tokenBalance.findUnique({
      where: {
        id: params.tokenBalanceId.value
      }
    })

    let newTokenBalanceVersion: prisma.TokenBalanceVersion | undefined = undefined;

    if (reserve === null) {
      if("accountId" in params.tokenBalanceId.params) {
        reserve = {
          id: params.tokenBalanceId.params.accountId.value,
          chainId: params.tokenBalanceId.params.accountId.chainId.value,
          address: params.tokenBalanceId.params.accountId.address
        };
      } else {
        reserve = {
          id: params.tokenBalanceId.params.account.id,
          chainId: params.tokenBalanceId.params.account.chainId,
          address: params.tokenBalanceId.params.account.address
        };
      }

     reserve = await this.tx.account.create( { data: {...reserve } }    );
    }

    if( tokenBalance === null ){
      const newVersionId = new TokenBalanceVersionId({ tokenBalanceId: params.tokenBalanceId, versionNumber: 0 });

      tokenBalance = {
        id: params.tokenBalanceId.value,
        accountId: reserve.id,
        tokenId: params.tokenBalanceId.params.tokenId.value,
        stream: params.tokenBalanceId.params.stream,
        currentVersionId: newVersionId.value
      }      

      newTokenBalanceVersion = {
        id: newVersionId.value,
        txId: params.txId,
        tokenBalanceId: tokenBalance.id,
        deposit: "0",
        withdrawal: "0",
        send: "0",
        received: "0",
        balance: "0",
        versionNumber: 0,
        prevVersionId: null
      }


    } else {
      const oldVersion = await this.getCurrentTokenBalanceVersion(tokenBalance);
      const newTokenBalanceVersionNumber = oldVersion.versionNumber + 1;
      const newTokenBalanceVersionId = new TokenBalanceVersionId({ tokenBalanceId: params.tokenBalanceId, versionNumber: newTokenBalanceVersionNumber });
      newTokenBalanceVersion = _.merge(oldVersion, {
        id: newTokenBalanceVersionId.value,
        txId: params.txId,
        versionNumber: newTokenBalanceVersionNumber,
        prevVersionId: oldVersion.id,
      });

    }
    if (params.updateFunc) {
      params.updateFunc(newTokenBalanceVersion);
    }



    const updatedOrNewTokenBalance= await this.tx.tokenBalance.upsert(
      toNewVersionUpsert( tokenBalance, newTokenBalanceVersion.id)
    );

    const newVersion = await this.tx.tokenBalanceVersion.create({ data: newTokenBalanceVersion });
    return {updatedOrNewTokenBalance, newVersion}
  }

  async getTokenBalance(tokenBalanceId:TokenBalanceId){
    const tokenBalance = await this.tx.tokenBalance.findUnique({where: {
      id: tokenBalanceId.value
    }})
    if(!tokenBalance){
      throw new Error(`Cannot find tokenBalance from tokenBalanceid: ${tokenBalanceId.value}`)
    }
    return tokenBalance;
  }

  async getCurrentTokenBalanceVersion(tokenBalance: prisma.TokenBalance | TokenBalanceId): Promise<prisma.TokenBalanceVersion> {
    const tokenBal = "value" in tokenBalance ? await this.getTokenBalance(tokenBalance) : tokenBalance; 
    const currentTokenBalanceVersion = await this.tx.tokenBalanceVersion.findUnique({
      where: { id: tokenBal.currentVersionId },
    });
    if (currentTokenBalanceVersion === null) {
      throw new Error(`Current TokenBalanceVersion not found, currentTokenBalanceVersionId: ${tokenBal.currentVersionId}, on TokenBalance id : ${tokenBal.id}`);
    }
    return currentTokenBalanceVersion;
  }

  getTokenBalanceId(idOrTokenBalance: TokenBalanceId | prisma.TokenBalance) {
    return "id" in idOrTokenBalance ? idOrTokenBalance.id : (idOrTokenBalance as TokenBalanceId).value;
  }


  public async getCurrentBaseAndQuoteBalanceForAddress( accountId: AccountId | string, baseId: TokenId | string, quoteId: TokenId | string, tx:{ time: Date}){
    const account = await this.tx.account.findUnique( {
      where: { 
        id: typeof accountId === "string"?  accountId : accountId.value
      },  
      include: { 
        TokenBalance: { 
          where: { 
            OR: [
              { tokenId:typeof baseId === "string"?  baseId : baseId.value }, 
              { tokenId: typeof quoteId === "string"?  quoteId : quoteId.value}
            ],
            }, 
            include: { 
              allBalances: { 
                include: { tx: true},
                where: {
                  tx: { time: { lte: tx.time } }
                },
                orderBy: [{
                  tx: { time: "desc" },
                }, 
                {
                  versionNumber: "desc"
                }],
                take: 1
              } 
            }, 
          } 
        }
      } )
    if( !account ){
      throw new Error(`Cannot find account with id: ${typeof accountId === "string"?  accountId : accountId.value }`)
    }
    const baseValue = account.TokenBalance.filter( v => v.tokenId == (typeof baseId === "string"?  baseId : baseId.value ));
    const quoteValue = account.TokenBalance.filter( v => v.tokenId == (typeof quoteId === "string"?  quoteId : quoteId.value));
    return {
      baseSend: baseValue.map( v => v.allBalances[0]?.send ?? "0").reduce( (a,b) => a.plus(b), new BigNumber(0)).toString(),
      baseReceived: baseValue.map( v => v.allBalances[0]?.received ??  "0").reduce( (a,b) => a.plus(b), new BigNumber(0)).toString(),
      quoteSend: quoteValue.map( v => v.allBalances[0]?.send ?? "0").reduce( (a,b) => a.plus(b), new BigNumber(0)).toString(),
      quoteReceived: quoteValue.map( v => v.allBalances[0]?.received ?? "0").reduce( (a,b) => a.plus(b), new BigNumber(0)).toString(),
    }
  }


  public async deleteLatestTokenBalanceVersion(id: TokenBalanceId) {
    const tokenBalance = await this.tx.tokenBalance.findUnique({
      where: { id: id.value },
    });
    if (tokenBalance === null) {
      throw Error(`TokenBalance not found - id: ${id}`);
    }

    const tokenBalanceVersion = await this.tx.tokenBalanceVersion.findUnique({
      where: { id: tokenBalance.currentVersionId },
    });


    if (tokenBalanceVersion!.prevVersionId === null) {
      await this.tx.tokenBalance.update({
        where: { id: id.value },
        data: {
          currentVersionId: "",
        },
      });
      await this.tx.tokenBalanceVersion.delete({
        where: { id: tokenBalance.currentVersionId },
      });
      await this.tx.tokenBalance.delete({ where: { id: id.value } });
    } else {
      await this.tx.tokenBalance.update({
        where: { id: id.value },
        data: {
          currentVersionId: tokenBalanceVersion!.prevVersionId,
        },
      });
      await this.tx.tokenBalanceVersion.delete({
        where: { id: tokenBalance.currentVersionId },
      });
    }
  }

  async createTokenBalanceEvent(reserveId:AccountId, tokenId: TokenId, tokenBalanceVersion:prisma.TokenBalanceVersion, takenOfferId?: TakenOfferId){
    return await this.tx.tokenBalanceEvent.create({data: {
      accountId: reserveId.value,
      tokenId: tokenId.value,
      tokenBalanceVersionId: tokenBalanceVersion.id,
      takenOfferId: takenOfferId?.value
    }})
  }

  async createTokenBalanceDepositEvent(tokenBalanceEvent: prisma.TokenBalanceEvent, value: string, source:string ){
    return await this.tx.tokenBalanceDepositEvent.create({data: {
      tokenBalanceEventId: tokenBalanceEvent.id,
      source: source,
      value: value
    }})
  }

  async createTokenBalanceWithdrawalEvent(tokenBalanceEvent: prisma.TokenBalanceEvent, value: string, source:string ){
    return await this.tx.tokenBalanceWithdrawalEvent.create({data: {
      tokenBalanceEventId: tokenBalanceEvent.id,
      source: source,
      value: value
    }})
  }

}