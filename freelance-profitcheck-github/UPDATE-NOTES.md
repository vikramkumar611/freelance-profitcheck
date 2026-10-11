# Freelance ProfitCheck India — update notes

This update is based on the supplied `freelance-profitcheck(1).zip` source.

## Changes made
- Limited the production ad layout to one responsive AdSense placement on the homepage below the calculator/results section.
- Removed the automatically injected ad placement from guide, about, contact, privacy, terms, and how-it-works pages.
- Updated the AdSense setup documentation to describe the single homepage placement and the required real configuration.
- Kept advertising disabled by default. No publisher ID, ad-unit ID, CMP, or consent state has been fabricated.
- Preserved the existing calculator, quote formula, local browser saving, invoice builder, print/PDF flow, guide pages, and responsive styles.

## Verification
- `npm test`: 35 tests passed, 0 failed.
- `npm run build`: successful.

## Owner tasks before deployment/monetization
1. Set `SITE_URL` to the actual production HTTPS origin at build time.
2. Deploy and check canonical URLs, sitemap, robots.txt, and direct navigation on the real domain.
3. Finish a real consent-management platform integration that correctly communicates consent to Google and supports withdrawal, where required.
4. Enter the real AdSense publisher ID and homepage ad-unit ID in `site-config.js` only after receiving them from the AdSense account.
5. Keep `adsEnabled: false` until all required settings and consent behavior are verified. Google approval is separate and cannot be guaranteed by code.
