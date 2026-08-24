import type { Plugin } from "vite";

/** Absolute path to the shared XOne favicon. */
export const FAVICON_PATH: string;

/**
 * Serves `/favicon.ico` in Vite dev and copies it into the build output
 * so every frontend app shares the same brand icon.
 *
 * @returns Vite plugin
 */
export function sharedFavicon(): Plugin;
