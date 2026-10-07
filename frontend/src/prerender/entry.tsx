import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import DemoPage from "@/pages/demo/DemoPage";
import GuidesPage from "@/pages/guides/GuidesPage";

/**
 * Build-time rendering for the two pages that are meant to rank.
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

/** The head each pre-rendered page carries, instead of the site-wide default. */
export interface PrerenderMeta {
  title: string;
  description: string;
}

export const ROUTES: Record<string, { element: JSX.Element; meta: PrerenderMeta }> = {
  "/demo": {
    element: <DemoPage />,
    meta: {
      title: "See a real cricket auction — CricBid live demo",
      description:
        "Watch a real IPL-style cricket auction replay bid by bid — genuine players, genuine amounts, at the speed it runs on the night. No sign-up needed to look around.",
    },
  },
  "/guides": {
    element: <GuidesPage />,
    meta: {
      title: "How-to guides — run a cricket auction with CricBid",
      description:
        "Short clips showing each task end to end: create a player registration form, register teams, run the bidding, unsell a player, edit players and export results.",
    },
  },
};

/** Render one route to HTML. Throws if asked for a route that is not listed. */
export const render = (pathname: string): string => {
  const route = ROUTES[pathname];
  if (!route) throw new Error(`No pre-render route registered for ${pathname}`);
  return renderToString(
    <StaticRouter location={pathname}>{route.element}</StaticRouter>
  );
};
