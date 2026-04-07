#!/usr/bin/env node
import { generateGenTab } from "./host/electron/GenTabIpcActionService.mjs";

const testContexts = {
  "tab-1": {
    title: "GitHub - facebook/codemod: Codemod is a tool/framework to aid large scale code migrations",
    url: "https://github.com/facebook/codemod",
    hostname: "github.com",
    leadText: "Codemod is a tool/framework to aid large scale code migrations. It allows you to make large-scale changes to many code files automatically.",
    contentPreview: "Codemod enables large-scale codebase migrations by allowing developers to write transformation rules that can be applied across thousands of files.",
    contentText: "Codemod is a tool/framework from Facebook to aid large scale code migrations. It allows developers to write automated code transformations that can be applied across an entire codebase. This is particularly useful when changing APIs or refactoring code at scale. Supports Python and JavaScript transformations.",
    selectedText: "",
    headings: ["About", "Installation", "Usage", "Examples", "Contributing"],
    sections: [
      {
        title: "About",
        summary: "Facebook 开源的大规模代码迁移工具",
      },
    ],
  },
  "tab-2": {
    title: "GitHub - github/copilot: GitHub Copilot",
    url: "https://github.com/github/copilot",
    hostname: "github.com",
    leadText: "GitHub Copilot is your AI pair programmer. It helps you write code faster and with less work.",
    contentPreview: "AI pair programmer that suggests code and whole functions in realtime right in your editor. Works with popular IDEs.",
    contentText: "GitHub Copilot is an AI pair programmer that helps you write code faster and with less work. It draws context from comments and code to suggest lines and whole functions instantly. Powered by OpenAI, integrated with VS Code, JetBrains, Neovim, and more. Provides real-time code suggestions as you type.",
    selectedText: "",
    headings: ["About", "Features", "Installation", "Supported IDEs"],
    sections: [
      {
        title: "About",
        summary: "GitHub 官方 AI 配对编程助手，由 OpenAI 提供技术支持",
      },
    ],
  },
  "tab-3": {
    title: "GitHub - sourcery-ai/sourcery: Sourcery - AI powered code refactoring",
    url: "https://github.com/sourcery-ai/sourcery",
    hostname: "github.com",
    leadText: "Sourcery is an AI-powered code refactoring tool that helps you write cleaner, better code faster.",
    contentPreview: "AI-powered code refactoring that automatically improves your code quality while you work. Suggest refactorings as you code in your IDE.",
    contentText: "Sourcery is an AI-powered code refactoring tool. It reviews your code and suggests improvements as you code. It can automatically refactor code to make it cleaner, more readable, and more maintainable. Supports Python, JavaScript, TypeScript, and works in VS Code, PyCharm, other IDEs. Focuses on code quality improvement rather than code generation.",
    selectedText: "",
    headings: ["Features", "Installation", "Supported Languages", "IDE Integrations"],
    sections: [
      {
        title: "Features",
        summary: "AI 驱动的代码重构，专注代码质量改进",
      },
    ],
  },
  "tab-4": {
    title: "GitHub - amazon-codewhisperer/codewhisperer: Amazon CodeWhisperer",
    url: "https://github.com/amazon-codewhisperer/codewhisperer",
    hostname: "github.com",
    leadText: "Amazon CodeWhisperer is an AI coding companion that helps developers build applications faster.",
    contentPreview: "AI coding companion that generates code suggestions based on your comments and existing code. Free for individual developers.",
    contentText: "Amazon CodeWhisperer is an AI coding companion from AWS that helps developers build applications faster. It generates real-time code suggestions based on your natural language comments and existing code in your IDE. Supports multiple programming languages, integrates with popular IDEs, is free for individual developers, includes built-in security scanning.",
    selectedText: "",
    headings: ["Features", "Pricing", "Supported IDEs", "Security scanning"],
    sections: [
      {
        title: "About",
        summary: "AWS 的 AI 编码助手，个人开发者免费使用",
      },
    ],
  },
  "tab-5": {
    title: "GitHub - cursor-ai/cursor: Cursor is an AI-first code editor built on VS Code",
    url: "https://github.com/cursor-ai/cursor",
    hostname: "github.com",
    leadText: "Cursor is an AI-first code editor built on top of VS Code. It's designed to help you code faster with AI.",
    contentPreview: "AI-first code editor built from the ground up with AI collaboration in mind. Chat with your codebase, refactor, and more.",
    contentText: "Cursor is an AI-first code editor based on VS Code. It's built from the ground up for AI collaboration. Features include: AI chat with your entire codebase, inline code generation, refactoring, code explanation, and more. It keeps the VS Code experience you already know but adds deep AI integration throughout the editor. Available for macOS, Windows, and Linux.",
    selectedText: "",
    headings: ["Features", "Download", "FAQ", "Contributing"],
    sections: [
      {
        title: "About",
        summary: "基于 VS Code 构建的 AI 优先代码编辑器，深度 AI 集成",
      },
    ],
  },
};

console.log("=== GenTab: AI Coding Tools Comparison ===");
console.log("Testing with 5 popular AI coding tools from GitHub");
console.log("User intent: 整理这 5 个 AI 编码工具，对比它们的定位、商业模式、主要特点、适合什么场景使用");
console.log("Preferred type: table\n");

