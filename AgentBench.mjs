/**
 * AgentBench.mjs
 * Sabrina SAP V3 感知测试基准 - 离线仿真与验证
 */

import { AXSemanticEngine } from "./runtime/browser/AXSemanticEngine.mjs";
import fs from 'fs/promises';
import path from 'path';

export class AgentBench {
  /**
   * 运行感知仿真测试
   * @param {string} snapshotName - 快照文件名 (需位于 tools/bench/snapshots)
   */
  static async simulate(snapshotPath) {
    console.log(`[Bench] Loading snapshot: ${snapshotPath}...`);
    try {
      const rawData = await fs.readFile(snapshotPath, 'utf8');
      const cdpData = JSON.parse(rawData);

      console.time("PerceptionTime");
      const result = AXSemanticEngine.parse(cdpData);
      console.timeEnd("PerceptionTime");

      console.log(`[Bench] Result: Identified ${result.elements.length} interactive elements.`);
      
      // 打印前 5 个最显眼的元素进行校验
      result.elements.slice(0, 5).forEach(el => {
        console.log(`  - [${el.index}] <${el.role}> "${el.text}" (Score: ${el.score})`);
      });

      return result;
    } catch (err) {
      console.error("[Bench] Simulation failed:", err);
    }
  }
}

// 如果直接运行脚本
if (process.argv[1].endsWith('AgentBench.mjs')) {
  const target = process.argv[2];
  if (target) {
    AgentBench.simulate(target);
  } else {
    console.log("Usage: node AgentBench.mjs <path_to_cdp_snapshot.json>");
  }
}
