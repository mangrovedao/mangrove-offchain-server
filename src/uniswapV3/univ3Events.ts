// http://v1.domain-events.eth-main.univ3.streams.proxima.one/

export type Univ3StreamEventPayload = Univ3Event | { tx?: TransactionRef };
export type TransactionRef = {
  blockNumber: EthNumber;
  blockHash: string;
  txHash: string;
  from: Address;
};

export type Univ3Event = FactoryEvent | PoolTx;

export type FactoryEvent = PoolCreated | OwnerChanged | FeeAmountEnabled;

export type PoolCreated = {
  type: "PoolCreated";

  poolAddress: Address;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
};

export interface OwnerChanged {
  type: "OwnerChanged";

  oldOwner: Address;
  newOwner: Address;
}

export interface FeeAmountEnabled {
  type: "FeeAmountEnabled";

  fee: number;
  tickSpacing: number;
}

export interface PoolTx {
  type: "PoolTx";

  poolAddress: string;
  event: PoolEvent;
}

export type PoolEvent = DexEvent | FlashLoanEvent | OracleEvent;

export type DexEvent = Swap | Burn | Mint | Collect | Initialize;

export type OracleEvent = IncreaseObservationCardinalityNext;

export type FlashLoanEvent = SetFeeProtocol | CollectProtocol | Flash;

export type Swap = {
  type: "Swap";

  sender: Address;
  recipient: Address;
  amount0: EthNumber;
  amount1: EthNumber;
  sqrtPriceX96: EthNumber;
  liquidity: EthNumber;
  tick: number;
};

export type Burn = {
  type: "Burn";

  owner: Address;
  tickLower: number;
  tickUpper: number;
  amount: EthNumber;
  amount0: EthNumber;
  amount1: EthNumber;
};

export type Mint = {
  type: "Mint";

  sender: Address;
  owner: Address;
  tickLower: number;
  tickUpper: number;
  amount: EthNumber;
  amount0: EthNumber;
  amount1: EthNumber;
};

export type Collect = {
  type: "Collect";

  owner: Address;
  recipient: Address;
  tickLower: number;
  tickUpper: number;
  amount0: EthNumber;
  amount1: EthNumber;
};

export type Initialize = {
  type: "Initialize";

  sqrtPriceX96: EthNumber;
  tick: number;
};

export type IncreaseObservationCardinalityNext = {
  type: "IncreaseObservationCardinalityNext";

  observationCardinalityNextOld: number;
  observationCardinalityNextNew: number;
};

export type CollectProtocol = {
  type: "CollectProtocol";

  sender: Address;
  recipient: Address;
  amount0: EthNumber;
  amount1: EthNumber;
};

export type SetFeeProtocol = {
  type: "SetFeeProtocol";

  feeProtocol0Old: number;
  feeProtocol1Old: number;
  feeProtocol0New: number;
  feeProtocol1New: number;
};

export type Flash = {
  type: "Flash";

  sender: Address;
  recipient: Address;
  amount0: EthNumber;
  amount1: EthNumber;
  paid0: EthNumber;
  paid1: EthNumber;
};

export type EthNumber = string;
export type Address = string;