const result = await generateGenTab(
  {
    referenceTabIds: ["tab-1", "tab-2", "tab-3", "tab-4", "tab-5"],
    userIntent: "整理这 5 个 AI 编码工具，对比它们的定位、商业模式、主要特点、适合什么场景使用",
    preferredType: "table",
    uiLocale: "zh-CN",
    assistantLocaleMode: "default",
  },
  {
    getContextSnapshotForTab: async (tabId) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      const ctx = testContexts[tabId];
      if (!ctx) {
        throw new Error(`Context not found for ${tabId}`);
      }
      return ctx;
    },
    runLocalAgentTurn: async ({ message }) => {
      console.log("\n=== Prompt to OpenClaw ==\n");
      console.log(message);
      console.log("\n=== AI Generated Result ==\n");

      const mockResponse = {
        success: true,
        gentab: {
          schemaVersion: "2",
          type: "table",
          title: "主流 AI 编码工具对比表",
          description: "5 个热门 AI 编码辅助工具对比，涵盖代码生成、重构、编辑器、大规模迁移等不同定位",
          insights: [
            "定位分化明显，从代码建议到完整编辑器各有侧重",
            "免费选项增多，Amazon CodeWhisperer 对个人免费",
            "VS Code 生态是主流，Cursor 基于 VS Code 深度重构",
            "更多工具专注特定场景而非通用编码",
            "AI 正在从代码生成向重构和质量保证延伸"
          ],
          suggestedPrompts: [
            "哪个工具对个人开发者最划算？",
            "我应该用 AI 编辑器还是插件？",
            "这些工具都支持哪些编程语言？",
            "推荐最适合开源项目的方案"
          ],
          items: [
            {
              id: "codemod",
              title: "Codemod",
              description: "大规模代码迁移自动化工具",
              sourceUrl: "https://github.com/facebook/codemod",
              sourceTitle: "GitHub - facebook/codemod",
              fields: {
                定位: "代码迁移工具",
                公司: "Meta",
                商业模式: "开源免费",
                核心能力: "大规模代码库自动化迁移",
                适合场景: "API 升级、框架迁移批量改造"
              }
            },
            {
              id: "copilot",
              title: "GitHub Copilot",
              description: "AI 配对编程助手（IDE 插件）",
              sourceUrl: "https://github.com/github/copilot",
              sourceTitle: "GitHub - github/copilot",
              fields: {
                定位: "实时编码建议",
                公司: "Microsoft/GitHub",
                商业模式: "付费订阅 ($10/月)",
                核心能力: "实时代码建议、函数生成",
                适合场景: "日常编码、快速原型"
              }
            },
            {
              id: "sourcery",
              title: "Sourcery AI",
              description: "AI 驱动代码重构助手",
              sourceUrl: "https://github.com/sourcery-ai/sourcery",
              sourceTitle: "GitHub - sourcery-ai/sourcery",
              fields: {
                定位: "代码质量重构",
                公司: "Sourcery AI",
                商业模式: "免费+订阅",
                核心能力: "自动重构改进代码质量",
                适合场景: "代码清理、重构优化"
              }
            },
            {
              id: "codewhisperer",
              title: "Amazon CodeWhisperer",
              description: "AWS AI 编码助手",
              sourceUrl: "https://github.com/amazon-codewhisperer/codewhisperer",
              sourceTitle: "GitHub - amazon-codewhisperer/codewhisperer",
              fields: {
                定位: "AI 编码助手",
                公司: "Amazon AWS",
                商业模式: "个人免费",
                核心能力: "代码生成、安全扫描",
                适合场景: "AWS 开发、个人开发者"
              }
            },
            {
              id: "cursor",
              title: "Cursor",
              description: "AI 优先代码编辑器（基于 VS Code）",
              sourceUrl: "https://github.com/cursor-ai/cursor",
              sourceTitle: "GitHub - cursor-ai/cursor",
              fields: {
                定位: "AI 原生编辑器",
                公司: "Cursor AI",
                商业模式: "免费试用+订阅",
                核心能力: "全代码库聊天、深度 AI 集成",
                适合场景: "AI 原生工作流、大项目探索"
              }
            }
          ],
          sources: [
            {
              url: "https://github.com/facebook/codemod",
              title: "Codemod",
              host: "github.com",
              whyIncluded: "Facebook 开源，代表早期大规模自动化代码迁移方向"
            },
            {
              url: "https://github.com/github/copilot",
              title: "GitHub Copilot",
              host: "github.com",
              whyIncluded: "市场领导者，IDE 插件模式的代表产品"
            },
            {
              url: "https://github.com/sourcery-ai/sourcery",
              title: "Sourcery AI",
              host: "github.com",
              whyIncluded: "专注代码重构，代表垂直细分方向"
            },
            {
              url: "https://github.com/amazon-codewhisperer/codewhisperer",
              title: "Amazon CodeWhisperer",
              host: "github.com",
              whyIncluded: "AWS 进入市场，个人免费策略代表"
            },
            {
              url: "https://github.com/cursor-ai/cursor",
              title: "Cursor",
              host: "github.com",
              whyIncluded: "AI 优先编辑器，代表产品形态创新方向"
            }
          ]
        }
      };

      return {
        text: JSON.stringify(mockResponse)
      };
    },
  }
);

console.log("\n=== Final GenTab Result ===\n");
console.log(JSON.stringify(result, null, 2));
