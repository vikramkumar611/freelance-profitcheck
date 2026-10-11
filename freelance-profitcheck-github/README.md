# Freelance ProfitCheck India

A responsive, browser-based project profit and target-quote calculator for freelancers. Calculations and saved estimates stay in the user's browser; there is no account, database, paid API, analytics or enabled advertising.

## Technology

- Semantic HTML, responsive CSS and dependency-light browser JavaScript.
- Pure ES-module calculation functions with Node's built-in test runner.
- A small Node build script for static routes, SEO files and assets.
- Cloudflare Workers static assets served by a minimal Worker through Wrangler.

## Prerequisites

- Windows 10/11.
- Node.js 22 or newer and npm (Wrangler's locked dependencies require Node.js 22+).
- A Cloudflare account with Workers and a `workers.dev` subdomain enabled to deploy. A purchased domain is not required.

## Windows setup and local use

Open PowerShell in the project folder:

```powershell
npm ci
npm test
npm run dev
```

Wrangler prints a local URL. Open it in a browser to test the site. `npm test` builds the static output first and runs calculator and generated-route checks. To build without starting a server:

```powershell
npm run build
```

Generated files go to `dist\`. Open `dist\index.html` when testing the finished standalone site directly; the source `index.html` remains editable and its site-navigation links lead into `dist\`. Use Wrangler for full Worker route and asset behavior.

## Cloudflare Workers deployment

1. Create/sign in to a Cloudflare account and enable the free `workers.dev` subdomain in the Cloudflare dashboard.
2. From PowerShell in this folder, authenticate Wrangler:

   ```powershell
   npx wrangler login
   ```

3. Deploy the Worker:

   ```powershell
   npm run deploy
   ```

4. Wrangler prints the deployed `workers.dev` URL. This repository does not contain a verified production domain or Cloudflare account subdomain; the Worker name in `wrangler.toml` alone is not enough to determine the public URL. If the Worker is already deployed, get its live URL from Cloudflare Workers & Pages and verify that it serves this site. Then set that exact HTTPS origin and redeploy:

   ```powershell
   $env:SITE_URL = "https://YOUR-ACTUAL-WORKER.workers.dev"
   npm run deploy
   Remove-Item Env:SITE_URL
   ```

   Replace the example with the verified URL (no path, query or trailing slash). Without it, the build leaves canonical and Open Graph URLs out, produces an empty sitemap and omits the Sitemap directive from `robots.txt`; do not submit that sitemap to Search Console.

The Worker is named `freelance-profitcheck-india` in `wrangler.toml`. You may change this before the first deployment if the name is unavailable. No secrets or environment variables are required for normal use. `SITE_URL` is an optional build-time public URL, not a secret.

## Custom domain later

After deployment, use the Cloudflare dashboard to add a custom domain to the Worker and complete any DNS setup it requests. Set `$env:SITE_URL` to the final HTTPS origin and deploy again. The application generates canonical URLs only when `canonicalBaseUrl` is configured through that environment variable at build time or in `site-config.js`.

## Google AdSense setup and readiness

**Current ad layout:** the production build includes one responsive AdSense placement on the homepage, below the calculator/results section. Guide and information pages do not contain ad placements. Ads remain disabled until you provide real AdSense identifiers and complete a genuine consent-management integration; this ZIP does not contain fabricated IDs or a fake consent banner.


### Current status

- AdSense is **disabled**. No Google advertising script is loaded, and the ad slots are hidden.
- There is no publisher ID, ad-unit ID, live consent-management platform (CMP), or verified production URL in this project configuration. Approval and deployment have not been verified here.
- The privacy policy is linked in the footer. It accurately says ads are disabled and that no ad consent-settings control is active.
- The two restrained placements are below the calculator/results area and after the main content on guide/information pages; neither is inside the calculator controls. Slot space is modest, responsive and hidden if the script fails or returns an unfilled ad.
- The runtime fails closed: ads need valid IDs, `adsEnabled`, the explicit readiness flag, and a consent adapter result. One script is shared across slots; a script error hides all slots.

### Steps in your Google account

1. Sign in to or create an account at [Google AdSense](https://www.google.com/adsense/start/). Add the **verified public website domain** in the **Sites** section. Do not assume the Wrangler Worker name is your domain.
2. Complete the ownership/site-connection instructions shown in your account. Google may require you to add its site-verification code or AdSense code; use the exact code/account workflow it provides.
3. Review the site and comply with the current [Google Publisher Policies](https://support.google.com/adsense/answer/48182?hl=en). Only Google can decide whether the account/site is approved or ready.
4. Find the public publisher ID in your AdSense account (commonly under **Account > Settings > Account information**) and create the display ad units you intend to use (commonly under **Ads > By ad unit**). Copy the publisher ID (`ca-pub-` plus 16 digits) and each real 10-digit ad-unit ID. Account navigation labels can change, so follow the current account prompts. IDs are public identifiers, not passwords; never put Google passwords, account credentials, API keys or other secrets in this website.
5. Check Google's current [EU user consent policy](https://www.google.com/about/company/user-consent-policy/) and applicable law for your actual visitor regions. Where required by Google's current product policies (including EEA/UK/Switzerland requirements), choose and configure a Google-certified CMP that supports the required consent framework; AdSense also has a **Privacy & messaging** area for applicable consent messages. The site currently has **no CMP**. The readiness flag and adapter hook below are fail-closed integration points, not a consent banner, not a CMP, and not proof of consent or compliance. A real CMP integration must make each visitor's decision effective before ad requests, communicate the applicable signals to Google, and support withdrawal/revocation. Do not enable ads until that complete behavior has been implemented and tested.
6. Before enabling anything, update the privacy policy with the actual provider, cookies/similar technologies, processing, relevant choices, and an accessible way for visitors to revisit/revoke consent through the selected CMP. A privacy-policy link alone does not replace an applicable consent interface. Do not suggest that keeping calculator inputs local disables Google's separate ad processing.
7. After adding/verifying the site, check its current status and alerts in the AdSense **Sites** section, complete any ownership/review actions shown there, and only rely on the status Google displays. Google alone decides approval; this project cannot request or verify account review.
8. AdSense says `ads.txt` is not mandatory but recommends it. If the AdSense account supplies an `ads.txt` record, paste the exact public line(s) into `adsTxtLines` in `site-config.js`, matching the configured publisher ID. The build writes those lines to `dist\ads.txt`; verify the deployed `https://<your-domain>/ads.txt` URL and the **Sites** status in AdSense. Never invent a seller record.

### Project configuration (only after the steps above)

In VS Code, open `site-config.js`. The current safe defaults are:

```js
adsEnabled: false,
adsConsentReady: false,
adsensePublisherId: "",
adSlots: {},
adsTxtLines: []
```

Supply only values copied from the account: `adsensePublisherId`, a real ID for each existing placement (`home-inline`, `content-inline`), and any exact `adsTxtLines`. Set `adsConsentReady: true` only after the CMP and its Google consent signaling/revocation path are actually integrated and checked. The runtime also requires a CMP adapter to define `window.PROFITCHECK_AD_CONSENT(slotId)` and return `true` only when that visitor's current applicable consent allows the request. Once the adapter has a current consent decision (and on each decision change), it must dispatch `window.dispatchEvent(new Event("profitcheck:ads-consent-ready"))`. No adapter is included now, so the runtime denies ads even if IDs are present. The event/hook is an integration contract only; it does not implement TCF, send Google's consent signals, or itself reverse an already-issued ad request. You must wire and test it with the chosen CMP before setting the readiness flag.

The build rejects `adsEnabled: true` if the consent-readiness flag, publisher ID, or any placement ID is missing/invalid. The runtime additionally rejects malformed IDs and no-consent decisions. Use separate unit IDs for the two placements. To disable ads immediately, set `adsEnabled: false`; rebuild and redeploy. Because all of this configuration is client-side/public, it must contain identifiers only.

Official references: [Google Publisher Policies](https://support.google.com/adsense/answer/48182?hl=en), [Google User Consent Policy](https://www.google.com/about/company/user-consent-policy/), and [AdSense ads.txt guidance](https://support.google.com/adsense/answer/12171612?hl=en). Policies change; check the current account instructions before applying or enabling ads. Never click your own ads, buy artificial traffic, encourage ad clicks, or claim approval/revenue that Google has not confirmed.

## Privacy, contact and limitations

- Saving writes the estimate only to browser `localStorage`; it is not synced and may be visible to other people using the same browser profile.
- Analytics and tracking are not configured.
- The contact page displays a `mailto:` link only after a real, monitored address is set in `site-config.js`. No contact form backend exists.
- Fee inputs are user assumptions, not official provider rates. The optional tax calculation is a simplified estimate, not tax, legal, accounting or financial advice.
- The target quote uses `(target take-home ÷ (1 − estimated tax rate) + project expenses) ÷ (1 − combined percentage fee rate)` and rounds upward to the next rupee. It models tax on positive profit after quoted-price fees and expenses; real-world provider fees and tax treatment can differ.
- **Print estimate / Save as PDF** prints the current calculator assumptions and estimate separately from **Create invoice**, which opens the customer invoice builder. Both outputs are user-initiated; invoices and uploaded logos are not stored by this site.
- **Create invoice** opens the invoice builder with Classic, Modern and Minimal designs. Enter seller contact details (including optional phone, website and logo), customer and invoice dates, add up to 20 service or product lines, and include optional tax, amount paid, notes, and payee/bank/account/IFSC/UPI details. The invoice preview groups notes, payment information and totals into a printable business-invoice layout. Invoice details are not saved by the site. The invoice is an editable document template, not a determination that it satisfies GST invoice requirements.
- The included social preview image is SVG; some social services may require a PNG/JPEG conversion for rich previews.

## SEO and site configuration

- Every generated content route has a unique title, description, Open Graph title/description and a semantic heading structure.
- `npm run build` creates `dist\sitemap.xml`, `dist\robots.txt`, a 404 page and direct-loadable static routes. Until `SITE_URL` is the verified production HTTPS origin, the sitemap is intentionally empty, the robots file omits its sitemap directive, and canonical/Open Graph URLs are omitted rather than fabricated.
- Set `SITE_URL` to the final HTTPS origin when building for deployment. No production origin is currently verified in `wrangler.toml`.
- `site-config.js` also holds the optional public canonical origin, contact email, and ad configuration. Never put secrets in this client-side file.
- Favicon and social image are original SVG assets. There are no external font or tracking dependencies.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked Wrangler development dependency |
| `npm test` | Build the site and run calculator and route/SEO tests |
| `npm run build` | Generate the static site in `dist\` |
| `npm run dev` | Build and run the site locally through Wrangler |
| `npm run deploy` | Build and deploy the Worker |

If Wrangler reports that the worker name is already taken, edit `name` in `wrangler.toml`. If deployment authentication fails, run `npx wrangler login` again. If internal URLs return 404, run `npm run build` before starting Wrangler and check that the generated route exists under `dist\`.
