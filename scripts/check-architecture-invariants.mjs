import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "acceptance", "acceptance.manifest.json");

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function readManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readTextFile(relativePath, cache) {
  const key = toPosix(relativePath);
  if (cache.has(key)) {
    return cache.get(key);
  }

  const absolutePath = path.join(projectRoot, relativePath);
  const contents = await fs.readFile(absolutePath, "utf8");
  cache.set(key, contents);
  return contents;
}

async function evaluateRule(rule, cache) {
  if (rule.type === "path-exists") {
    const ok = await pathExists(path.join(projectRoot, rule.path));
    return {
      ok,
      message: ok ? `${rule.id} passed` : `${rule.id} failed: missing ${rule.path}`,
    };
  }

  if (rule.type === "file-contains") {
    if (rule.allowMissing && !(await pathExists(path.join(projectRoot, rule.file)))) {
      return {
        ok: true,
        message: `${rule.id} passed (missing optional file ${rule.file})`,
      };
    }

    const contents = await readTextFile(rule.file, cache);
    const ok = contents.includes(rule.pattern);
    return {
      ok,
      message: ok
        ? `${rule.id} passed`
        : `${rule.id} failed: ${rule.file} does not contain "${rule.pattern}"`,
    };
  }

  if (rule.type === "file-not-contains") {
    if (rule.allowMissing && !(await pathExists(path.join(projectRoot, rule.file)))) {
      return {
        ok: true,
        message: `${rule.id} passed (missing optional file ${rule.file})`,
      };
    }

    const contents = await readTextFile(rule.file, cache);
    const ok = !contents.includes(rule.pattern);
    return {
      ok,
      message: ok
        ? `${rule.id} passed`
        : `${rule.id} failed: ${rule.file} still contains "${rule.pattern}"`,
    };
  }

  return {
    ok: false,
    message: `${rule.id} failed: unsupported rule type ${rule.type}`,
  };
}

async function main() {
  const manifest = await readManifest();
  const cache = new Map();
  const failures = [];

  console.log("[architecture] Checking repository invariants...");

  for (const rule of manifest.architectureRules ?? []) {
    const result = await evaluateRule(rule, cache);
    if (!result.ok) {
      failures.push({
        id: rule.id,
        reason: rule.reason,
        message: result.message,
      });
      console.error(`FAIL ${result.message}`);
      if (rule.reason) {
        console.error(`  reason: ${rule.reason}`);
      }
      continue;
    }

    console.log(`PASS ${rule.id}`);
  }

  if (failures.length > 0) {
    console.error(`[architecture] ${failures.length} invariant(s) failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`[architecture] All ${manifest.architectureRules.length} invariant(s) passed.`);
}

void main();
