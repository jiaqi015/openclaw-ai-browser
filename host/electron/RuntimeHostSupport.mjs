import path from "node:path";
import { app, shell } from "electron";

export function resolveUserDataFilePath(fileName) {
  return path.join(app.getPath("userData"), fileName);
}

export async function openLocalFilePath(filePath) {
  const error = await shell.openPath(filePath);
  if (error) {
    throw new Error(error);
  }
}

export function openExternalUrl(url) {
  return shell.openExternal(url);
}

export function revealLocalFilePath(filePath) {
  shell.showItemInFolder(filePath);
}
