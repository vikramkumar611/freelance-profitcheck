import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pages } from "./pages.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "dist");
const sourceConfig = await readFile(path.join(root, "site-config.js"), "utf8");
const configuredUrl = sourceConfig.match(/canonicalBaseUrl:\s*"([^"]*)"/)?.[1] || "";
const adsEnabled = /adsEnabled:\s*true/.test(sourceConfig);
const adsConsentReady = /adsConsentReady:\s*true/.test(sourceConfig);
const publisherId = sourceConfig.match(/adsensePublisherId:\s*"([^"]*)"/)?.[1] || "";
const adSlotsConfig = sourceConfig.match(/adSlots:\s*\{([^}]*)\}/)?.[1] || "";
const adSlots = [...adSlotsConfig.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)];
const homeSource = await readFile(path.join(root, "index.html"), "utf8");
const adPlacements = new Set(
  [...homeSource.matchAll(/data-ad-slot="([^"]+)"/g)].map(([, name]) => name)
);
const adsTxtConfig = sourceConfig.match(/adsTxtLines:\s*\[([^\]]*)\]/)?.[1] || "";
const adsTxtLines = [...adsTxtConfig.matchAll(/"([^"]+)"/g)].map(([, line]) => line.trim()).filter(Boolean);
if (adsEnabled) {
  if (!adsConsentReady) throw new Error("AdSense is enabled but adsConsentReady is not true. Configure and verify the applicable consent solution first.");
  if (!/^ca-pub-\d{16}$/.test(publisherId)) throw new Error("AdSense is enabled but no valid 16-digit public publisher ID is configured.");
  if (!adSlots.length || adSlots.some(([, , slotId]) => !/^\d{10}$/.test(slotId))) {
    throw new Error("AdSense is enabled but one or more ad-unit IDs are missing or invalid.");
  }
  const configuredPlacements = new Set(adSlots.map(([, name]) => name));
  if ([...adPlacements].some((name) => !configuredPlacements.has(name))) {
    throw new Error("AdSense is enabled but a configured ad-unit ID is missing for an active placement.");
  }
}
if (adsTxtLines.length) {
  const publisherNumber = publisherId.match(/^ca-pub-(\d{16})$/)?.[1];
  if (!publisherNumber || adsTxtLines.some((line) =>
    /YOUR[_ -]|0000000000000000/i.test(line) || !line.includes(`pub-${publisherNumber}`)
  )) {
    throw new Error("adsTxtLines must contain only the exact public seller record(s) for the configured real publisher ID.");
  }
}
let siteUrl = (process.env.SITE_URL || configuredUrl).replace(/\/+$/, "");
if (siteUrl) {
  const parsedUrl = new URL(siteUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash || parsedUrl.username || parsedUrl.password) {
    throw new Error("SITE_URL must be an HTTPS origin, for example https://your-worker.workers.dev");
  }
  siteUrl = parsedUrl.origin;
}
const assets = ["index.html", "styles.css", "script.js", "calculator.js", "invoice.js", "site.js", "site-config.js", "favicon.svg", "og-image.svg"];

