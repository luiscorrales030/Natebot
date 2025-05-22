import { MetaProvider as Provider } from "@builderbot/provider-meta";
import { createProvider } from "@builderbot/bot";
import { config } from "../config";

export const metaProvider = createProvider(Provider, {
  jwtToken: config.meta.jwtToken,
  numberId: config.meta.numberId,
  verifyToken: config.meta.verifyToken,
  version: config.meta.version,
});