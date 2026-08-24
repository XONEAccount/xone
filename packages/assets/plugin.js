import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the shared XOne favicon. */
export const FAVICON_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "favicon.ico",
);

/**
 * Serves `/favicon.ico` in Vite dev and copies it into the build output
 * so every frontend app shares the same brand icon.
 *
 * @returns {import("vite").Plugin}
 */
export function sharedFavicon() {
  const source = fs.readFileSync(FAVICON_PATH);

  return {
    name: "shared-favicon",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/favicon.ico") {
          next();
          return;
        }
        res.setHeader("Content-Type", "image/x-icon");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(source);
      });
    },
    writeBundle(options) {
      if (!options.dir) {
        return;
      }
      fs.writeFileSync(path.join(options.dir, "favicon.ico"), source);
    },
  };
}
