import BigNumber from "bignumber.js";

export function getBigNumber(
  params: { value: string } & (
    | { token: { decimals: number } }
    | { decimals: number }
  )
) {
  return new BigNumber(params.value).shiftedBy(
    "token" in params ? -params.token.decimals : -params.decimals
  );
}

export function getNumber(
  params: { value: string } & (
    | { token: { decimals: number } }
    | { decimals: number }
  )
) {
  return getBigNumber(params).toNumber();
}
export function getPrice(gave: number, got: number) {
  return gave / got;
}

export function addNumberStrings(
  params: { value1: string; value2: string } & (
    | { token: { decimals: number } }
    | { decimals: number }
  )
) {
  if ("token" in params) {
    return getBigNumber({ value: params.value1, token: params.token })
      .plus(getBigNumber({ value: params.value2, token: params.token }))
      .toFixed();
  }
  return getBigNumber({ value: params.value1, decimals: params.decimals })
    .plus(getBigNumber({ value: params.value2, decimals: params.decimals }))
    .toFixed();
}
