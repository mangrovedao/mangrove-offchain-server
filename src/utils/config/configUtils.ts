import { IConfig } from "config";

  export function getChainConfigsOrThrow<ChainConfig>(config:IConfig): ChainConfig[] {
    if (!config.has("chains")) {
      throw new Error("No chains have been configured");
    }
    const chainsConfig = config.get<Array<ChainConfig>>("chains");
    if (!Array.isArray(chainsConfig)) {
      throw new ErrorWithData(
        "Chains configuration is malformed, should be an array of ChainConfig's",
        chainsConfig
      );
    }
    return chainsConfig;
  }

  class ErrorWithData extends Error {
    public data: Object;
  
    constructor(message: string, data: Object) {
      const trueProto = new.target.prototype;
      super(message);
      Object.setPrototypeOf(this, trueProto);
      this.name = this.constructor.name;
  
      this.data = data;
    }
  }