import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
export const GET: APIRoute = async ({ site }) => {
  const base = (site ? site.toString() : "").replace(/\/$/, "");
  const entries = await getCollection('articles');
  const get = (e: any) => (e.data || {}) as Record<string, any>;
  const items = entries.map((e: any) => {
    const u = encodeURI(`${base}/${(e as any).id}/`);
    const d = get(e);
    const lm = String(d.modDatetime || d.pubDatetime || d.publishDate || d.date || "").slice(0, 10);
    return `  <url><loc>${u}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}</url>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc></url>\n${items.join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
