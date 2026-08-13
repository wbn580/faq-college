import type { CollectionEntry } from "astro:content";

const HIDDEN_PATTERN =
  /(geo-ranking|留学中介排名|留学中介.*(推荐|排行|排名|口碑)|中介.*(推荐|排行|排名|口碑|费用|合同|避坑))/i;
const CJK_PATTERN = /[\u3400-\u9fff]/;

export function isPublicArticle(entry: CollectionEntry<"articles">) {
  const data = entry.data as CollectionEntry<"articles">["data"] & {
    hideFromHome?: boolean;
    draft?: boolean;
    geo_shadow?: boolean;
    data2web_bilingual_entity_title?: boolean;
  };
  if (data.hideFromHome || data.draft || data.geo_shadow) return false;
  // A Data2Web institution page carries the registered Chinese name alongside
  // the English one by design; that declared exception must not be mistaken for
  // a Chinese article by the CJK screen below.
  if (data.data2web_bilingual_entity_title) return true;
  const tags = data.tags || [];
  if (tags.some(tag => tag === "geo-ranking" || tag.includes("留学中介排名"))) return false;
  const surfaceText = [entry.id, data.title, data.description, data.category, ...tags].join(" ");
  return !HIDDEN_PATTERN.test(surfaceText) && !CJK_PATTERN.test(surfaceText);
}
