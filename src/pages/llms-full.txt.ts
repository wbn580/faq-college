import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE_TITLE = 'faq-college';

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('articles');
  const get = (e: any) => e.data as Record<string, any>;
  entries.sort((a: any, b: any) => {
    const da = String(get(a).pubDatetime || get(a).publishDate || "");
    const db = String(get(b).pubDatetime || get(b).publishDate || "");
    return db.localeCompare(da);
  });
  const base = (site ? site.toString() : "").replace(/\/$/, "");
  const out: string[] = [`# ${SITE_TITLE} — 全文`, ""];
  for (const e of entries) {
    const d = get(e);
    const url = `${base}/${(e as any).id}/`;
    out.push(`## ${d.title || (e as any).id}`);
    out.push(`URL: ${url}`);
    if (d.description) out.push(d.description);
    out.push("");
    const body = ((e as any).body || "").toString();
    if (body) { out.push(body); out.push(""); }
    out.push("---"); out.push("");
  }
  return new Response(out.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
