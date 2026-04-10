/**
 * Mock Pulse for slice 1 — drives the new surface so we can iterate on tone
 * before the backend exists. Scenario: user has 3 GPU product pages open and
 * the ambient detector decided to spin up a "买 RTX 4090" workbench.
 */

import type { PulseData } from "./pulse-types";

export function buildMockGpuPulse(): PulseData {
  const now = new Date().toISOString();
  return {
    schemaVersion: "pulse.1",
    id: "pulse_demo_gpu",
    title: "帮你挑一张 RTX 4090",
    intent: "在 3 家店里挑一张 RTX 4090,看价、库存、保修",
    status: "thinking",
    plan: [
      {
        id: "step_read",
        summary: "读取你打开的 3 家店",
        status: "done",
        producedBlockIds: ["b_quote_a"],
      },
      {
        id: "step_extract",
        summary: "提取价格、显存、功耗",
        status: "done",
        producedBlockIds: ["b_stat_min", "b_stat_avg"],
      },
      {
        id: "step_verify",
        summary: "核实 3 家的实时库存",
        status: "running",
        producedBlockIds: ["b_check_stock"],
      },
      {
        id: "step_warranty",
        summary: "比较保修政策",
        status: "pending",
      },
      {
        id: "step_recommend",
        summary: "给出一个推荐",
        status: "pending",
      },
    ],
    currentStepId: "step_verify",
    layout: {
      kind: "two-col",
      blockIds: [
        "b_stat_min",
        "b_stat_avg",
        "b_note_take",
        "b_quote_a",
        "b_check_stock",
      ],
    },
    blocks: {
      b_stat_min: {
        id: "b_stat_min",
        type: "stat",
        fromStepId: "step_extract",
        label: "最低价",
        value: "¥11,999",
        delta: "↓ ¥1,000 vs 昨日",
        deltaTone: "good",
        source: {
          tabId: "tab_a",
          url: "https://store-a.example.com/gpu/4090",
          title: "Store A — RTX 4090",
        },
      },
      b_stat_avg: {
        id: "b_stat_avg",
        type: "stat",
        fromStepId: "step_extract",
        label: "三家均价",
        value: "¥12,832",
        delta: "波动 ±¥833",
        deltaTone: "neutral",
      },
      b_note_take: {
        id: "b_note_take",
        type: "note",
        fromStepId: "step_extract",
        heading: "我的判断",
        tone: "insight",
        text: "Store A 是当下最便宜的渠道,但显示\u201c仅剩 2 件\u201d,我去帮你核实一下是不是真的。Store B 价格中等但 3 年保修最长,值得放进决策。",
      },
      b_quote_a: {
        id: "b_quote_a",
        type: "quote",
        fromStepId: "step_read",
        text: "RTX 4090 现货 ¥11999,显存 24GB,TGP 450W,顺丰包邮。",
        attribution: "Store A 商品页",
        source: {
          tabId: "tab_a",
          url: "https://store-a.example.com/gpu/4090",
          title: "Store A",
        },
      },
      b_check_stock: {
        id: "b_check_stock",
        type: "checklist",
        fromStepId: "step_verify",
        title: "正在核实",
        items: [
          {
            id: "c_a",
            text: "Store A:页面写\u201c仅剩 2 件\u201d,准备点进购物车看真实库存",
            checked: false,
            action: { tool: "click_in_tab", label: "去核实", requiresConfirm: true },
          },
          {
            id: "c_b",
            text: "Store B:已确认有货,顺丰次日达",
            checked: true,
          },
          {
            id: "c_c",
            text: "Store C:页面无库存信息,需要打开\u201c配送至\u201d查询",
            checked: false,
            action: { tool: "click_in_tab", label: "去核实", requiresConfirm: true },
          },
        ],
      },
    },
    provenance: {
      sourceTabIds: ["tab_a", "tab_b", "tab_c"],
      trigger: "ambient",
    },
    createdAt: now,
    lastPulseAt: now,
  };
}
