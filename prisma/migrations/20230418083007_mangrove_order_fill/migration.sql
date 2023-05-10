CREATE VIEW "MangroveOrderFill" AS



Select 
"MangroveOrder"."id" as "mangroveOrderId", 
"Order"."takerGotNumber" as "takerGot", 
"Order"."takerGaveNumber" as "takerGave",
"Order"."takerPaidPrice" as "takerPrice", 
"Order"."makerPaidPrice" as "makerPrice", 
"Transaction"."txHash" as "txHash" , 
"Transaction"."time" as "time", 
"MangroveOrder"."orderId" as "fillsId", 
'Limit' as "type", 
"MangroveOrder"."takerId" as "takerId", 
"MangroveOrder"."mangroveId" as "mangroveId",
"MangroveOrder"."offerListingId" as "offerListingId",
"MangroveOrder"."totalFeeNumber" as"totalFee"
FROM "MangroveOrder"
inner Join "Order" on "Order"."id" = "MangroveOrder"."orderId"
inner join "Transaction" on "Transaction"."id" = "Order"."txId"

union

Select 
"MangroveOrder"."id" as "mangroveOrderId", 
"TakenOffer"."takerGotNumber" as "takerGot",
"TakenOffer"."takerGaveNumber" as "takerGave", 
"TakenOffer"."takerPaidPrice" as "takerPrice", 
"TakenOffer"."makerPaidPrice" as "makerPrice", 
"Transaction"."txHash" as "txHash", 
"Transaction"."time" as "time", 
"TakenOffer"."id" as "fillsId", 
'Limit' as "type", 
"MangroveOrder"."takerId" as "takerId", 
"MangroveOrder"."mangroveId" as "mangroveId",
"MangroveOrder"."offerListingId" as "offerListingId", 
'0' as "totalFee"
FROM "MangroveOrder"
inner Join "Offer" on "Offer"."id" = "MangroveOrder"."restingOrderId"
inner join "OfferVersion" on "OfferVersion"."offerId" = "Offer"."id" 
inner join "TakenOffer" on "TakenOffer"."offerVersionId" = "OfferVersion"."id"
inner join "Transaction" on "Transaction"."id" = "OfferVersion"."txId" 

union

SELECT 
NULL as "mangroveOrderId",
"Order"."takerGotNumber" as "takerGot", 
"Order"."takerGaveNumber" as "takerGave", 
"Order"."takerPaidPrice" as "takerPrice", 
"Order"."makerPaidPrice" as "makerPrice", 
"Transaction"."txHash" as "txHash",
"Transaction"."time" as "time",
"Order"."id" as "fillsId",
'MarketOrder' as "type", 
"Order"."takerId" as "takerId", 
"Order"."mangroveId" as "mangroveId", 
"Order"."offerListingId" as "offerListingId", 
"Order"."totalFeeNumber" as "totalFee"
FROM "Order"
left join "MangroveOrder" on "MangroveOrder"."orderId" = "Order"."id"
inner join "Transaction" on "Transaction"."id" = "Order"."txId"
Where "MangroveOrder"."orderId" IS NULL




