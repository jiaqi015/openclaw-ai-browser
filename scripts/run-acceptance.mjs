import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "acceptance", "acceptance.manifest.json");
const jsonMode = process.argv.includes("--json");

async function readManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function tailLines(input, count = 12) {
  return `${input ?? ""}`
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-count)
    .join("\n");
}

function runShellCommand(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      cwd: projectRoot,
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function formatDuration(durationMs) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

async function main() {
  const manifest = await readManifest();
  const results = [];

  for (const gate of manifest.automatedGates ?? []) {
    const result = await runShellCommand(gate.command);
    results.push({
      id: gate.id,
      label: gate.label,
      command: gate.command,
      ...result,
    });
  }

  const payload = {
    app: manifest.app,
    version: manifest.version,
    invariants: manifest.productInvariants ?? [],
    flows: manifest.criticalFlows ?? [],
    results,
    passed: results.every((result) => result.ok),
  };

  if (jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = payload.passed ? 0 : 1;
    return;
  }

  console.log("Acceptance Run");
  console.log(`App: ${manifest.app}`);
  console.log(`Invariants: ${(manifest.productInvariants ?? []).length}`);
  console.log(`Critical flows: ${(manifest.criticalFlows ?? []).length}`);
  console.log("");

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.id} (${formatDuration(result.durationMs)})`);
    console.log(`  ${result.label}`);
    console.log(`  ${result.command}`);

    const output = tailLines(`${result.stdout}\n${result.stderr}`);
    if (output) {
      console.log(output.split("\n").map((line) => `    ${line}`).join("\n"));
    }
    console.log("");
  }

  console.log(
    payload.passed
      ? "Acceptance status: PASS"
      : "Acceptance status: FAIL",
  );
  console.log("Manual flow validation pack: docs/ACCEPTANCE_MATRIX.md");
  console.log("Iteration loop and release gates: docs/ITERATION_LOOP.md");

  process.exitCode = payload.passed ? 0 : 1;
}

void main();
