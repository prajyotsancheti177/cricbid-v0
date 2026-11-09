/**
 * Write real HTML for the marketing pages, after `vite build`.
 *
 * Reads dist/index.html as a template, renders each listed route through
 * src/prerender/entry.tsx, and writes dist/<route>/index.html with the markup
 * already in <div id="root"> and a head that describes that page rather than
 * the site in general. The client bundle still boots and takes over, so the
 * page behaves exactly as before once JavaScript runs.
 *
 * nginx must be able to find these files: `try_files $uri $uri/index.html
 * /index.html`. Without the middle term a request for /demo falls straight
 * through to the SPA shell and this work is invisible — see the note printed at
 * the end of a run.
 *
 * NEVER fails the build. A deploy that cannot pre-render should still ship the
 * working site: the pages fall back to client rendering, which is what they did
 * before. It says so loudly instead.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const CANONICAL_ORIGIN = "https://cricbid.online";

/** Replace the first match, leaving the file untouched if the anchor is gone. */
const swap = (html, pattern, replacement, label, warnings) => {
  if (!pattern.test(html)) {
    warnings.push(`could not find ${label} in dist/index.html — left as-is`);
    return html;
  }
  return html.replace(pattern, replacement);
};

/**
 * JSON-LD that only describes the homepage.
 *
 * All six blocks are hard-coded in index.html, so every route carried them —
 * /login claimed eleven FAQs and each guide page repeated the homepage's
 * breadcrumb trail. WebSite and Organization are genuinely site-wide and stay;
 * these four are stripped from every page except "/", which then gets its own
 * back from the route's jsonLd.
 */
const HOMEPAGE_ONLY_LD = ["FAQPage", "ItemList", "BreadcrumbList", "SoftwareApplication"];

/** Remove the ld+json blocks whose @type is in `types`. */
const stripLd = (html, types) =>
  html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (block, body) =>
    types.some((t) => new RegExp(`"@type"\\s*:\\s*"${t}"`).test(body)) ? "" : block);

/** Add this page's own JSON-LD just before </head>. */
const addLd = (html, objects) => {
  if (!objects || !objects.length) return html;
  const tags = objects
    .map((o) => `  <script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join("\n");
  return html.replace("</head>", `${tags}\n</head>`);
};

const escapeAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const main = async () => {
  const templatePath = path.join(dist, "index.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("[prerender] no dist/index.html — run vite build first. Skipping.");
    return;
  }
  const template = fs.readFileSync(templatePath, "utf8");

  // Vite is a devDependency; on a machine that installed production-only it is
  // simply absent, which is a skip rather than a failure.
  let createServer;
  try {
    ({ createServer } = await import("vite"));
  } catch {
    console.warn("[prerender] vite is not installed here — skipping pre-render.");
    return;
  }

  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  const warnings = [];
  let written = 0;

  /**
   * Indexable routes that are not worth server-rendering, but must still carry
   * their own canonical.
   *
   * Every route not listed in ROUTES falls back to dist/index.html, whose
   * canonical is hard-coded to the homepage — so /login and /terms were telling
   * Google they are duplicates of the front page before any JavaScript ran.
   * That is what Search Console reports as "Alternative page with proper
   * canonical tag". Writing a copy with the right canonical costs nothing and
   * needs no SSR; RouteMeta still fills in the rest once the app boots.
   *
   * Keep in step with INDEXABLE_EXACT in src/components/seo/RouteMeta.tsx.
   */
  const HEAD_ONLY_ROUTES = ["/login", "/terms", "/privacy-policy", "/delete-account"];
  try {
    const { ROUTES, render } = await vite.ssrLoadModule("/src/prerender/entry.tsx");

    for (const [route, { meta }] of Object.entries(ROUTES)) {
      const body = render(route);
      const url = `${CANONICAL_ORIGIN}${route}`;

      let html = template;
      html = swap(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(meta.title)}</title>`, "<title>", warnings);
      html = swap(html, /<meta name="description" content="[\s\S]*?" \/>/,
        `<meta name="description" content="${escapeAttr(meta.description)}" />`, 'meta[name="description"]', warnings);
      html = swap(html, /<link rel="canonical" href="[^"]*" \/>/,
        `<link rel="canonical" href="${url}" />`, 'link[rel="canonical"]', warnings);
      html = swap(html, /<meta property="og:url" content="[^"]*" \/>/,
        `<meta property="og:url" content="${url}" />`, 'meta[property="og:url"]', warnings);
      html = swap(html, /<div id="root"><\/div>/,
        `<div id="root">${body}</div>`, '<div id="root">', warnings);

      // The homepage keeps the blocks that describe it; everything else is
      // given schema about itself instead.
      if (route !== "/") {
        html = stripLd(html, HOMEPAGE_ONLY_LD);
        html = addLd(html, ROUTES[route].jsonLd);
      }

      // "/" cannot be written to dist/index.html: nginx serves that file as the
      // SPA fallback for every unmatched route, so the homepage's markup would
      // be the first paint of /auction, /c/<code> and every tournament link.
      // It goes to its own file, which nginx serves for "/" alone:
      //     location = / { try_files /home.html /index.html; }
      // The fallback in that line means an older build without home.html still
      // works — it just client-renders, as it does today.
      let outPath;
      if (route === "/") {
        outPath = path.join(dist, "home.html");
      } else {
        const outDir = path.join(dist, route.replace(/^\//, ""));
        fs.mkdirSync(outDir, { recursive: true });
        outPath = path.join(outDir, "index.html");
      }
      fs.writeFileSync(outPath, html);
      written++;
      console.log(`[prerender] ${route} -> ${path.relative(dist, outPath)} (${(body.length / 1024).toFixed(1)} KB of markup)`);
    }
  } finally {
    await vite.close();
  }

  for (const route of HEAD_ONLY_ROUTES) {
    const url = `${CANONICAL_ORIGIN}${route}`;
    let html = template;
    html = swap(html, /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${url}" />`, 'link[rel="canonical"]', warnings);
    html = swap(html, /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${url}" />`, 'meta[property="og:url"]', warnings);
    // A sign-in or legal page is not the product listing, the FAQ, or the
    // homepage's breadcrumb trail.
    html = stripLd(html, HOMEPAGE_ONLY_LD);

    const outDir = path.join(dist, route.replace(/^\//, ""));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html);
    written++;
    console.log(`[prerender] ${route} -> dist${route}/index.html (canonical only)`);
  }

  for (const w of warnings) console.warn(`[prerender] WARNING: ${w}`);
  console.log(`[prerender] wrote ${written} page(s). nginx needs:`);
  console.log(`[prerender]   location = / { try_files /home.html /index.html; }`);
  console.log(`[prerender]   location /   { try_files $uri $uri/index.html /index.html; }`);
};

main().catch((err) => {
  // Loud, but never fatal: the site still works client-rendered.
  console.warn("[prerender] FAILED — shipping client-rendered pages instead.");
  console.warn(err?.stack || err);
});
