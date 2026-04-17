import fs from 'fs/promises';
import path from 'path';

/**
 * SabrinaExperienceService.mjs
 * 负责 Agent 的“经验沉淀”。
 */
export class SabrinaExperienceService {
  constructor(storagePath) {
    this.storagePath = storagePath || path.join(process.cwd(), 'openclaw-experience.json');
    this.experienceMap = {};
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;
    try {
      const data = await fs.readFile(this.storagePath, 'utf8');
      this.experienceMap = JSON.parse(data);
      this.isLoaded = true;
    } catch (err) {
      this.experienceMap = {};
      this.isLoaded = true;
    }
  }

  async save() {
    try {
      await fs.writeFile(this.storagePath, JSON.stringify(this.experienceMap, null, 2));
    } catch (err) {
      console.error("[Experience] Failed to save experience:", err);
    }
  }

  /**
   * 记录一次成功的经验
   */
  async recordSuccess(domain, taskType, strategyTip) {
    await this.load();
    if (!this.experienceMap[domain]) this.experienceMap[domain] = {};
    
    // 简单地存储最新的成功提示 (后续可以改进为 TOP-N 频率统计)
    this.experienceMap[domain][taskType] = {
      tip: strategyTip,
      lastUpdated: Date.now(),
      successCount: (this.experienceMap[domain][taskType]?.successCount || 0) + 1
    };
    await this.save();
  }

  /**
   * 获取当前域的相关经验
   */
  async getExperience(domain) {
    await this.load();
    return this.experienceMap[domain] || null;
  }
}

export const experienceService = new SabrinaExperienceService();
