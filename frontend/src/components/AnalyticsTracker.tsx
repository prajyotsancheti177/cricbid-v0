import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView, startHeartbeat } from "@/lib/eventTracker";

/**
 * Pull the tournament id out of the path. This component sits above the route
 * tree, so `useParams` would always be empty here.
 */
const TOURNAMENT_PATHS = [
    /^\/tournament\/([^/]+)/,
    /^\/register\/([^/]+)/,
    /^\/team-register\/([^/]+)/,
    /^\/auction\/room\/([^/]+)/,
];

const extractTournamentId = (pathname: string): string | undefined => {
    for (const pattern of TOURNAMENT_PATHS) {
        const match = pathname.match(pattern);
        if (match) return match[1];
    }

    // Routes like /players and /teams carry no id in the path but are scoped to
    // the selected tournament. Read localStorage directly rather than going via
    // getSelectedTournamentId(), which substitutes a hardcoded placeholder id
    // when nothing is selected — that id matches no row, and UserEvent.tournamentId
    // is a foreign key, so writing it would fail the whole insert.
    return localStorage.getItem("selectedTournamentId") || undefined;
};

/**
 * Site-wide page-view tracking.
 *
 * Page views used to be tracked by an ad-hoc `trackPageView` call inside seven
 * individual pages, so the landing page, both public registration flows, the
 * OBS overlays and the entire tournament workspace were invisible to analytics.
 * Mounting this once inside the router covers every route instead.
 *
 * Rendered inside <BrowserRouter> so it can read the current location.
 */
const AnalyticsTracker = () => {
    const location = useLocation();

    // One page_view per route change. Search params are dropped: they carry
    // registration tokens and similar, and the route itself is the useful unit.
    useEffect(() => {
        // OBS browser sources sit on an overlay URL for hours and are not people.
        if (location.pathname.startsWith("/overlay/")) return;

        trackPageView(location.pathname, extractTournamentId(location.pathname));
    }, [location.pathname]);

    // Presence heartbeat for the live active-users counter. Started once and
    // stopped on unmount; it reports nothing while the tab is hidden.
    useEffect(() => {
        if (location.pathname.startsWith("/overlay/")) return;
        return startHeartbeat();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
};

export default AnalyticsTracker;
