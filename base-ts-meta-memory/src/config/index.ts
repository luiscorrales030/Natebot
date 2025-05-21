import "dotenv/config";

export const config = {
  PORT: process.env.PORT ?? 3008,
  // Meta
  jwtToken: process.env.jwtToken,
  numberId: process.env.numberId,
  verifyToken: process.env.verifyToken,
  version: "v20.0",
};