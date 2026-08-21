// 从一篇已构建好的静态文章页反推出运行时渲染模板（worker/template.ts）。
//
// 由 d1_runtime_scaffold.py 从模板生成；模板正本：
// cowork-cloud-tools/scripts/templates/d1-runtime/gen-article-template.mjs.tmpl
// 参照实现：site-builds/course-org-cn/scripts/gen-article-template.mjs
//
// 站点外壳（head/meta/nav/footer）由构建产出，手抄一份到 Worker 里迟早跑偏。
// 这里以真实产物为唯一正本切出 HEAD/TAIL 两段，中间留占位符，运行时只把
// D1 里的字段填进去 —— 动态文章和静态文章长得一模一样。
//
// 外壳改版后重跑本脚本即可：node scripts/gen-article-template.mjs
// 任何一步定位/替换失败都直接 throw（fail closed），绝不硬切。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const REF = "dist/how-to-use-summer-break-to-build-college-application-worthy-skills-and-experienc/index.html"; // 参考页（已构建产物里的一篇真实文章页）
const SEG = "";
const DEFAULT_OG = "https://faq.college/og-image.jpg"; // 站点默认 og 图（绝对 URL，可为空串）
const OUT = "worker/template.ts";

const html = readFileSync(REF, "utf8");

// ── 1. 从参考页自提取元数据（不手抄，保证与产物一致） ──────────────
function extractCanonical(h) {
  const m =
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(h) ||
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(h);
  if (!m) throw new Error("参考页找不到 canonical");
  return m[1];
}
function extractDesc(h) {
  const m =
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i.exec(h) ||
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i.exec(h);
  if (!m) throw new Error("参考页找不到 meta description");
  return m[1];
}
function extractTitle(h) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(h);
  if (!m) throw new Error("参考页找不到 <h1>");
  const text = m[1].replace(/<[^>]+>/g, "").trim();
  if (!text) throw new Error("参考页 <h1> 为空");
  return text;
}
function extractDateIso(h) {
  let m = /<meta[^>]*property=["']article:published_time["'][^>]*content=["'](\d{4}-\d{2}-\d{2})/i.exec(h);
  if (m) return m[1];
  m = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(h);
  if (m) return m[1];
  m = /<div class="text-sm mb-3"[^>]*>\s*(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(h);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return "";
}

const REF_CANONICAL = extractCanonical(html);
const REF_TITLE = extractTitle(html);
const REF_DESC = extractDesc(html);
const REF_DATE_ISO = extractDateIso(html);
const CANONICAL_BASE = REF_CANONICAL.replace(/\/+$/, "");
const REF_SLUG = CANONICAL_BASE.split("/").pop();
if (!REF_SLUG) throw new Error(`canonical 解析不出 slug：${REF_CANONICAL}`);

// ── 2. 定位正文容器（优先 prose，其次 <article>，再次 <main>） ─────
// 返回 [容器开标签结束位置, 容器闭标签开始位置]，闭标签用同名标签深度扫描配对。
function matchClose(h, tagName, fromIdx) {
  const re = new RegExp(`<${tagName}\\b|</${tagName}>`, "gi");
  re.lastIndex = fromIdx;
  let depth = 1;
  let m;
  while ((m = re.exec(h)) !== null) {
    if (m[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  throw new Error(`容器 <${tagName}> 找不到配对的闭标签`);
}

function locateContainer(h) {
  const proseAttr = h.indexOf('class="prose');
  if (proseAttr >= 0) {
    const tagStart = h.lastIndexOf("<", proseAttr);
    const tagName = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(h.slice(tagStart))?.[1];
    if (!tagName) throw new Error("prose 容器开标签解析失败");
    const openEnd = h.indexOf(">", proseAttr) + 1;
    if (openEnd <= 0) throw new Error("prose 容器开标签未闭合");
    return { openEnd, closeStart: matchClose(h, tagName, openEnd), via: "prose" };
  }
  for (const tagName of ["article", "main"]) {
    const i = h.search(new RegExp(`<${tagName}\\b`, "i"));
    if (i < 0) continue;
    const openEnd = h.indexOf(">", i) + 1;
    if (openEnd <= 0) continue;
    return { openEnd, closeStart: matchClose(h, tagName, openEnd), via: tagName };
  }
  throw new Error("参考页找不到正文容器（prose/<article>/<main> 都没有）");
}

const { openEnd, closeStart, via } = locateContainer(html);
if (!(openEnd < closeStart)) throw new Error("正文边界推断失败");

// 容器一开头如果就是 <h1>（简单模板家族：标题在容器内），把它并进 HEAD，
// 因为 body_html 与 course-org-cn 一致约定不含 <h1>。
let bodyStart = openEnd;
const afterOpen = html.slice(openEnd);
const wsLen = afterOpen.length - afterOpen.replace(/^\s+/, "").length;
if (/^<h1\b/i.test(afterOpen.slice(wsLen))) {
  const h1Close = html.indexOf("</h1>", openEnd);
  if (h1Close < 0) throw new Error("容器内 <h1> 未闭合");
  bodyStart = h1Close + "</h1>".length;
}

let head = html.slice(0, bodyStart);
const tail = html.slice(closeStart);

// ── 3. 占位符替换（顺序敏感：长串先替换，避免子串误伤） ────────────
// canonical：带尾斜杠的实例先替换成 "{{CANONICAL}}/"，这样原页面的
// 尾斜杠习惯被逐字保留，Worker 只需要填不带尾斜杠的 base。
head = head.split(CANONICAL_BASE + "/").join("{{CANONICAL}}/");
head = head.split(CANONICAL_BASE).join("{{CANONICAL}}");

// 2026-08-21 事故防复发（estate-sydney 实测）：分享按钮（微博/QQ/X/邮件）
// 把 canonical 做了 URL 百分号编码塞进 query string
// （如 url=https%3A%2F%2F...%2Fen-sydney-upfront-costs%2F），裸字符串替换
// 抓不到这种形态——参考文章 slug 就这样残留在 HEAD 里，验收 fail closed。
// 编码后的完整 URL 是唯一值，不会跟别的内容误撞，直接整体换成占位符；
// 只处理带尾斜杠这一种编码形态（分享链接里目前只见过这种），足够覆盖
// 目前踩到的家族，不做过度设计。
head = head.split(encodeURIComponent(CANONICAL_BASE + "/")).join("{{CANONICAL_ENC}}");

// 2026-08-21 事故防复发（liuxueai-org 实测）：部分站点在 HEAD 里嵌了一个
// 繁简/多语言切换菜单，每个选项是一条完整 URL，直接写死了参考文章的
// slug——但落在跟 canonical 不同的 host 上（如 liuxueai.org.cn vs
// liuxueai.org），上面两条 CANONICAL_BASE split/join 只认 canonical 自己
// 的 host，抓不到跨域这种形态，REF_SLUG 就残留在 HEAD 里触发第 4 节
// fail closed。REF_SLUG 是这篇参考页自己的 slug——HEAD 里任何形如
// "{seg}/{REF_SLUG}/" 的完整 URL，不管 host 是谁，语义上都只能是"这篇
// 文章自己的另一份拷贝"（语言镜像/AMP 版之类），不可能是"引用了另一篇
// 不同的文章"，因为不同文章不会跟参考页共享同一个 slug。只替换 slug
// 那一段，host/协议/SEG 原样保留，用 {{SLUG}} 占位，运行时用当前动态
// 文章自己的 slug 填回去，链接就跟着动态文章走，不再钉死在参考文章上。
// 对没有这种镜像链接的站点，下面这段正则找不到匹配，完全是空操作，
// 不影响任何已转换成功的站（该站当年能转换成功就已经证明 HEAD 里此时
// 不含 REF_SLUG 了）。
{
  // 2026-08-21 三次修正（immicor-com 实测）：hreflang 备用链接的 URL 结构
  // 经常跟 canonical/nav 不是同一套 scheme——immicor-com 的 canonical 是
  // /post/{slug}/，但 hreflang="en"/"x-default" 却是裸 /{slug}/（不带
  // "post" 段），hreflang="zh-CN"/"zh-Hant-HK" 是 /{locale}/{slug}/（同样
  // 不带 "post"），可见文语言切换菜单里 zh/zh-hk 选项又是
  // /{locale}/post/{slug}/（locale 在 segPath 前面，跟 cleanerinsurance-au
  // 的"segPath 后面插 locale"顺序相反）。逐一枚举这些 URL 结构的组合爆炸
  // 没有尽头，改成不依赖具体路径结构的通用形态：REF_SLUG 只要是某个引号
  // 属性值（href=".../" 或 content=".../" 这类）里的**最后一段路径**
  // （即紧跟在 REF_SLUG 后面、到闭合引号之间只允许一个可选的尾斜杠），
  // 前面不管是 host+协议、locale 段、segPath 段，还是它们的任意组合，一律
  // 保留原样只替换 slug 本身。这个假设在 HEAD 范围内总是成立——HEAD 只到
  // 正文容器开始为止（见上面 locateContainer），不会出现"引用了另一篇
  // 不同文章"这种情况（不同文章不共享同一个 slug），HEAD 里任何以 REF_SLUG
  // 收尾的引号属性值语义上只能是"这篇文章自己的另一种表示"（canonical 变体/
  // 语言镜像/AMP 版之类）。合并替代原先分别处理"跨域绝对 URL"
  // （liuxueai-org 实测）和"同源相对 URL、segPath 后可选插一段语言码"
  // （carpenterinsurance-au/cleanerinsurance-au 实测）的两条正则——那两条
  // 都是本条的特例，用一条通用正则一并覆盖，不必再对每种新排列组合单独打
  // 补丁。D1 运行时文章目前只有默认语言/默认 URL 结构的正文，非默认语言或
  // 非 canonical 结构的这几条链接换完后可能指向不存在的对应版本（404）——
  // 这是刻意的已知限制，不是本次改造引入的新回归（参考文章本来就是这些
  // 结构各自独立发布的静态页，动态新文章暂无对应版本可链接；对存量静态页
  // 零影响，它们不经过这段模板）。
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anyMirrorRe = new RegExp(
    `(["'])([^"']*?)${escRe(REF_SLUG)}(?![A-Za-z0-9._-])(/?)\\1`,
    "g",
  );
  head = head.replace(
    anyMirrorRe,
    (_all, quote, prefix, trailingSlash) => `${quote}${prefix}{{SLUG}}${trailingSlash}${quote}`,
  );
}

// 2026-08-21 事故防复发（taxplan-hk 实测）：部分站点 <h1> 与 meta
// description 文案逐字相同（SEO 组件用标题直接生成描述）。原来两轮独立
// split/join 处理 TITLE/DESC 会互相踩踏——第一轮把 HEAD 里所有该字符串
// 出现处都吃成 {{TITLE}}，第二轮找不到剩余的 REF_DESC 可替换，{{DESC}}
// 占位符永远生成不出来，第 4 节 fail closed 报"参考页可能已改版"，具有
// 误导性——真因是替换顺序 bug，跟参考页有没有改版无关。改成按标签上下文
// 逐个锚定替换，文案相同与否都不受影响；两串不同时行为与原实现等价。
// 全局匹配（g 标志）：taxplan-hk 实测同一页面存在两个 <h1>（header 区一个
// 展示用，正文容器开头折叠进 HEAD 的又一个，文案逐字相同）——非全局正则
// 只replace命中的第一个，第二个残留原文本，slug 就藏在它的自动生成 id
// 属性里（下面单独处理 id）。这里先保证 TITLE/DESC 在多处重复出现时
// 全部被替换，不只是"至少一处"。
function replaceTagContent(h, re, placeholder, refText) {
  return h.replace(re, (all, pre, val, post) =>
    (val.includes(refText) ? pre + val.split(refText).join(placeholder) + post : all));
}
// <h1>（extractTitle 的权威来源，容器折叠进 HEAD 时这里几乎总能命中；
// 部分家族同一页面有不止一个 <h1> 复述标题，g 标志确保全部替换）
head = replaceTagContent(head, /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/gi, "{{TITLE}}", REF_TITLE);
// <title> 标签（常带站点名后缀，如"标题 | 站点名"，只换匹配到的那一段）
head = replaceTagContent(head, /(<title[^>]*>)([\s\S]*?)(<\/title>)/gi, "{{TITLE}}", REF_TITLE);
// meta name=description（两种属性顺序都认，跟 extractDesc 的探测逻辑对齐）
head = replaceTagContent(
  head, /(<meta[^>]*name=["']description["'][^>]*content=["'])([^"']*)(["'])/gi, "{{DESC}}", REF_DESC,
);
head = replaceTagContent(
  head, /(<meta[^>]*content=["'])([^"']*)(["'][^>]*name=["']description["'])/gi, "{{DESC}}", REF_DESC,
);
// <h1 id="...从标题自动生成的 kebab-case 锚点...">（taxplan-hk 实测）：这个
// id 是标题的 slugify 版本，不是 REF_TITLE 字面量也不是 canonical URL，
// 上面几条都碰不到它，但确实是"参考文章专属"的残留（id 由标题内容派生，
// 每篇动态文章的标题不同，id 也该跟着变，模板生成阶段没有运行时可用的
// slugify 机制去正确重建它）。只在 id 值确实包含 REF_SLUG 时才摘掉这个
// 属性（避免误伤跟 slug 无关的固定 id，比如 id="main-title" 这类），
// 摘掉不影响可见内容，只是少了一个可能没人引用的锚点；如果这个 id 真被
// 页内锚点/TOC 引用，会在冒烟测试的锚点跳转检查里暴露，不是本次范围内
// 能穷举验证的点。
head = head.replace(/<h1\b[^>]*>/gi, (tag) => {
  const idMatch = /\sid=["']([^"']*)["']/i.exec(tag);
  return idMatch && idMatch[1].includes(REF_SLUG) ? tag.replace(idMatch[0], "") : tag;
});
// og:title/twitter:title、og:description/twitter:description
// （property=/name= 混用都认，跟上面 estate-sydney 那条 og:image 修复同款宽松匹配）
head = head.replace(
  /(<meta[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["'])([^"']*)(["'])/gi,
  (all, pre, val, post) => (val.includes(REF_TITLE) ? pre + val.split(REF_TITLE).join("{{TITLE}}") + post : all),
);
head = head.replace(
  /(<meta[^>]*(?:property|name)=["'](?:og:description|twitter:description)["'][^>]*content=["'])([^"']*)(["'])/gi,
  (all, pre, val, post) => (val.includes(REF_DESC) ? pre + val.split(REF_DESC).join("{{DESC}}") + post : all),
);
// JSON-LD headline/description 字段
head = head.replace(/("headline"\s*:\s*")([^"]*)(")/g,
  (all, pre, val, post) => (val.includes(REF_TITLE) ? pre + val.split(REF_TITLE).join("{{TITLE}}") + post : all));
head = head.replace(/("description"\s*:\s*")([^"]*)(")/g,
  (all, pre, val, post) => (val.includes(REF_DESC) ? pre + val.split(REF_DESC).join("{{DESC}}") + post : all));
// 剩余散落文本（罕见，如 alt 属性/微数据）：TITLE/DESC 文案不同时才做
// 兜底盲替换；文案相同时盲替换必定二选一踩踏，宁可少替换几处边角残留，
// 也不做错误归类（上面已经保证 {{TITLE}}/{{DESC}} 各自至少有一处正确来源）。
if (REF_TITLE !== REF_DESC) {
  head = head.split(REF_TITLE).join("{{TITLE}}");
  head = head.split(REF_DESC).join("{{DESC}}");
}

// og:image / twitter:image 指向按 slug 生成的配图时，运行时文章没有对应
// 产物，换成站点默认图；没有默认图则 fail closed（绝不让所有动态文章
// 顶着参考文章的配图上线）。
//
// 2026-08-21 事故防复发（estate-sydney 实测，两处）：①原正则假定 og:image
// 用 property=、twitter:image 用 name=，但 estate-sydney 的 SEO 组件两个都用
// property=（<meta property="twitter:image" ...>，非标准但真实存在），只认
// 固定搭配会让 twitter:image 那条漏网；②同一张配图 URL 经常在 JSON-LD
// "image" 字段里独立复制一份，正则只改 <meta> 标签本身抓不到它。改成先从
// og:image 拿到"按 slug 生成的配图"这个精确 URL 值，再把它作为字面量整体
// 在 HEAD 里全局替换——不管它出现在 meta 标签、JSON-LD 还是别的地方。
if (head.includes(REF_SLUG)) {
  const imgMatch = /<meta[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']*)["']/i.exec(head);
  const slugImageUrl = imgMatch && imgMatch[1].includes(REF_SLUG) ? imgMatch[1] : null;
  if (slugImageUrl) {
    if (!DEFAULT_OG) throw new Error(`og:image 按 slug 生成（${slugImageUrl}）但站点没有默认 og 图`);
    head = head.split(slugImageUrl).join(DEFAULT_OG);
  }
}

// 日期：JSON-LD → meta → 可见文本，全部换成占位符
head = head
  .replace(/("datePublished"\s*:\s*")[^"]+(")/g, "$1{{DATE_ISO_FULL}}$2")
  .replace(/("dateModified"\s*:\s*")[^"]+(")/g, "$1{{DATE_ISO_FULL}}$2");
if (REF_DATE_ISO) {
  const [y, mo, d] = REF_DATE_ISO.split("-").map(Number);
  head = head
    .split(`${REF_DATE_ISO}T`).join("{{DATE_ISO}}T")   // 残余 datetime 前缀
    .split(REF_DATE_ISO).join("{{DATE_ISO}}")
    .split(`${y}年${mo}月${d}日`).join("{{DATE}}");
  // "{{DATE_ISO}}T..." 这种残余 datetime 统一收敛成 DATE_ISO_FULL
  head = head.replace(/\{\{DATE_ISO\}\}T[0-9:.]+Z?/g, "{{DATE_ISO_FULL}}");
}

// course/stays 家族的日期+分类行：整行换成 {{DATE}}{{CATEGORY_SUFFIX}}
head = head.replace(
  /(<div class="text-sm mb-3"[^>]*>)[\s\S]*?(<\/div>)/,
  "$1{{DATE}}{{CATEGORY_SUFFIX}}$2",
);

// ── 4. 验收（fail closed） ─────────────────────────────────────────
for (const token of ["{{CANONICAL}}", "{{TITLE}}", "{{DESC}}"]) {
  if (!head.includes(token)) throw new Error(`占位符 ${token} 缺失——参考页可能已改版`);
}
if (head.includes(REF_SLUG)) {
  throw new Error(`HEAD 里仍残留参考文章 slug（${REF_SLUG}），模板会把所有动态文章指向它`);
}
if (REF_DATE_ISO && head.includes(REF_DATE_ISO)) {
  throw new Error(`HEAD 里仍残留参考文章日期 ${REF_DATE_ISO}`);
}
if (!/\{\{DATE(_ISO(_FULL)?)?\}\}/.test(head)) {
  console.warn("⚠ 模板里没有任何日期占位符（参考页本身不展示日期），动态文章将不显示日期");
}

mkdirSync("worker", { recursive: true });
writeFileSync(
  OUT,
  `// 本文件由 scripts/gen-article-template.mjs 从 ${REF} 生成（容器定位：${via}），请勿手改。
// 站点外壳改版后重跑该脚本，让动态文章页跟静态页保持一致。
export const HEAD = ${JSON.stringify(head)};

export const TAIL = ${JSON.stringify(tail)};
`,
  "utf8",
);

console.log(
  `ok: ${OUT} (via=${via}, head ${head.length}B, tail ${tail.length}B, seg=/${SEG}/, ref=${REF_SLUG})`,
);
