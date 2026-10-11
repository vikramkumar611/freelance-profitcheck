const config = window.PROFITCHECK_CONFIG || {};
let adsScriptPromise;
let consentAdapterWarningShown = false;
const initializedAds = new WeakSet();

if (window.location.protocol === "file:") {
  document.querySelectorAll('a[href]').forEach((anchor) => {
    const target = new URL(anchor.getAttribute("href"), window.location.href);
    if (target.protocol === "file:" && target.pathname.endsWith("/")) {
      target.pathname = `${target.pathname.replace(/\/+$/, "")}/index.html`;
      anchor.href = target.href;
    }
  });
}

if (config.canonicalBaseUrl) {
  const canonicalBase = config.canonicalBaseUrl.replace(/\/+$/, "");
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${canonicalBase}${window.location.pathname}`;
    document.head.append(canonical);
  }
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = canonical.href;
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.content = `${canonicalBase}/og-image.svg`;
}

const menuButton = document.querySelector(".nav-toggle");
menuButton?.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  document.querySelector(".nav-links")?.classList.toggle("is-open", !expanded);
});

const contactLink = document.getElementById("contactLink");
if (contactLink && /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(config.contactEmail || "")) {
  contactLink.href = `mailto:${encodeURIComponent(config.contactEmail)}?subject=Freelance%20ProfitCheck%20feedback`;
  contactLink.hidden = false;
  const unavailable = document.getElementById("contactUnavailable");
  if (unavailable) unavailable.hidden = true;
}

function hasAdvertisingConsent(slotId) {
  if (config.adsConsentReady !== true) return false;
  if (typeof window.PROFITCHECK_AD_CONSENT !== "function") {
    if (config.adsEnabled && !consentAdapterWarningShown) {
      consentAdapterWarningShown = true;
      console.error("AdSense remains disabled because no visitor-consent adapter is installed.");
    }
    return false;
  }
  try {
    return window.PROFITCHECK_AD_CONSENT(slotId) === true;
  } catch (error) {
    console.error("Advertising consent could not be checked; ads remain disabled.", error);
    return false;
  }
}

class AdSlot extends HTMLElement {
  connectedCallback() {
    const slotId = this.dataset.adSlot;
    const publisherId = config.adsensePublisherId;
    const unitId = config.adSlots?.[slotId];
    if (!config.adsEnabled || !/^ca-pub-\d{16}$/.test(publisherId || "") ||
      !/^\d{10}$/.test(unitId || "") || !hasAdvertisingConsent(slotId)) {
      this.hidden = true;
      this.replaceChildren();
      initializedAds.delete(this);
      return;
    }
    if (initializedAds.has(this)) return;

    this.hidden = false;
    this.className = "ad-slot";
    const template = document.getElementById("advertisement-markup");
    if (!template) {
      this.hidden = true;
      console.error("Advertisement markup template is missing.");
      return;
    }
    const ad = template.content.firstElementChild.cloneNode(false);
    ad.dataset.adClient = publisherId;
    ad.dataset.adSlot = unitId;
    this.replaceChildren(ad);

    if (!adsScriptPromise) {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.profitcheckAds = "true";
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
      adsScriptPromise = new Promise((resolve, reject) => {
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", () => reject(new Error("Advertisement script could not be loaded.")), { once: true });
      }).catch((error) => {
        document.querySelectorAll("ad-slot").forEach((slot) => {
          slot.hidden = true;
          slot.replaceChildren();
        });
        console.error("Advertisement script could not be loaded.", error);
        return false;
      });
      document.head.append(script);
    }

    adsScriptPromise.then((loaded) => {
      if (loaded === false || this.hidden || this.firstElementChild !== ad || initializedAds.has(this)) return;
      const observer = new MutationObserver(() => {
        if (ad.dataset.adStatus === "unfilled") {
          observer.disconnect();
          this.hidden = true;
          this.replaceChildren();
          initializedAds.delete(this);
        }
      });
      observer.observe(ad, { attributes: true, attributeFilter: ["data-ad-status"] });
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        initializedAds.add(this);
      } catch (error) {
        observer.disconnect();
        this.hidden = true;
        console.error("Advertisement slot failed to initialize.", error);
      }
    });
  }
}

if (!customElements.get("ad-slot")) customElements.define("ad-slot", AdSlot);

window.addEventListener("profitcheck:ads-consent-ready", () => {
  document.querySelectorAll("ad-slot").forEach((slot) => slot.connectedCallback());
});
