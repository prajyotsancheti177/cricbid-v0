import type { GuideDefinition } from "./kit/types";
import CreateTournament from "./clips/CreateTournament";
import BidSlabs from "./clips/BidSlabs";
import RegistrationForm from "./clips/RegistrationForm";
import PlayerRegisters from "./clips/PlayerRegisters";
import TeamRegistration from "./clips/TeamRegistration";
import TopUpBudget from "./clips/TopUpBudget";
import RunBidding from "./clips/RunBidding";
import UnsellPlayer from "./clips/UnsellPlayer";
import EditPlayer from "./clips/EditPlayer";
import AddPlayers from "./clips/AddPlayers";
import ShareLive from "./clips/ShareLive";
import ExportData from "./clips/ExportData";

/** Every guide clip, in the order the library shows them. */
export const GUIDES: GuideDefinition[] = [CreateTournament, BidSlabs, RegistrationForm, PlayerRegisters, TeamRegistration, TopUpBudget, RunBidding, UnsellPlayer, EditPlayer, AddPlayers, ShareLive, ExportData];

export const GROUP_ORDER: GuideDefinition["group"][] = ["Setup", "Registration", "Auction night", "After the auction"];

export const findGuide = (slug?: string) => GUIDES.find((g) => g.slug === slug);
