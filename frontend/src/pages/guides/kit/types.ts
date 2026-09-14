import type { ComponentType } from "react";

/** One caption on the clip's timeline. Shown from `at` until the next step. */
export interface ClipStep {
    at: number;
    title: string;
    detail?: string;
}

/** A cursor waypoint. Coordinates are in stage pixels (stage is 1280×800). */
export interface CursorKey {
    at: number;
    x: number;
    y: number;
    /** Show a click ripple on arrival. */
    click?: boolean;
}

/** What a clip's scene component receives. */
export interface SceneProps {
    t: number;
}

export interface GuideDefinition {
    slug: string;
    title: string;
    /** One sentence, shown on the card and under the clip. */
    summary: string;
    /** Grouping on the library page. */
    group: "Setup" | "Registration" | "Auction night" | "After the auction";
    /** Who does this. */
    audience: "Organiser" | "Player" | "Team owner" | "Viewer";
    /** Fake browser URL shown in the clip chrome. */
    url: string;
    duration: number;
    steps: ClipStep[];
    cursor: CursorKey[];
    Scene: ComponentType<SceneProps>;
}
