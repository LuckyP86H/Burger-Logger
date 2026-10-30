/**
 * Two languages for now: English and Chinese. Every visible string lives in `messages`, and the
 * Chinese table is typed against the English one, so a missing translation is a compile error.
 *
 * MCP tools stay English: agents read them programmatically, and the card's English text is still
 * there under `name.en` if an agent wants it.
 */

export type Lang = "en" | "zh";
export const LANGS: readonly Lang[] = ["en", "zh"];
export const LANG_COOKIE = "lang";

/** Text in both languages, for data that is generated once and then shown in whichever is asked. */
export type Localised = Record<Lang, string>;

/** Language from the link (`?lang=`), then the saved choice, then the browser's preference. */
export function pickLang(
  url: URL,
  cookie: string | undefined,
  acceptLanguage: string | null,
): Lang {
  const fromQuery = url.searchParams.get("lang");
  if (isLang(fromQuery)) return fromQuery;
  if (isLang(cookie)) return cookie;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "");
  return preferred.some((tag) => tag.startsWith("zh")) ? "zh" : "en";
}

export const isLang = (value: unknown): value is Lang =>
  typeof value === "string" && (LANGS as readonly string[]).includes(value);

const en = {
  "app.title": "Burger Logger",
  "app.description": "A craving list and tasting journal for burgers.",
  "app.heading": "🍔 Burger Logger",
  "app.tagline": "Write down the burgers you want. Rate the ones you ate.",
  "app.footer.private": "Your journal belongs to this browser (no account).",
  "app.footer.download": "Download it",
  "app.footer.rebuilt": "Rebuilt in 2026 from a 2019 bootcamp project",
  "app.footer.source": "Source",
  "lang.switch": "中文",
  "lang.label": "Language",

  "item.at": " at ",
  "item.delete": "Delete",
  "item.deleteNamed": "Delete {name}",
  "item.back": "Back to cravings",
  "item.backNamed": "Move {name} back to cravings",
  "item.devour": "Devour it!",
  "item.howWasIt": "How was it?",
  "item.outOf5": "{n} out of 5",
  "item.note": "Note",
  "item.optional": "(optional)",
  "item.notePlaceholder": "Juicy, great bun, too much sauce…",
  "item.logIt": "Log it",
  "item.patties": "{rating} out of 5",

  "today.kicker": "Today's burger · {date}",
  "today.match": "match",
  "today.why": "Why this pick",
  "today.memory": "You gave {name} {rating}/5{quote}. This one {because}.",
  "today.memoryQuote": ' "{note}"',
  "today.onList": "It's already on your craving list.",
  "today.rateOne": "Rate 1 more burger and this gets personal.",
  "today.rateMany": "Rate {n} more burgers and this gets personal.",
  "today.onListAction": "It's on your list: devour it today",
  "today.addAction": "Add today's pick to cravings",
  "today.previewTemplate": "Preview from a template",
  "today.previewBy": "Preview by {by}",
  "today.learned": "learned from {n} ratings",
  "today.learnedOne": "learned from 1 rating",
  "today.backAfter": "Back to {patty} after a while",
  "today.firstPick": "Something new for you: your first {patty} pick",
  "today.promise": '{promise}: you\'ve said "too {tag}" {times}.',
  "today.twice": "twice",
  "today.picture": "Picture it: {list}.",
  "today.listSep": ", ",
  "today.listAnd": " and ",
  "today.fallbackTeaser": "Something new to try today.",
  "today.times": "{n} times",

  "stats.cravings": "Cravings",
  "stats.devoured": "Devoured",
  "stats.average": "Average",
  "stats.best": "Best so far",
  "stats.journal": "Your journal",

  "taste.label": "Your taste:",

  "form.burger": "Burger",
  "form.burgerPlaceholder": "Double smash",
  "form.where": "Where",
  "form.placePlaceholder": "Shake Shack",
  "form.add": "Add to cravings",

  "list.cravings": "Cravings",
  "list.devoured": "Devoured",
  "list.emptyCravings": "Nothing queued. What are you in the mood for?",
  "list.emptyDevoured": "Nothing eaten yet. Devour one!",

  "agent.summary": "Connect an AI agent",
  "agent.body":
    "This journal speaks MCP, so an agent can log burgers for you. Add this URL as a remote MCP server (Streamable HTTP). It contains your private key: don't share it.",
  "agent.urlLabel": "Your private MCP URL",
  "agent.tools": "Tools:",

  "error.full": "Your journal is full ({max} burgers). Delete some first.",
  "error.notOnList": "That burger isn't on your craving list.",
  "error.notDevoured": "That burger isn't in your devoured list.",
  "error.gone": "That burger is already gone.",
  "error.invalid": "Invalid input.",
  "error.join": ": ",
  "error.fieldName": "Burger name",
  "error.fieldPlace": "Place",
  "error.fieldNote": "Note",
  "error.fieldRating": "Rating",
  "error.tooShort": "is too short",
  "error.tooLong": "is too long",
  "error.badCharacters": "contains characters that can't be shown",
  "error.badValue": "isn't valid",
  "error.generic": "is invalid",
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  "app.title": "汉堡记录",
  "app.description": "汉堡的想吃清单和品尝日记。",
  "app.heading": "🍔 汉堡记录",
  "app.tagline": "写下你想吃的汉堡，给吃过的打分。",
  "app.footer.private": "这本日记属于这个浏览器（无需账号）。",
  "app.footer.download": "下载日记",
  "app.footer.rebuilt": "2026 年由 2019 年的训练营项目重建",
  "app.footer.source": "源代码",
  "lang.switch": "English",
  "lang.label": "语言",

  "item.at": " · ",
  "item.delete": "删除",
  "item.deleteNamed": "删除{name}",
  "item.back": "放回想吃清单",
  "item.backNamed": "把{name}放回想吃清单",
  "item.devour": "吃掉它！",
  "item.howWasIt": "味道如何？",
  "item.outOf5": "{n} 分",
  "item.note": "备注",
  "item.optional": "（可选）",
  "item.notePlaceholder": "多汁、面包香，酱有点多…",
  "item.logIt": "记录",
  "item.patties": "{rating}/5 分",

  "today.kicker": "今日汉堡 · {date}",
  "today.match": "匹配度",
  "today.why": "推荐理由",
  "today.memory": "你给「{name}」打过 {rating}/5{quote}。这个{because}。",
  "today.memoryQuote": "：「{note}」",
  "today.onList": "它已经在你的想吃清单里了。",
  "today.rateOne": "再给 1 个汉堡打分，推荐会更懂你。",
  "today.rateMany": "再给 {n} 个汉堡打分，推荐会更懂你。",
  "today.onListAction": "已在清单里：今天就吃它",
  "today.addAction": "把今日推荐加入想吃清单",
  "today.previewTemplate": "预览来自模板",
  "today.previewBy": "预览由 {by} 生成",
  "today.learned": "基于 {n} 次打分",
  "today.learnedOne": "基于 1 次打分",
  "today.backAfter": "隔了一阵子，又吃回{patty}",
  "today.firstPick": "给你的新体验：第一次选{patty}",
  "today.promise": "{promise}：你说过「太{tag}」{times}。",
  "today.twice": "两次",
  "today.picture": "想象一下：{list}。",
  "today.listSep": "、",
  "today.listAnd": "和",
  "today.fallbackTeaser": "今天来试试点新的。",
  "today.times": "{n} 次",

  "stats.cravings": "想吃",
  "stats.devoured": "吃过",
  "stats.average": "平均分",
  "stats.best": "目前最爱",
  "stats.journal": "你的日记",

  "taste.label": "你的口味：",

  "form.burger": "汉堡",
  "form.burgerPlaceholder": "双层 smash",
  "form.where": "地点",
  "form.placePlaceholder": "Shake Shack",
  "form.add": "加入想吃清单",

  "list.cravings": "想吃清单",
  "list.devoured": "吃过的",
  "list.emptyCravings": "还没有想吃的。今天想吃什么？",
  "list.emptyDevoured": "还没吃过。去吃一个吧！",

  "agent.summary": "连接 AI 代理",
  "agent.body":
    "这本日记支持 MCP，AI 代理可以替你记录汉堡。把下面的地址添加为远程 MCP 服务器（Streamable HTTP）。地址里包含你的私人密钥，请勿分享。",
  "agent.urlLabel": "你的私人 MCP 地址",
  "agent.tools": "工具：",

  "error.full": "日记已满（{max} 个汉堡）。请先删除一些。",
  "error.notOnList": "这个汉堡不在你的想吃清单里。",
  "error.notDevoured": "这个汉堡不在吃过的清单里。",
  "error.gone": "这个汉堡已经不见了。",
  "error.invalid": "输入无效。",
  "error.join": "：",
  "error.fieldName": "汉堡名称",
  "error.fieldPlace": "地点",
  "error.fieldNote": "备注",
  "error.fieldRating": "评分",
  "error.tooShort": "太短了",
  "error.tooLong": "太长了",
  "error.badCharacters": "包含无法显示的字符",
  "error.badValue": "不是有效的值",
  "error.generic": "无效",
};

const messages: Record<Lang, Record<MessageKey, string>> = { en, zh };

/** Fills `{name}` placeholders. Values are inserted as text; the JSX layer escapes them. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}

export const dateLocale = (lang: Lang) => (lang === "zh" ? "zh-CN" : "en-US");
