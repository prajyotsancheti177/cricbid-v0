import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Per-route canonical and robots tags.
 *
 * This is a single-page app: every URL is served the same index.html, so until
 * now every page on the site carried the homepage's canonical
 * (`https://www.cricbid.online/`). That tells Google the registration form, the
 * demo and the guides are all duplicates of the front page — which is why they
 * were not being indexed on their own.
 *
 * Two things are set on every navigation:
 *
 *  - `<link rel="canonical">` pointing at this URL on the canonical host.
 *  - `<meta name="robots">`, from an allowlist. Anything not on the list is
 *    noindex: the app screens behind a login have nothing to offer a search
 *    result, and the registration and overlay pages are links meant to be
 *    handed to a specific person, not found in a search — a private
 *    tournament's form should not become discoverable because Google crawled it.
 *
 * The allowlist is deliberately a default-deny. A new screen is not indexed
 * until someone decides it should be, which is the safer way round.
 */

/** www 301s to the bare host, so that is what every tag must say. */
const CANONICAL_ORIGIN = "https://cricbid.online";

/** Exact paths that belong in search results. */
const INDEXABLE_EXACT = new Set([
  "/",
  "/login",
  "/privacy-policy",
  "/terms",
  "/delete-account",
  "/demo",
  "/guides",
]);

/** Prefixes whose children belong in search results (e.g. /guides/some-slug). */
const INDEXABLE_PREFIXES = ["/guides/"];

const isIndexable = (pathname: string) => {
  // Trailing slashes aside, "/x" and "/x/" are the same page.
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (INDEXABLE_EXACT.has(path)) return true;
  return INDEXABLE_PREFIXES.some((p) => path.startsWith(p));
};

/** Set (or create) a <meta name="..."> in the head. */
const setMeta = (name: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
};

const setCanonical = (href: string) => {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
};

export const RouteMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const indexable = isIndexable(pathname);

    // The query string is never part of the canonical — ?ref=whatsapp and the
    // bare URL are the same page, and treating them separately splits the
    // signals between them.
    setCanonical(`${CANONICAL_ORIGIN}${pathname}`);

    setMeta(
      "robots",
      indexable
        ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        : "noindex, nofollow"
    );
    // Some crawlers read this one instead of the generic name.
    setMeta("googlebot", indexable ? "index, follow" : "noindex, nofollow");

    // og:url should agree with the canonical, or shares of an app screen
    // advertise the homepage.
    const og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (og) og.content = `${CANONICAL_ORIGIN}${pathname}`;
  }, [pathname]);

  return null;
};

export default RouteMeta;
