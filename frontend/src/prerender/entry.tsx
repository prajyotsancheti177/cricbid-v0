import { renderToString } from "react-dom/server";
import { Route, Routes } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import Home from "@/pages/Home";
import DemoPage from "@/pages/demo/DemoPage";
import GuidesPage from "@/pages/guides/GuidesPage";
import GuideClipPage from "@/pages/guides/GuideClipPage";
import { GUIDES } from "@/pages/guides/registry";
import { PAGE_META, type PageMeta } from "@/lib/pageMeta";

/**
 * Build-time rendering for the pages that are meant to rank.
 *
 * Everything else on the site is fine as a client-rendered shell — it is behind
 * a login, or it is a link handed to one person. But /demo and /guides are the
 * marketing pages, and as a single-page app they arrived at a crawler as an
 * empty <div id="root"> with the generic site title. Google does render
 * JavaScript, so they were not invisible; they were just queued for a second,
 * slower pass, and whatever it eventually saw had to be reconstructed rather
 * than read.
 *
 * These two pages are static content with no data fetching, and every call into
 * `window` or `document` sits inside an effect — effects do not run during
 * renderToString — so they render on the server as they are, with no
 * SSR-specific branches to keep in step.
 *
 * Used by scripts/prerender.mjs after `vite build`. Deliberately not wired into
 * the client bundle.
 */

/**
 * The pages to pre-render. The head text comes from src/lib/pageMeta.ts, which
 * the page components read too — one string, two consumers, no drift.
 */
const ORIGIN = "https://cricbid.online";

/** Home > Guides > this page, as a real trail rather than the homepage's. */
const breadcrumb = (trail: Array<{ name: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.name,
    item: `${ORIGIN}${t.path}`,
  })),
});

interface PrerenderRoute {
  element: JSX.Element;
  meta: PageMeta;
  /** JSON-LD describing THIS page, added after the homepage-only blocks are stripped. */
  jsonLd?: unknown[];
  /**
   * The route pattern, when it differs from the path. A clip page reads its
   * slug with useParams, which needs a matching <Route> — without one every
   * clip renders "That guide doesn't exist."
   */
  pattern?: string;
}

/**
 * One entry per clip, built from the same registry the site renders from, so a
 * new guide is pre-rendered without touching this file. Each was previously an
 * empty shell carrying the homepage's title and canonical: twelve indexable
 * pages telling Google they were duplicates of the front page.
 */
const CLIP_ROUTES: Record<string, PrerenderRoute> = Object.fromEntries(
  GUIDES.map((g) => [
    `/guides/${g.slug}`,
    {
      element: <GuideClipPage />,
      pattern: "/guides/:slug",
      meta: { title: `${g.title} — CricBid guide`, description: g.summary },
      // Each clip is a numbered procedure, which is exactly what HowTo
      // describes. The steps are the same ones the clip captions, so the
      // markup and what a reader sees cannot drift.
      //
      // No totalTime: `duration` is how long the clip runs, not how long the
      // task takes, and claiming otherwise would be a lie in structured data.
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: g.title,
          description: g.summary,
          url: `${ORIGIN}/guides/${g.slug}`,
          step: g.steps.map((st, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: st.title,
            text: st.detail ?? st.title,
            url: `${ORIGIN}/guides/${g.slug}`,
          })),
        },
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: g.title, path: `/guides/${g.slug}` },
        ]),
      ],
    },
  ])
);

export const ROUTES: Record<string, PrerenderRoute> = {
  "/": { element: <Home />, meta: PAGE_META["/"] },
  "/demo": {
    element: <DemoPage />,
    meta: PAGE_META["/demo"],
    jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "Demo", path: "/demo" }])],
  },
  "/guides": {
    element: <GuidesPage />,
    meta: PAGE_META["/guides"],
    jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])],
  },
  ...CLIP_ROUTES,
};

/** Render one route to HTML. Throws if asked for a route that is not listed. */
export const render = (pathname: string): string => {
  const route = ROUTES[pathname];
  if (!route) throw new Error(`No pre-render route registered for ${pathname}`);
  return renderToString(
    <StaticRouter location={pathname}>
      <Routes>
        <Route path={route.pattern ?? pathname} element={route.element} />
      </Routes>
    </StaticRouter>
  );
};
