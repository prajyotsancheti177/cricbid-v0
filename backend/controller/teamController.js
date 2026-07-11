// const { Schema, default: mongoose } = require("mongoose");
// const team = require("../models/team");
// const tournament = require("../models/tournament");


const teamService = require("../services/teamService");
const auctionStateManager = require("../services/auctionStateManager");
const { sendSuccess, sendError } = require("../utils");



const addTeam = async (req, res) => {
    try {
        const team = await teamService.addTeam(req.body);
        return sendSuccess(res, 201, "Team added successfully!", team)
    } catch (error) {
        return sendError(res, 400, "Failed to add team!", error)
    }
}

const registerTeamPublic = async (req, res) => {
    try {
        let { name, ownerName, ownerMobile, touranmentId, tournamentId } = req.body;
        
        let tId = touranmentId || tournamentId;

        if (!tId) {
            throw new Error("Tournament ID is required");
        }

        let logoUrl = req.body.logo || "";

        // Process uploaded files mapped by multer-s3 / local
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(file => {
                if (file.fieldname === 'logo') {
                    logoUrl = file.location || file.path; 
                }
            });
        }

        const teamInput = {
            name: name?.trim(),
            logo: logoUrl,
            touranmentId: tId,
            owner: {
                name: ownerName?.trim() || "",
                mobile: ownerMobile?.trim() || ""
            }
        };

        const team = await teamService.addTeam(teamInput);
        return sendSuccess(res, 201, "Team registered successfully!", team);
    } catch (error) {
        return sendError(res, 400, "Failed to register team!", error);
    }
}

const getTournamentTeamsReport = async (req, res) => {
    try {
        const report = await teamService.getTournamentTeamsReport(req.body.touranmentId)
        return sendSuccess(res, 200, "Tournament Teams report", report)
    } catch (error) {
        return sendError(res, 400, "Failed to get tournamnet teams report!", error)
    }
}

const getTeamReport = async (req, res) => {
    try {
        const report = await teamService.getTeamReport(req.body.teamId)
        return sendSuccess(res, 200, "Team report", report)
    } catch (error) {
        return sendError(res, 400, "Failed to get  team report!", error)
    }
}

// Refresh & broadcast to any live auction room for this tournament so a
// team change (edit, delete, top-up) shows up immediately, same as after a sale.
const broadcastTeamsChanged = async (req, touranmentId) => {
    if (!touranmentId) return;
    try {
        const teamsReport = await teamService.getTournamentTeamsReport(touranmentId);
        const teams = teamsReport?.[0]?.teams || [];
        auctionStateManager.updateTeams(touranmentId, teams);
        const io = req.app.get("io");
        const newState = auctionStateManager.getAuctionState(touranmentId);
        if (io && newState) io.of("/auction").to(touranmentId).emit("auction:state", newState);
    } catch (broadcastError) {
        console.error("Failed to broadcast teams change:", broadcastError);
    }
};

const updateTeam = async (req, res) => {
    try {
        const { teamId, name, ownerName, ownerEmail, ownerMobile, userId } = req.body;

        // logo: undefined (client didn't send it) leaves it untouched; a new
        // uploaded file overrides it. Never fall back to "" here — that would
        // wipe an existing logo just because no replacement was chosen.
        let logo = req.body.logo;
        if (req.files && Array.isArray(req.files)) {
            const logoFile = req.files.find(f => f.fieldname === 'logo');
            if (logoFile) logo = logoFile.location || logoFile.path;
        }

        const hasOwnerFields = ownerName || ownerEmail || ownerMobile;
        const updatedTeam = await teamService.updateTeam({
            teamId,
            userId,
            name,
            logo,
            owner: hasOwnerFields ? { name: ownerName, email: ownerEmail, mobile: ownerMobile } : undefined,
        });
        await broadcastTeamsChanged(req, updatedTeam.touranmentId);
        return sendSuccess(res, 200, "Team updated successfully", updatedTeam);
    } catch (error) {
        return sendError(res, 400, "Failed to update team!", error);
    }
};

const deleteTeam = async (req, res) => {
    try {
        const { teamId, userId } = req.body;
        const result = await teamService.deleteTeam({ teamId, userId });
        await broadcastTeamsChanged(req, result.touranmentId);
        return sendSuccess(res, 200, "Team deleted successfully", result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete team!", error);
    }
};

const topUpTeamBudget = async (req, res) => {
    try {
        const { teamId, amount, note, userId } = req.body;
        const result = await teamService.topUpTeamBudget({ teamId, amount, note, userId });
        await broadcastTeamsChanged(req, result.touranmentId);
        return sendSuccess(res, 201, "Team balance topped up successfully", result);
    } catch (error) {
        return sendError(res, 400, "Failed to top up team balance!", error);
    }
};

const getTeamBudgetTopups = async (req, res) => {
    try {
        const topups = await teamService.getTeamBudgetTopups(req.body.touranmentId);
        return sendSuccess(res, 200, "Team budget top-up history fetched successfully", topups);
    } catch (error) {
        return sendError(res, 400, "Failed to get team budget top-up history!", error);
    }
};

const deleteTeamBudgetTopup = async (req, res) => {
    try {
        const { topupId, userId } = req.body;
        const result = await teamService.deleteTeamBudgetTopup({ topupId, userId });
        await broadcastTeamsChanged(req, result.touranmentId);
        return sendSuccess(res, 200, "Top-up deleted successfully", result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete top-up!", error);
    }
};

const getTeamNames = async (req, res) => {
    try {
        const teams = await teamService.getTeamNames(req.body.touranmentId);
        return sendSuccess(res, 200, "Team names fetched successfully", teams);
    } catch (error) {
        return sendError(res, 400, "Failed to get team names!", error);
    }
};

const getTeamNamesAndBudget = async (req, res) => {
    try {
        const teams = await teamService.getTeamNamesAndBudget(req.body.touranmentId);
        return sendSuccess(res, 200, "Team names and budget fetched successfully", teams);
    } catch (error) {
        return sendError(res, 400, "Failed to get team names and budget!", error);
    }
};

const bulkCreateTeams = async (req, res) => {
    try {
        const teams = await teamService.bulkCreateTeams(req.body.teams, req.body.touranmentId);
        return sendSuccess(res, 201, "Teams created successfully!", teams);
    } catch (error) {
        return sendError(res, 400, "Failed to create teams!", error);
    }
};

const deleteAllTeams = async (req, res) => {
    try {
        const result = await teamService.deleteAllTeamsByTournament(req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete teams!", error);
    }
};

module.exports = {
    addTeam,
    registerTeamPublic,
    getTournamentTeamsReport,
    getTeamReport,
    updateTeam,
    deleteTeam,
    topUpTeamBudget,
    getTeamBudgetTopups,
    deleteTeamBudgetTopup,
    getTeamNames,
    getTeamNamesAndBudget,
    bulkCreateTeams,
    deleteAllTeams
}