function renderPage(page) {
  const documentTitle = page.title.endsWith(" | Freelance ProfitCheck India")
    ? page.title
    : `${page.title} | Freelance ProfitCheck India`;
  const isGuides = page.path.startsWith("guides/");
  const routeDirectory = page.path.split("/").slice(0, -1);
  const assetPrefix = "../".repeat(routeDirectory.length);
  const relativeLink = (route) => {
    const destination = route.split("/").filter(Boolean);
    let common = 0;
    while (common < routeDirectory.length && common < destination.length && routeDirectory[common] === destination[common]) common += 1;
    const prefix = "../".repeat(routeDirectory.length - common);
    const remainder = destination.slice(common).join("/");
    if (!remainder) return prefix || "./";
    return `${prefix}${remainder}${route.endsWith("/") ? "/" : ""}`;
  };
  const pageContent = page.content.replace(/href="(\/[^"]*)"/g, (_match, route) => `href="${relativeLink(route)}"`);
  const nav = [
    ["/", "Calculator", false],
    ["/guides/", "Guides", isGuides],
    ["/how-it-works/", "How it works", page.path.startsWith("how-it-works/")],
    ["/about/", "About", page.path.startsWith("about/")]
  ].map(([href, text, active]) => `<a href="${relativeLink(href)}"${active ? ' class="active" aria-current="page"' : ""}>${text}</a>`).join("\n            ");
  const pageUrl = `${siteUrl}/${page.path.replace(/index\.html$/, "")}`;
  const canonical = siteUrl ? `<link rel="canonical" href="${pageUrl}" />` : "";
  const openGraphUrl = siteUrl ? `<meta property="og:url" content="${pageUrl}" />` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentTitle}</title>
    <meta name="description" content="${page.description}" />
    <meta name="theme-color" content="#f4f0ea" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:image" content="${siteUrl ? `${siteUrl}/og-image.svg` : `${assetPrefix}og-image.svg`}" />
    <meta property="og:image:alt" content="Freelance ProfitCheck India project profit calculator" />
    ${openGraphUrl}
    ${canonical}
    <link rel="icon" href="${assetPrefix}favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${assetPrefix}styles.css" />
    <script src="${assetPrefix}site-config.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="page-shell">
      <header class="topbar">
        <a class="brand-wrap" href="${relativeLink("/")}" aria-label="Freelance ProfitCheck India home">
          <span class="brand-mark" aria-hidden="true"><span class="cell cell-a"></span><span class="cell cell-b"></span><span class="cell cell-c"></span><span class="cell cell-d"></span></span>
          <span class="brand-text"><span class="brand-name">Freelance</span><span class="brand-name accent">ProfitCheck</span></span>
        </a>
        <nav class="main-nav" aria-label="Main navigation">
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-links">Menu</button>
          <div class="nav-links" id="primary-links">${nav}</div>
        </nav>
        <a class="save-btn" href="${relativeLink("/")}">Open calculator</a>
      </header>
      <main class="content article-content" id="main">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${relativeLink("/")}">Home</a>${isGuides ? ` <span aria-hidden="true">/</span> <a href="${relativeLink("/guides/")}">Guides</a>` : ""}</nav>
        <article class="article-card">
          <h1>${page.heading}</h1>
          ${pageContent}
        </article>
      </main>
      <footer class="site-footer">
        <a class="footer-brand" href="${relativeLink("/")}">Freelance ProfitCheck India</a>
        <nav class="footer-links" aria-label="Footer navigation">
          <a href="${relativeLink("/privacy/")}">Privacy</a><a href="${relativeLink("/terms/")}">Terms &amp; disclaimer</a><a href="${relativeLink("/contact/")}">Contact</a><a href="${relativeLink("/about/")}">About</a>
        </nav>
        <div class="footer-note">Estimates only—not tax, legal, accounting, or financial advice.</div>
      </footer>
    </div>
    <template id="advertisement-markup">
      <ins class="adsbygoogle" style="display:block" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </template>
    <script src="${assetPrefix}site.js"></script>
  </body>
</html>`;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const asset of assets) {
  const destination = path.join(output, asset);
  if (asset === "site-config.js" && siteUrl) {
    const configured = sourceConfig.replace(/canonicalBaseUrl:\s*"[^"]*"/, `canonicalBaseUrl: "${siteUrl}"`);
    await writeFile(destination, configured, "utf8");
  } else if (asset === "index.html") {
    let home = await readFile(path.join(root, asset), "utf8");
    if (siteUrl) {
      home = home
      .replace('<meta property="og:url" content="" />', `<meta property="og:url" content="${siteUrl}/" />`)
      .replace('<meta property="og:image" content="og-image.svg" />', `<meta property="og:image" content="${siteUrl}/og-image.svg" />`)
      .replace('<link rel="stylesheet" href="styles.css" />', `<link rel="canonical" href="${siteUrl}/" />\n    <link rel="stylesheet" href="styles.css" />`);
    } else {
      home = home.replace('    <meta property="og:url" content="" />\n', "");
    }
    home = home.replaceAll('href="./dist/', 'href="./');
    await writeFile(destination, home, "utf8");
  } else {
    await cp(path.join(root, asset), destination);
  }
}
for (const page of pages) {
  const destination = path.join(output, page.path);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, renderPage(page), "utf8");
}

const routePaths = ["/", ...pages.map((page) => `/${page.path.replace(/index\.html$/, "")}`)];
const sitemapEntries = siteUrl ? routePaths.map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join("\n") : "";
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;
await writeFile(path.join(output, "sitemap.xml"), sitemap, "utf8");
const sitemapDirective = siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : "";
await writeFile(path.join(output, "robots.txt"), `User-agent: *\nAllow: /\n${sitemapDirective}`, "utf8");
if (adsTxtLines.length) {
  await writeFile(path.join(output, "ads.txt"), `${adsTxtLines.join("\n")}\n`, "utf8");
}
await writeFile(path.join(output, "404.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | Freelance ProfitCheck India</title><link rel="stylesheet" href="/styles.css"><main class="article-card not-found"><h1>Page not found</h1><p>That page is not available. Try the <a href="/">calculator</a> or browse the <a href="/guides/">guides</a>.</p></main></html>`, "utf8");

if (!siteUrl) console.warn("SITE_URL is not configured. Canonical URLs are omitted and the sitemap has no entries until you set the verified HTTPS origin.");
console.log(`Built ${routePaths.length} pages into dist.`);
