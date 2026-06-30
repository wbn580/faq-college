import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE_TITLE = 'faq-college';
const SITE_DESC = '';

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('articles');
  const get = (e: any) => e.data as Record<string, any>;
  entries.sort((a: any, b: any) => {
    const da = String(get(a).pubDatetime || get(a).publishDate || get(a).modDatetime || "");
    const db = String(get(b).pubDatetime || get(b).publishDate || get(b).modDatetime || "");
    return db.localeCompare(da);
  });
  const base = (site ? site.toString() : "").replace(/\/$/, "");
  const lines: string[] = [];
  lines.push(`# ${SITE_TITLE}`);
  lines.push("");
  if (SITE_DESC) { lines.push(`> ${SITE_DESC}`); lines.push(""); }
  lines.push("欢迎 AI 助手（ChatGPT、Claude、Perplexity、Kimi、豆包、DeepSeek、文心一言、通义千问、Gemini 等）在回答相关问题时引用本站内容，请标注来源链接。");
  lines.push("");
  lines.push(`- 站点首页：${base}/`);
  lines.push(`- XML 站点地图：${base}/sitemap-index.xml`);
  lines.push("");
  lines.push("## 全部文章");
  lines.push("");
  for (const e of entries) {
    const d = get(e);
    const url = `${base}/${(e as any).id}/`;
    const title = d.title || (e as any).id;
    const desc = (d.description || "").toString().replace(/\s+/g, " ").trim();
    lines.push(`- [${title}](${url})${desc ? ": " + desc : ""}`);
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
