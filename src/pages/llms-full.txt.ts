import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { isPublicArticle } from "../utils/publicArticles";

// 剥掉文章里的 affiliate 卡片（cowork-standards/affiliate-article-card-standard.md §3）——
// 卡片是给人看的转化组件，不该进给 LLM 的正文全文。
const stripAffCard = (s: string) =>
  s.replace(/<!-- AFF-CARD:v1:START -->[\s\S]*?<!-- AFF-CARD:v1:END -->/g, "").trimEnd();


const SITE_TITLE = 'faq-college';

export const GET: APIRoute = async ({ site }) => {
  const entries = (await getCollection('articles')).filter(isPublicArticle);
  const get = (e: any) => e.data as Record<string, any>;
  entries.sort((a: any, b: any) => {
    const da = String(get(a).pubDatetime || get(a).publishDate || "");
    const db = String(get(b).pubDatetime || get(b).publishDate || "");
    return db.localeCompare(da);
  });
  const base = (site ? site.toString() : "").replace(/\/$/, "");
  const out: string[] = [`# ${SITE_TITLE} - Full Text`, ""];
  for (const e of entries) {
    const d = get(e);
    const url = `${base}/${(e as any).id}/`;
    out.push(`## ${d.title || (e as any).id}`);
    out.push(`URL: ${url}`);
    if (d.description) out.push(d.description);
    out.push("");
    const body = stripAffCard(((e as any).body || "")).toString();
    if (body) { out.push(body); out.push(""); }
    out.push("---"); out.push("");
  }
  return new Response(out.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
