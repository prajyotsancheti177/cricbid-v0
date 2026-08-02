const bookingService = require("../services/bookingService");
const { sendSuccess, sendError } = require("../utils");

// helper: map thrown errors (with optional .status) to a response
const fail = (res, err) => sendError(res, err.status || 500, err.message || "Failed");

// ─── Public ──────────────────────────────────────────────────────────────────

const listVenues = async (req, res) => {
  try {
    const data = await bookingService.listVenues(req.body || {});
    return sendSuccess(res, 200, "Venues", data);
  } catch (err) { return fail(res, err); }
};

const getVenue = async (req, res) => {
  try {
    const { venueId } = req.body;
    if (!venueId) return sendError(res, 400, "venueId required");
    const data = await bookingService.getVenue({ venueId });
    return sendSuccess(res, 200, "Venue", data);
  } catch (err) { return fail(res, err); }
};

const getAvailability = async (req, res) => {
  try {
    const { courtId, date } = req.body;
    if (!courtId || !date) return sendError(res, 400, "courtId and date required");
    const data = await bookingService.getAvailability({ courtId, date });
    return sendSuccess(res, 200, "Availability", data);
  } catch (err) { return fail(res, err); }
};

const createBooking = async (req, res) => {
  try {
    const { courtId, slotStarts, customerName, customerPhone, userId } = req.body;
    if (!courtId || !slotStarts?.length) return sendError(res, 400, "courtId and slotStarts required");
    if (!customerName || !customerPhone) return sendError(res, 400, "customerName and customerPhone required");
    const data = await bookingService.createBooking({ courtId, slotStarts, customerName, customerPhone, userId });
    return sendSuccess(res, 200, "Booked", data);
  } catch (err) { return fail(res, err); }
};

const myBookings = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return sendError(res, 400, "userId required");
    const data = await bookingService.myBookings({ userId });
    return sendSuccess(res, 200, "Bookings", data);
  } catch (err) { return fail(res, err); }
};

const cancelBooking = async (req, res) => {
  try {
    const { bookingId, userId } = req.body;
    if (!bookingId) return sendError(res, 400, "bookingId required");
    const data = await bookingService.cancelBooking({ bookingId, userId });
    return sendSuccess(res, 200, "Cancelled", data);
  } catch (err) { return fail(res, err); }
};

// ─── Admin (ownerId required) ────────────────────────────────────────────────

const adminCreateVenue = async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) return sendError(res, 400, "ownerId required");
    const data = await bookingService.createVenue(req.body);
    return sendSuccess(res, 201, "Venue created", data);
  } catch (err) { return fail(res, err); }
};

const adminUpdateVenue = async (req, res) => {
  try {
    const { ownerId, venueId } = req.body;
    if (!ownerId || !venueId) return sendError(res, 400, "ownerId and venueId required");
    const data = await bookingService.updateVenue(req.body);
    return sendSuccess(res, 200, "Venue updated", data);
  } catch (err) { return fail(res, err); }
};

const adminListVenues = async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) return sendError(res, 400, "ownerId required");
    const data = await bookingService.listOwnerVenues({ ownerId });
    return sendSuccess(res, 200, "Venues", data);
  } catch (err) { return fail(res, err); }
};

const adminCreateCourt = async (req, res) => {
  try {
    const { ownerId, venueId } = req.body;
    if (!ownerId || !venueId) return sendError(res, 400, "ownerId and venueId required");
    const data = await bookingService.createCourt(req.body);
    return sendSuccess(res, 201, "Court created", data);
  } catch (err) { return fail(res, err); }
};

const adminUpdateCourt = async (req, res) => {
  try {
    const { ownerId, courtId } = req.body;
    if (!ownerId || !courtId) return sendError(res, 400, "ownerId and courtId required");
    const data = await bookingService.updateCourt(req.body);
    return sendSuccess(res, 200, "Court updated", data);
  } catch (err) { return fail(res, err); }
};

const adminBookings = async (req, res) => {
  try {
    const { ownerId, venueId, date } = req.body;
    if (!ownerId || !venueId) return sendError(res, 400, "ownerId and venueId required");
    const data = await bookingService.venueBookings({ ownerId, venueId, date });
    return sendSuccess(res, 200, "Bookings", data);
  } catch (err) { return fail(res, err); }
};

module.exports = {
  listVenues, getVenue, getAvailability, createBooking, myBookings, cancelBooking,
  adminCreateVenue, adminUpdateVenue, adminListVenues,
  adminCreateCourt, adminUpdateCourt, adminBookings,
};
