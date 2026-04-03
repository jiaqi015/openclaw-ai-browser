import fs from "node:fs/promises";
import path from "node:path";
import {
  getOpenClawTransportContext,
  resolveOpenClawConfigPathFromContext,
  resolveOpenClawStateDirFromContext,
} from "./OpenClawTransportContext.mjs";

export class OpenClawConfig {
  constructor(raw) {
    this.raw = raw ?? {};
    this.gateway = this.raw.gateway ?? {};
    this.agents = this.raw.agents ?? { list: [], defaults: {} };
    this.version = this.raw.version ?? 1;
  }

  getGatewayEndpoint() {
    const port = Number(this.gateway?.port ?? 18789);
    const bind = `${this.gateway?.bind ?? "loopback"}`.trim() || "loopback";
    const host =
      bind === "loopback" || bind === "127.0.0.1" || bind === "::1"
        ? "127.0.0.1"
        : bind;
    return { host, port, url: `http://${host}:${port}/v1/chat/completions` };
  }

  getGatewayAuthHeaders() {
    const authMode = `${this.gateway?.auth?.mode ?? "none"}`.trim() || "none";
    if (authMode === "none") return {};
    if (authMode === "token") {
      const token = `${this.gateway?.auth?.token ?? ""}`.trim();
      if (!token) throw new Error("OpenClaw Gateway token 配置为空");
      return { Authorization: `Bearer ${token}` };
    }
    throw new Error(`不支持的 Gateway 鉴权模式：${authMode}`);
  }

  getConfiguredAgents() {
    return Array.isArray(this.agents?.list) ? this.agents.list : [];
  }

  getAgentRecord(agentId) {
    return this.getConfiguredAgents().find((agent) => agent?.id === agentId) ?? null;
  }

  getPrimaryAgentId() {
    return this.getConfiguredAgents()[0]?.id ?? "main";
  }

  getDefaultModel(agentId) {
    const agent = this.getAgentRecord(agentId);
    let rawModel = null;
    if (typeof agent?.model === "string" && agent.model.trim()) {
      rawModel = agent.model.trim();
    } else if (typeof agent?.model?.primary === "string" && agent.model.primary.trim()) {
      rawModel = agent.model.primary.trim();
    }
    if (!rawModel && this.agents?.defaults?.model) {
      if (typeof this.agents.defaults.model === "string") {
        rawModel = this.agents.defaults.model.trim();
      } else if (typeof this.agents.defaults.model?.primary === "string") {
        rawModel = this.agents.defaults.model.primary.trim();
      }
    }
    return rawModel || "";
  }

  isChatCompletionsEnabled() {
    return this.gateway?.http?.endpoints?.chatCompletions?.enabled === true;
  }

  setChatCompletionsEnabled() {
    if (!this.gateway.http) this.gateway.http = {};
    if (!this.gateway.http.endpoints) this.gateway.http.endpoints = {};
    this.gateway.http.endpoints.chatCompletions = { enabled: true };
  }
}

let cachedConfig = null;
let lastReadAt = 0;
const CACHE_TTL = 5000;

export function resolveOpenClawConfigPath() {
  return resolveOpenClawConfigPathFromContext(getOpenClawTransportContext());
}

export function resolveOpenClawStateDir() {
  return resolveOpenClawStateDirFromContext(getOpenClawTransportContext());
}

export async function getOpenClawConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastReadAt < CACHE_TTL) {
    return cachedConfig;
  }

  const configPath = resolveOpenClawConfigPath();
  let raw = null;
  try {
    const content = await fs.readFile(configPath, "utf8");
    raw = JSON.parse(content);
  } catch {
    raw = {};
  }

  cachedConfig = new OpenClawConfig(raw);
  lastReadAt = now;
  return cachedConfig;
}

export async function invalidateConfigCache() {
  cachedConfig = null;
  lastReadAt = 0;
}

export async function writeOpenClawConfig(config) {
  const configPath = resolveOpenClawConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  await invalidateConfigCache();
}

export async function readRawConfig() {
  const configPath = resolveOpenClawConfigPath();
  try {
    const content = await fs.readFile(configPath, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
