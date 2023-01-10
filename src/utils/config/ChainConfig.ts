export type ChainConfig = {
  id: string,
  streams: {
    mangrove?: StreamConfing[],
    strats?: StreamConfing[],
    tokens?: StreamConfing[],
  }
  excludeMangroves: string[]
  };

export type StreamConfing = {
  streamId: string,
  offset?: string
}

  