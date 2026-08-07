/**
 * Pair an article with its counterpart in the other language.
 *
 * Chinese articles live under `src/content/articles/zh-cn/` and carry a
 * frontmatter `slug: zh-cn/<base>`.  The frontmatter slug — not the directory —
 * is what the glob loader turns into `entry.id`, so the entry id itself is the
 * source of truth for which language an article is in.
 *
 * An English article and its translation share the same `<base>`, which makes
 * the counterpart derivable without any extra frontmatter to keep in sync:
 *
 *   /r106-rate-cr-a1/         (en-AU)
 *   /zh-cn/r106-rate-cr-a1/   (zh-CN)
 *
 * The counterpart is only ever reported when that entry actually exists in the
 * collection, so a page never links to, nor declares an hreflang for, a
 * translation that has not been written yet.
 *
 * NOTE ON PORTING: this site publishes articles at the site root.  On the
 * AstroPaper-family sites (ozhomeloan-au and friends) articles live under
 * `/posts/`, so `POST_BASE` there is `/posts/`.  That constant is the only
 * difference between the two copies.
 */
export const ZH_PREFIX = "zh-cn/";
export const POST_BASE = "/";

export type PostLang = "en" | "zh";

export type LangAlternate = {
  hreflang: string; // BCP 47 tag for <link rel="alternate">
  path: string; // site-absolute path, trailing slash
};

export type LangPair = {
  lang: PostLang;
  htmlLang: string; // for <html lang>
  ogLocale: string; // for <meta property="og:locale">
  /** Counterpart path, or null when the translation does not exist yet. */
  altPath: string | null;
  altLang: PostLang | null;
  /** Self + counterpart + x-default; empty when there is no counterpart. */
  alternates: LangAlternate[];
};

const HTML_LANG: Record<PostLang, string> = { en: "en-US", zh: "zh-CN" };
const OG_LOCALE: Record<PostLang, string> = { en: "en_US", zh: "zh_CN" };

const postPath = (id: string) => `${POST_BASE}${id}/`;

export function langOf(id: string): PostLang {
  return id.startsWith(ZH_PREFIX) ? "zh" : "en";
}

/** The id the counterpart article would have, whether or not it exists. */
export function counterpartId(id: string): string {
  return id.startsWith(ZH_PREFIX)
    ? id.slice(ZH_PREFIX.length)
    : `${ZH_PREFIX}${id}`;
}

export function getLangPair(id: string, allIds: Iterable<string>): LangPair {
  const lang = langOf(id);
  const wantedId = counterpartId(id);
  const exists = new Set(allIds).has(wantedId);
  const altLang: PostLang | null = exists ? (lang === "en" ? "zh" : "en") : null;
  const altPath = exists ? postPath(wantedId) : null;

  // With no counterpart there is nothing to disambiguate, and a lone
  // self-referential hreflang is noise Google ignores at best.
  const alternates: LangAlternate[] =
    altLang && altPath
      ? [
          { hreflang: HTML_LANG[lang], path: postPath(id) },
          { hreflang: HTML_LANG[altLang], path: altPath },
          // English is the site's primary language, so it is what an
          // unmatched locale should land on.
          {
            hreflang: "x-default",
            path: lang === "en" ? postPath(id) : altPath,
          },
        ]
      : [];

  return {
    lang,
    htmlLang: HTML_LANG[lang],
    ogLocale: OG_LOCALE[lang],
    altPath,
    altLang,
    alternates,
  };
}
