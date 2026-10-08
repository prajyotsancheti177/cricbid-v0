/**
 * The title and description for each page that is meant to rank.
 *
 * One place, because there are two consumers that have to agree: the build-time
 * pre-render writes these into dist/<route>/index.html for crawlers, and the
 * page itself sets the title once React takes over. They were written out
 * separately at first and immediately drifted — a crawler read one title and a
 * visitor saw another.
 *
 * Deliberately free of any server-only import, so a page component can use it
 * without dragging react-dom/server into the browser bundle.
 */

export interface PageMeta {
  title: string;
  description: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  "/demo": {
    title: "See a real cricket auction — CricBid live demo",
    description:
      "Watch a real IPL-style cricket auction replay bid by bid — genuine players, genuine amounts, at the speed it runs on the night. No sign-up needed to look around.",
  },
  "/guides": {
    title: "How-to guides — run a cricket auction with CricBid",
    description:
      "Short clips showing each task end to end: create a player registration form, register teams, run the bidding, unsell a player, edit players and export results.",
  },
};
