import { useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";

function toUserFriendlyOpenClawError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /gateway|econnrefused|无法连接|not reachable|network|fetch failed|超时|timeout/i.test(message)
  ) {
    return "OpenClaw 当前不可用，请先确认本机龙虾已经连接并可访问。";
  }
  if (/消息不能为空|missing/i.test(message)) {
    return "当前技能缺少可翻译的说明。";
  }
  return message || "OpenClaw 暂时无法完成这次翻译。";
}

export function useSkillTranslation() {
  const [translatedBySkillName, setTranslatedBySkillName] = useState<Record<string, string>>({});
  const [translateErrorsBySkillName, setTranslateErrorsBySkillName] = useState<Record<string, string>>({});
  const [translatingBySkillName, setTranslatingBySkillName] = useState<Record<string, boolean>>({});

  async function handleTranslateSkill(skill: SabrinaOpenClawSkillEntry) {
    const desktop = getSabrinaDesktop();
    if (!desktop?.openclaw?.runLocalAgent) {
      setTranslateErrorsBySkillName((current) => ({
        ...current,
        [skill.name]: "当前环境暂不支持通过 OpenClaw 生成翻译说明。",
      }));
      return;
    }

    setTranslatingBySkillName((current) => ({ ...current, [skill.name]: true }));
    setTranslateErrorsBySkillName((current) => {
      const next = { ...current };
      delete next[skill.name];
      return next;
    });

    try {
      const response = await desktop.openclaw.runLocalAgent({
        sessionId: `skills-translate:${skill.name}`,
        thinking: "low",
        message: [
          "你是 Sabrina 浏览器里的技能说明助手。",
          "请把下面这个 OpenClaw skill 的说明整理成更容易看懂的中文。",
          "输出要求：",
          "1. 只输出两段，每段单独一行。",
          "2. 第一行以“摘要：”开头，用一句中文说清这个 skill 是干什么的。",
          "3. 第二行以“翻译：”开头，把原始说明翻成自然中文。",
          "4. 不要输出项目符号、前言、结语或英文解释。",
          "",
          `技能名：${skill.displayName || skill.name}`,
          `标识：${skill.name}`,
          skill.source ? `来源：${skill.source}` : "",
          `原始说明：${skill.description || "（空）"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });

      setTranslatedBySkillName((current) => ({
        ...current,
        [skill.name]: response.text.trim() || "摘要：暂无结果\n翻译：OpenClaw 没有返回可显示内容。",
      }));
    } catch (error) {
      setTranslateErrorsBySkillName((current) => ({
        ...current,
        [skill.name]: toUserFriendlyOpenClawError(error),
      }));
    } finally {
      setTranslatingBySkillName((current) => ({ ...current, [skill.name]: false }));
    }
  }

  return {
    translatedBySkillName,
    translateErrorsBySkillName,
    translatingBySkillName,
    handleTranslateSkill,
  };
}
