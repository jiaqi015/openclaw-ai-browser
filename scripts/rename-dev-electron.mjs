#!/usr/bin/env node
// Rename the dev Electron.app so `npm run dev` shows "Sabrina" in the
// macOS menu bar / Dock instead of "Electron".
//
// macOS reads the bold app name from the host process's CFBundleName
// (inside node_modules/electron/dist/Electron.app/Contents/Info.plist),
// which neither `app.setName()` nor a custom application menu can override.
// This script patches that Info.plist in place and re-signs the bundle with
// an ad-hoc signature so Gatekeeper still lets it launch.
//
// Idempotent: re-running after a fresh `npm install` is the intended flow
// (wired up via the `postinstall` script).

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_NAME = "Sabrina";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const electronAppPath = path.join(
  repoRoot,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
);
const infoPlistPath = path.join(electronAppPath, "Contents", "Info.plist");

function log(message) {
  console.log(`[rename-dev-electron] ${message}`);
}

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0 && !allowFail) {
    const stderr = result.stderr?.toString().trim();
    throw new Error(
      `${command} ${args.join(" ")} failed (code ${result.status}): ${stderr}`,
    );
  }
  return result;
}

function readPlistValue(key) {
  const result = run("/usr/bin/plutil", [
    "-extract",
    key,
    "raw",
    "-o",
    "-",
    infoPlistPath,
  ], { allowFail: true });
  if (result.status !== 0) return null;
  return result.stdout.toString().trim();
}

function setPlistValue(key, value) {
  run("/usr/bin/plutil", [
    "-replace",
    key,
    "-string",
    value,
    infoPlistPath,
  ]);
}

function main() {
  if (process.platform !== "darwin") {
    log("Skipping rename — only applies on macOS.");
    return;
  }
  if (!existsSync(infoPlistPath)) {
    log(`Skipping rename — Info.plist not found at ${infoPlistPath}.`);
    return;
  }

  const currentName = readPlistValue("CFBundleName");
  const currentDisplay = readPlistValue("CFBundleDisplayName");
  if (currentName === APP_NAME && currentDisplay === APP_NAME) {
    log(`Already named "${APP_NAME}", nothing to do.`);
    return;
  }

  log(`Renaming CFBundleName/CFBundleDisplayName → "${APP_NAME}"`);
  setPlistValue("CFBundleName", APP_NAME);
  setPlistValue("CFBundleDisplayName", APP_NAME);

  log("Re-signing Electron.app with ad-hoc signature…");
  const sign = run(
    "/usr/bin/codesign",
    ["--force", "--deep", "--sign", "-", electronAppPath],
    { allowFail: true },
  );
  if (sign.status !== 0) {
    log(
      `Warning: codesign failed (${sign.stderr?.toString().trim() || "unknown"}).` +
        " Electron may refuse to launch until you re-install or re-sign manually.",
    );
    return;
  }

  log("Done.");
}

try {
  main();
} catch (error) {
  console.warn(`[rename-dev-electron] Failed: ${error.message}`);
  process.exitCode = 0;
}
