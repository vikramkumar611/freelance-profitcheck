import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pages } from "../pages.mjs";

async function createAdSlotHarness(config) {
  const source = await readFile(new URL("../site.js", import.meta.url), "utf8");
  const definitions = new Map();
  const slots = [];
  const scripts = [];
  const errors = [];
  const windowEvents = new Map();
  class MockHTMLElement {
    constructor() {
      this.dataset = {};
      this.children = [];
      this.hidden = false;
    }
    get firstElementChild() {
      return this.children[0] || null;
    }
    replaceChildren(...children) {
      this.children = children;
    }
  }
  class MockMutationObserver {
    observe() {}
    disconnect() {}
  }
  const document = {
    location: { protocol: "https:", pathname: "/" },
    head: { append: (script) => scripts.push(script) },
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "ad-slot" ? slots : [],
    getElementById: (id) => id === "advertisement-markup" ? {
      content: {
        firstElementChild: {
          cloneNode: () => ({ dataset: {} })
        }
      }
    } : null,
    createElement: (tagName) => ({
      tagName,
      dataset: {},
      listeners: new Map(),
      addEventListener(type, callback) {
        this.listeners.set(type, callback);
      },
      dispatch(type) {
        this.listeners.get(type)?.({});
      }
    })
  };
  const window = {
    location: document.location,
    PROFITCHECK_CONFIG: config,
    addEventListener: (type, callback) => windowEvents.set(type, callback),
    dispatchEvent: (event) => windowEvents.get(event.type)?.(event)
  };
  runInNewContext(source, {
    window, document, HTMLElement: MockHTMLElement, MutationObserver: MockMutationObserver,
    customElements: {
      get: (name) => definitions.get(name),
      define: (name, constructor) => definitions.set(name, constructor)
    },
    console: { error: (...args) => errors.push(args) }
  });
  return {
    window, slots, scripts, errors,
    addSlot(slotId) {
      const slot = new (definitions.get("ad-slot"))();
      slot.dataset.adSlot = slotId;
      slots.push(slot);
      slot.connectedCallback();
      return slot;
    }
  };
}

test("build emits every requested direct-loadable page with a unique title and description", async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const page of pages) {
    const html = await readFile(new URL(`../dist/${page.path}`, import.meta.url), "utf8");
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="(.*?)"/)?.[1];
    assert.ok(title, `${page.path} has a title`);
    assert.ok(description, `${page.path} has a description`);
    assert.match(html, /<h1>/);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!descriptions.has(description), `duplicate description: ${description}`);
    titles.add(title);
    descriptions.add(description);
  }
});

