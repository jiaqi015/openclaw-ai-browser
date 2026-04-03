import net from "node:net";
import { spawn } from "node:child_process";

function ensurePortAvailable(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      reject(error);
    });

    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

async function main() {
  try {
    await ensurePortAvailable("127.0.0.1", 3000);
  } catch {
    console.error("[dev] Port 3000 is already in use. Stop the conflicting process before starting Sabrina.");
    process.exit(1);
  }

  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(command, ["concurrently", "-k", "npm:dev:web", "npm:dev:electron"], {
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

void main();
