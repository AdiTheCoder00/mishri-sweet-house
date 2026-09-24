/* Runs the real serve.js with the outside services mocked (see harness.mjs),
   for the browser tests. PORT picks the port; STORAGE=1 turns on the
   in-memory Upstash so the site runs as the live shop instead of the demo. */
import { createRequire } from "node:module";
import path from "node:path";
import { ROOT, STORAGE_ENV, setEnv } from "./harness.mjs";

if (process.env.STORAGE === "1") setEnv(STORAGE_ENV);
process.chdir(ROOT);
createRequire(import.meta.url)(path.join(ROOT, "serve.js"));