test("build emits robots, sitemap, favicon, social image and a not-found page", async () => {
  for (const file of ["robots.txt", "sitemap.xml", "favicon.svg", "og-image.svg", "404.html"]) {
    const contents = await readFile(new URL(`../dist/${file}`, import.meta.url), "utf8");
    assert.ok(contents.length > 0, `${file} is not empty`);
  }
  const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
  assert.match(sitemap, /<urlset [^>]+>\s*<\/urlset>/);
  assert.doesNotMatch(`${sitemap}\n${robots}`, /YOUR-WORKERS-SUBDOMAIN|Sitemap: https:\/\//);
  assert.match(robots, /Allow: \//);
});

test("privacy and contact pages accurately describe the unconfigured defaults", async () => {
  const privacy = await readFile(new URL("../dist/privacy/index.html", import.meta.url), "utf8");
  const contact = await readFile(new URL("../dist/contact/index.html", import.meta.url), "utf8");
  assert.match(privacy, /local browser storage/);
  assert.match(privacy, /No analytics service or non-essential tracking cookie is configured/);
  assert.match(privacy, /Google AdSense is currently disabled/);
  assert.match(privacy, /consent settings while ads are disabled/);
  assert.match(contact, /does not use a contact form or send messages to a server/);
  assert.match(contact, /contactLink/);
});

test("calculator and invoice data remain browser-local and invoice text is rendered safely", async () => {
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
  assert.match(script, /localStorage\.setItem\(savedKey/);
  assert.match(script, /localStorage\.getItem\(savedKey/);
  assert.match(script, /JSON\.parse\(saved\)/);
  assert.match(script, /!parsed \|\| typeof parsed !== "object" \|\| Array\.isArray\(parsed\)/);
  assert.match(script, /await navigator\.clipboard\.writeText\(estimateSummary\(\)\)/);
  assert.match(script, /output\("resetButton"\)\.addEventListener\("click"/);
  assert.match(script, /function setPreviewText\(id, value\) \{\s*output\(id\)\.textContent = value \|\| "";/);
  assert.match(script, /!\["image\/png", "image\/jpeg", "image\/webp"\]\.includes\(file\.type\) \|\| file\.size > 2 \* 1024 \* 1024/);
  assert.doesNotMatch(script.slice(script.indexOf("const invoiceDialog"), script.indexOf('output("printButton")')), /localStorage/);
});

test("AdSense HTML is present as a template but remains disabled without real IDs", async () => {
  const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const config = await readFile(new URL("../dist/site-config.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../dist/site.js", import.meta.url), "utf8");
  assert.match(home, /<ad-slot data-ad-slot="home-inline"/);
  assert.equal([...home.matchAll(/<ad-slot data-ad-slot="home-inline"/g)].length, 1);
  assert.ok(home.indexOf('<ad-slot data-ad-slot="home-inline"') > home.indexOf('id="calculator"'));
  assert.ok(home.indexOf('<ad-slot data-ad-slot="home-inline"') > home.indexOf('id="calculator-actions"'));
  assert.match(home, /<template id="advertisement-markup">[\s\S]*<ins class="adsbygoogle"/);
  assert.match(config, /adsEnabled: false/);
  assert.match(config, /adsConsentReady: false/);
  assert.match(config, /adsensePublisherId: ""/);
  assert.doesNotMatch(config, /ca-pub-\d{16}/);
  assert.match(runtime, /!config\.adsEnabled/);
  assert.match(runtime, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  const disabledHarness = await createAdSlotHarness({
    adsEnabled: false, adsConsentReady: false, adsensePublisherId: "", adSlots: {}
  });
  disabledHarness.addSlot("home-inline");
  assert.equal(disabledHarness.scripts.length, 0);
});

test("documented quote model matches its taxed and untaxed examples", async () => {
  const howItWorks = await readFile(new URL("../dist/how-it-works/index.html", import.meta.url), "utf8");
  assert.match(howItWorks, /T ÷ \(1 − t\) \+ E\).*÷ \(1 − f\)/);
  assert.match(howItWorks, /₹55,114 at 0% tax and ₹60,796 at 10% tax/);
  assert.doesNotMatch(howItWorks, /target take-home \+ project expenses\).*combined fee rate\).*estimated tax rate/);
});

test("AdSense stays unloaded until a consent adapter grants permission", async () => {
  const disabled = await createAdSlotHarness({
    adsEnabled: false, adsConsentReady: false, adsensePublisherId: "", adSlots: {}
  });
  const disabledSlot = disabled.addSlot("home-inline");
  assert.equal(disabled.scripts.length, 0);
  assert.equal(disabledSlot.hidden, true);

  const harness = await createAdSlotHarness({
    adsEnabled: true,
    adsConsentReady: true,
    adsensePublisherId: "ca-pub-1234567890123456",
    adSlots: { "home-inline": "1234567890", "content-inline": "0987654321" }
  });
  const first = harness.addSlot("home-inline");
  const second = harness.addSlot("content-inline");
  assert.equal(harness.scripts.length, 0);
  assert.equal(first.hidden, true);
  assert.equal(harness.errors.length, 1);
  assert.match(harness.errors[0][0], /no visitor-consent adapter/);

  let allowed = true;
  harness.window.PROFITCHECK_AD_CONSENT = () => allowed;
  harness.window.dispatchEvent({ type: "profitcheck:ads-consent-ready" });
  assert.equal(harness.scripts.length, 1);
  first.connectedCallback();
  assert.equal(harness.scripts.length, 1);
  harness.scripts[0].dispatch("load");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.window.adsbygoogle.length, 2);
  assert.equal(first.hidden, false);
  assert.equal(second.hidden, false);

  allowed = false;
  harness.window.dispatchEvent({ type: "profitcheck:ads-consent-ready" });
  assert.equal(first.hidden, true);
  assert.equal(second.hidden, true);
  const pushesAfterWithdrawal = harness.window.adsbygoogle.length;
  first.connectedCallback();
  assert.equal(harness.window.adsbygoogle.length, pushesAfterWithdrawal);

  allowed = true;
  harness.window.dispatchEvent({ type: "profitcheck:ads-consent-ready" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.scripts.length, 1);
  assert.equal(harness.window.adsbygoogle.length, pushesAfterWithdrawal + 2);
  assert.equal(first.hidden, false);
  assert.equal(first.children.length, 1);
  assert.equal(second.hidden, false);
});

test("a verified SITE_URL generates canonical, Open Graph and sitemap URLs", async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const buildPath = path.join(projectRoot, "build.mjs");
  const configuredBuild = spawnSync(process.execPath, [buildPath], {
    cwd: projectRoot,
    env: { ...process.env, SITE_URL: "https://profitcheck.example" },
    encoding: "utf8"
  });
  assert.equal(configuredBuild.status, 0, configuredBuild.stderr);
  try {
    const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
    const guide = await readFile(new URL("../dist/guides/project-pricing/index.html", import.meta.url), "utf8");
    const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
    const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
    assert.match(home, /rel="canonical" href="https:\/\/profitcheck\.example\/"/);
    assert.match(guide, /rel="canonical" href="https:\/\/profitcheck\.example\/guides\/project-pricing\/"/);
    assert.match(guide, /property="og:url" content="https:\/\/profitcheck\.example\/guides\/project-pricing\/"/);
    assert.match(sitemap, /<loc>https:\/\/profitcheck\.example\/guides\/project-pricing\/<\/loc>/);
    assert.match(robots, /Sitemap: https:\/\/profitcheck\.example\/sitemap\.xml/);
  } finally {
    const environment = { ...process.env };
    delete environment.SITE_URL;
    const restoredBuild = spawnSync(process.execPath, [buildPath], { cwd: projectRoot, env: environment, encoding: "utf8" });
    assert.equal(restoredBuild.status, 0, restoredBuild.stderr);
  }
});

test("consent withdrawal before script load cannot initialize a stale ad element", async () => {
  const harness = await createAdSlotHarness({
    adsEnabled: true,
    adsConsentReady: true,
    adsensePublisherId: "ca-pub-1234567890123456",
    adSlots: { "home-inline": "1234567890" }
  });
  let allowed = true;
  harness.window.PROFITCHECK_AD_CONSENT = () => allowed;
  const slot = harness.addSlot("home-inline");
  const staleAd = slot.children[0];

  allowed = false;
  harness.window.dispatchEvent({ type: "profitcheck:ads-consent-ready" });
  assert.equal(slot.hidden, true);

  allowed = true;
  harness.window.dispatchEvent({ type: "profitcheck:ads-consent-ready" });
  const currentAd = slot.children[0];
  assert.notEqual(currentAd, staleAd);
  harness.scripts[0].dispatch("load");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.window.adsbygoogle.length, 1);
  assert.equal(slot.children[0], currentAd);
});

test("a blocked AdSense script hides every slot instead of leaving ad placeholders", async () => {
  const harness = await createAdSlotHarness({
    adsEnabled: true,
    adsConsentReady: true,
    adsensePublisherId: "ca-pub-1234567890123456",
    adSlots: { "home-inline": "1234567890", "content-inline": "0987654321" }
  });
  harness.window.PROFITCHECK_AD_CONSENT = () => true;
  const first = harness.addSlot("home-inline");
  const second = harness.addSlot("content-inline");
  harness.scripts[0].dispatch("error");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(first.hidden, true);
  assert.equal(second.hidden, true);
  assert.equal(first.children.length, 0);
  assert.equal(harness.errors.length, 1);
});

test("invoice builder includes design selection, details, preview and print controls", async () => {
  const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../dist/script.js", import.meta.url), "utf8");
  assert.match(home, /<dialog class="invoice-dialog" id="invoiceDialog"/);
  for (const control of ["classic", "modern", "minimal", "invoiceSeller", "invoiceSellerPhone", "invoiceSellerWebsite", "invoiceCustomer", "invoiceNumber", "invoiceDueDate", "invoiceLineItems", "addInvoiceLine", "invoiceNotes", "invoicePayee", "invoiceBankName", "invoiceAccountNumber", "invoiceIfsc", "invoiceUpi", "invoicePaymentTerms", "previewInvoice", "printInvoice"]) {
    assert.ok(home.includes(control), `missing invoice control ${control}`);
  }
  assert.match(home, /class="invoice-bottom-grid"/);
  assert.match(home, /id="previewNotesSection"/);
  assert.match(home, /id="previewPaymentSection"/);
  assert.match(script, /addEventListener\("click", openInvoiceCreator\)/);
});

test("estimate print and invoice creation are distinct actions with a complete print surface", async () => {
  const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../dist/script.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../dist/styles.css", import.meta.url), "utf8");
  assert.match(home, /id="printButton">Print estimate \/ Save as PDF/);
  assert.match(home, /id="createInvoiceButton">Create invoice/);
  assert.match(home, /id="estimatePrintSurface"/);
  for (const id of ["printProjectPrice", "printPlatformAmount", "printPaymentAmount", "printExpenses", "printTaxAmount", "printTakehome", "printHourly", "printQuote", "printShortfall"]) {
    assert.ok(home.includes(`id="${id}"`), `print view missing ${id}`);
  }
  assert.match(script, /output\("printButton"\)\.addEventListener\("click", \(\) => \{/);
  assert.match(script, /output\("createInvoiceButton"\)\.addEventListener\("click", openInvoiceCreator\)/);
  assert.match(css, /body\.estimate-printing > \*:not\(#estimatePrintSurface\)/);
});

test("invoice designs each define a distinct visual treatment", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  for (const style of ["classic", "modern", "minimal"]) {
    assert.match(css, new RegExp(`\\.invoice-${style} \\.invoice-paper-header`));
    assert.match(css, new RegExp(`\\.invoice-${style} \\.invoice-table`));
    assert.match(css, new RegExp(`\\.invoice-${style} \\.invoice-total-due`));
    assert.match(css, new RegExp(`\\.${style}-sample`));
  }
});

test("navigation exposes all primary destinations and guides are linked internally", async () => {
  const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  for (const route of ["/guides/", "/how-it-works/", "/about/", "/privacy/", "/terms/", "/contact/"]) {
    assert.ok(home.includes(`href=".${route}"`), `missing internal link to ${route}`);
  }
  const guides = await readFile(new URL("../dist/guides/index.html", import.meta.url), "utf8");
  assert.match(guides, /avoid-underpricing/);
});

test("relative links and assets resolve to real files from every standalone page", async () => {
  const pagePaths = ["index.html", ...pages.map((page) => page.path)];
  for (const pagePath of pagePaths) {
    const html = await readFile(new URL(`../dist/${pagePath}`, import.meta.url), "utf8");
    const pageUrl = new URL(`../dist/${pagePath}`, import.meta.url);
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (href.startsWith("#") || /^(?:https?:|mailto:|data:)/i.test(href)) continue;
      const resolved = new URL(href, pageUrl);
      assert.equal(resolved.protocol, "file:", `${pagePath} contains an unexpected absolute local link: ${href}`);
      const targetPath = fileURLToPath(resolved);
      const localPath = targetPath.endsWith(path.sep) ? path.join(targetPath, "index.html") : targetPath;
      await access(localPath).catch(() => assert.fail(`${pagePath} has a broken standalone link or asset: ${href}`));
    }
  }
});

test("editable root page links into the generated standalone site", async () => {
  const rootHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const rootUrl = new URL("../index.html", import.meta.url);
  for (const route of ["privacy", "terms", "contact", "about", "guides"]) {
    const target = fileURLToPath(new URL(`./dist/${route}/`, rootUrl));
    await access(path.join(target, "index.html")).catch(() => assert.fail(`The source page's ${route} link does not resolve.`));
  }
  assert.match(rootHtml, /href="\.\/dist\/privacy\/"/);
});
