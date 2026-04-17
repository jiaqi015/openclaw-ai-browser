/**
 * ActionGate.mjs
 * 安全层：对每个 LLM 产出的动作进行风险分级。
 * 返回 "green" | "yellow" | "red"
 */

export function classifyAction(action, element, context = {}) {
  const type = action.action ?? action.type; // 兼容 LLM 输出的 action.action 和测试用的 action.type

  // 1. 红色操作：高风险，必须手动确认
  if (isRedAction(action, element, context)) {
    return "red";
  }

  // 2. 黄色操作：中风险，倒计时自动执行
  if (isYellowAction(action, element, context)) {
    return "yellow";
  }

  // 3. 绿色操作：低风险，直接执行
  return "green";
}

function isRedAction(action, element, context) {
  const type = action.action ?? action.type;

  // 密码输入
  if (type === "fill" && element?.type === "password") {
    return true;
  }

  // 支付 / 删除 / 发送类按钮
  if (type === "click") {
    const text = (element?.text || "").toLowerCase();
    const redHints = /pay|purchase|buy|order|delete|remove|支付|付款|购买|下单|删除|退款|转账/i;
    if (redHints.test(text)) return true;

    // 涉及金额
    const moneyHints = /[¥$￥]|元|币|price|amount|total/i;
    if (moneyHints.test(text)) return true;
  }

  return false;
}

function isYellowAction(action, element, context) {
  const type = action.action ?? action.type;

  // 填写敏感字段（非密码）
  if (type === "fill") {
    const hints = /email|phone|tel|mobile|address|身份|证件|手机|邮箱|地址|name|姓名/i;
    const fieldInfo = (element?.type || "") + (element?.placeholder || "") + (element?.text || "");
    if (hints.test(fieldInfo)) return true;
  }

  // 点击提交类按钮
  if (type === "click") {
    const text = (element?.text || "").toLowerCase();
    const submitHints = /submit|confirm|ok|next|register|login|sign|提交|确认|下一步|注册|登录/i;
    if (submitHints.test(text)) return true;
  }

  // 导航到外部域名
  if (type === "navigate") {
    const currentOrigin = context.currentOrigin;
    try {
      const targetOrigin = new URL(action.url).origin;
      if (currentOrigin && targetOrigin !== currentOrigin) return true;
    } catch {
      return true;
    }
  }

  return false;
}

export function getConfirmReason(action, element) {
  const type = action.action ?? action.type;
  if (type === "fill" && element?.type === "password") {
    return "涉及密码输入，请手动操作";
  }
  if (type === "click") {
    const text = element?.text || "该元素";
    return `即将点击 "${text}"，可能涉及敏感操作或提交`;
  }
  if (type === "navigate") {
    return `即将跳转到外部链接: ${action.url}`;
  }
  return "该操作具有一定风险，请确认";
}
