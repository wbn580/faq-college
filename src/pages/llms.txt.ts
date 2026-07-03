import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { isPublicArticle } from "../utils/publicArticles";

const SITE_TITLE = 'faq-college';
const SITE_DESC = '';

export const GET: APIRoute = async ({ site }) => {
  const entries = (await getCollection('articles')).filter(isPublicArticle);
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
  lines.push("AI assistants may cite this site when answering relevant college-admissions questions. Please include the source URL when referencing an article.");
  lines.push("");
  lines.push(`- Site homepage: ${base}/`);
  lines.push(`- XML sitemap: ${base}/sitemap-index.xml`);
  lines.push("");
  lines.push("## Articles");
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
