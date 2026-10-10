const express = require("express");
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const c = require("../controller/bookingController");
const bookingRouter = express.Router();

// Public — browsing only. Nothing here reads or writes somebody's bookings.
bookingRouter.post("/venue/list",      c.listVenues);
bookingRouter.post("/venue/detail",    c.getVenue);
bookingRouter.post("/availability",    c.getAvailability);

// Booking without an account stays possible — a court is booked with a name
// and a phone number — so this one is not behind authMiddleware. The
// controller still refuses to attribute a booking to a userId the caller
// merely claims.
bookingRouter.post("/booking/create",  c.createBooking);

// These two took the userId straight from the request body, so anyone could
// list or cancel another person's bookings by sending their id. They now
// require a session and act only on the user that session belongs to.
bookingRouter.post("/booking/mine",    authMiddleware, c.myBookings);
bookingRouter.post("/booking/cancel",  authMiddleware, c.cancelBooking);

// Admin
bookingRouter.post("/admin/venue/create", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminCreateVenue);
bookingRouter.post("/admin/venue/update", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminUpdateVenue);
bookingRouter.post("/admin/venue/list",   authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminListVenues);
bookingRouter.post("/admin/court/create", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminCreateCourt);
bookingRouter.post("/admin/court/update", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminUpdateCourt);
bookingRouter.post("/admin/bookings",     authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminBookings);

module.exports = bookingRouter;
