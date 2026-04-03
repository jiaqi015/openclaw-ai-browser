import fs from "node:fs/promises";
import path from "node:path";
import {
  getOpenClawConfig,
  resolveOpenClawStateDir,
} from "./OpenClawConfigCache.mjs";
import { sabrinaBrowserAgentId } from "./OpenClawAgentBootstrapService.mjs";

export async function readPrimaryAgentWorkspaceMemory() {
  try {
    const config = await getOpenClawConfig();
    const primaryAgentId = config.getPrimaryAgentId();

    if (!primaryAgentId || primaryAgentId === sabrinaBrowserAgentId) {
      return null;
    }

    const stateDir = resolveOpenClawStateDir();
    let workspaceDir = null;

    const agentRecord = config.getAgentRecord(primaryAgentId);
    if (agentRecord?.workspace && typeof agentRecord.workspace === "string") {
      const agentWorkspace = agentRecord.workspace.trim();
      if (agentWorkspace) {
        if (path.isAbsolute(agentWorkspace)) {
          workspaceDir = agentWorkspace;
        } else {
          workspaceDir = path.join(stateDir, "workspaces", agentWorkspace);
        }
      }
    }

    if (!workspaceDir) {
      workspaceDir = path.join(stateDir, "workspace");
    }

    const candidatePaths = [
      path.join(workspaceDir, "MEMORY.md"),
      path.join(workspaceDir, "USER.md"),
      path.join(workspaceDir, "memory.md"),
      path.join(workspaceDir, "user.md"),
      path.join(workspaceDir, "context.md"),
      path.join(workspaceDir, "CLAUDE.md"),
      path.join(workspaceDir, "memory", "index.md"),
    ];

    const collected = [];
    const MAX_PER_FILE = 1200;
    const MAX_TOTAL = 2000;

    for (const filePath of candidatePaths) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        const trimmed = content.trim();
        if (trimmed.length > 20) {
          let truncated = trimmed;
          if (trimmed.length > MAX_PER_FILE) {
            truncated = `${trimmed.slice(0, MAX_PER_FILE)}\n…（内容已截断）`;
          }
          collected.push(`# ${path.basename(filePath)}\n\n${truncated}`);

          const totalLength = collected.reduce((sum, text) => sum + text.length, 0);
          if (totalLength >= MAX_TOTAL) {
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (collected.length === 0) {
      return null;
    }

    const result = collected.join("\n\n---\n\n");
    return result.length > MAX_TOTAL
      ? `${result.slice(0, MAX_TOTAL)}\n\n…（总内容已截断）`
      : result;
  } catch {
    return null;
  }
}
