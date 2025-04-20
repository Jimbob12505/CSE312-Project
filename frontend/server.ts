// server.ts
import { createRequestHandler } from "@react-router/node";

export default createRequestHandler({
  build: await import("./build/index.js"),
});

