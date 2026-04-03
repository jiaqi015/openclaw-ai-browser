import { translate, type UiLocale } from "../../shared/localization.mjs";

export type SkillFilter = "all" | "ready" | "recommended" | "missing" | "hidden";

export const FILTER_OPTION_IDS: SkillFilter[] = ["all", "ready", "recommended", "missing", "hidden"];

export function getSkillFilterOptions(locale: UiLocale): Array<{ id: SkillFilter; label: string }> {
  return FILTER_OPTION_IDS.map((id) => ({
    id,
    label: translate(locale, `skills.filter.${id}`),
  }));
}

export const BROWSER_RECOMMENDED_SKILLS = new Set([
  "summarize",
  "skill-creator",
  "obsidian",
  "things-mac",
  "nano-pdf",
  "openai-whisper",
  "github",
  "weather",
  "reading-time",
  "translate",
  "explain-code",
  "writer",
]);

export const BROWSER_UNSUITED_SKILLS = new Set([
  "claude-cli",
  "gemini-cli",
  "openai-chat",
  "chatgpt-cli",
  "zapier",
  "slack",
  "discord",
  "notion",
  "google-calendar",
  "outlook",
  "gmail",
  "apple-mail",
]);

const LOCALIZED_SKILL_SUMMARIES: Record<string, string> = {
  "1password": "管理 1Password CLI，适合读取、注入和运行密钥相关操作。",
  "apple-notes": "管理 Apple Notes 笔记，支持创建、搜索、编辑和导出。",
  "apple-reminders": "管理 Apple 提醒事项，支持新增、查询、完成和删除。",
  "bear-notes": "管理 Bear 笔记，适合记录和检索灵感与文档。",
  "blogwatcher": "监控博客和 RSS 更新，适合追踪新文章和订阅源。",
  "blucli": "控制 BluOS 设备，适合发现、播放和调节音量。",
  "camsnap": "抓取摄像头画面或短视频片段。",
  "clawhub": "搜索、安装、更新和发布 OpenClaw skill。",
  "coding-agent": "把编码任务交给外部代码代理处理，适合复杂开发工作。",
  "discord": "处理 Discord 消息和频道相关操作。",
  "eightctl": "控制 Eight Sleep 设备，查看状态并调整设置。",
  "feishu-doc": "读写飞书文档，适合创建、更新和整理文档内容。",
  "feishu-drive": "管理飞书云空间文件和文件夹。",
  "feishu-perm": "管理飞书文档和文件的权限与协作者。",
  "feishu-wiki": "浏览和管理飞书知识库内容。",
  "gemini": "调用 Gemini CLI 做问答、总结和内容生成。",
  "gh-issues": "查看 GitHub Issue，并可串联修复、提 PR 和跟进评论。",
  "gifgrep": "快速搜索和筛选 GIF 内容。",
  "github": "处理 GitHub 的 PR、Issue、CI 和代码审查。",
  "healthcheck": "做服务健康检查，适合快速确认站点或接口是否正常。",
  "mcporter": "管理和迁移 Minecraft 相关服务或资源。",
  "model-usage": "汇总模型使用情况和费用，适合看最近的模型消耗。",
  "nano-pdf": "用自然语言编辑 PDF，适合整理、修改和导出文档。",
  "notion": "读写 Notion 页面、数据库和内容块。",
  "obsidian": "读写 Obsidian 笔记库，适合把网页内容沉淀到知识库。",
  "openai-whisper": "把音频转成文字，适合会议录音、视频和语音内容。",
  "oracle": "使用 oracle CLI 处理提示词、文件打包和会话相关任务。",
  "ordercli": "查看外卖订单和配送状态。",
  "peekaboo": "抓取和自动化 macOS 界面操作。",
  "session-logs": "搜索和分析历史会话日志，方便回溯过去的对话。",
  "skill-creator": "创建、整理和改进 skill 定义文件。",
  "slack": "处理 Slack 消息、频道和互动操作。",
  "songsee": "生成音频可视化和频谱图。",
  "sonoscli": "控制 Sonos 音箱，适合播放、分组和调音量。",
  "spotify-player": "控制 Spotify 播放、搜索歌曲和切歌。",
  "summarize": "总结网页、链接、播客和本地文件内容，也适合提取视频要点。",
  "things-mac": "管理 Things 3 任务，适合把网页内容整理成待办。",
  "tmux": "操作 tmux 会话，适合驱动交互式命令行任务。",
  "video-frames": "从视频中提取画面或短片段。",
  "wacli": "处理 WhatsApp 消息和历史记录相关操作。",
  "weather": "查询天气和预报。",
  "xurl": "调用 X（Twitter）接口，适合发帖、搜索和管理内容。",
};

function containsCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function buildFallbackSkillSummary(skill: SabrinaOpenClawSkillEntry, locale: UiLocale) {
  const haystack = `${skill.name} ${skill.displayName ?? ""} ${skill.description ?? ""}`.toLowerCase();
  const isEnglish = locale === "en-US";

  if (/github|pull request|issue|ci/.test(haystack)) {
    return isEnglish
      ? "Handles GitHub workflows such as PRs, issues, and CI."
      : "处理 GitHub 相关任务，例如 PR、Issue 和 CI。";
  }
  if (/browser|chrome|playwright|web/.test(haystack)) {
    return isEnglish
      ? "Handles browser, web, or automation tasks."
      : "处理浏览器、网页或自动化相关任务。";
  }
  if (/pdf/.test(haystack)) {
    return isEnglish ? "Handles PDF-related tasks." : "处理 PDF 相关任务。";
  }
  if (/audio|speech|transcrib|whisper|voice/.test(haystack)) {
    return isEnglish
      ? "Handles speech, transcription, or audio-related tasks."
      : "处理语音、音频转写或声音相关任务。";
  }
  if (/note|obsidian|bear|wiki|doc/.test(haystack)) {
    return isEnglish
      ? "Handles notes, documents, or knowledge-base tasks."
      : "处理笔记、文档或知识库相关任务。";
  }
  if (/task|todo|things|reminder|calendar/.test(haystack)) {
    return isEnglish
      ? "Handles tasks, reminders, or calendar workflows."
      : "处理任务、待办或日程相关任务。";
  }
  if (/slack|discord|whatsapp|telegram|message|mail/.test(haystack)) {
    return isEnglish
      ? "Handles messaging, chat, or email workflows."
      : "处理消息、聊天或邮件相关任务。";
  }
  if (/weather/.test(haystack)) {
    return isEnglish ? "Looks up weather information." : "查询天气相关信息。";
  }

  return isEnglish
    ? `Used for tasks related to "${skill.displayName || skill.name}".`
    : `用于处理「${skill.displayName || skill.name}」相关任务。`;
}

export function getReadableSkillDescription(
  skill: SabrinaOpenClawSkillEntry,
  locale: UiLocale = "zh-CN",
) {
  const rawDescription = `${skill.description ?? ""}`.trim();
  if (!rawDescription) {
    return translate(locale, "skills.noDescription");
  }

  if (locale === "en-US") {
    if (!containsCjk(rawDescription)) {
      return rawDescription;
    }

    return buildFallbackSkillSummary(skill, locale);
  }

  if (containsCjk(rawDescription)) {
    return rawDescription;
  }

  return LOCALIZED_SKILL_SUMMARIES[skill.name] || buildFallbackSkillSummary(skill, locale);
}

export function filterSkillEntries(
  skills: SabrinaOpenClawSkillEntry[],
  query: string,
  statusFilter: SkillFilter,
  hiddenSkillNames: string[],
) {
  const normalizedQuery = query.trim().toLowerCase();

  return skills.filter((skill) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [
        skill.name,
        skill.displayName,
        skill.description,
        skill.source,
        skill.missingSummary,
      ]
        .filter(Boolean)
        .some((value) => `${value}`.toLowerCase().includes(normalizedQuery));

    const matchesFilter =
      statusFilter === "all" ||
      (statusFilter === "ready" && skill.ready) ||
      (statusFilter === "recommended" && BROWSER_RECOMMENDED_SKILLS.has(skill.name)) ||
      (statusFilter === "missing" && !skill.ready && Boolean(skill.missingSummary)) ||
      (statusFilter === "hidden" && hiddenSkillNames.includes(skill.name));

    return matchesQuery && matchesFilter;
  });
}
