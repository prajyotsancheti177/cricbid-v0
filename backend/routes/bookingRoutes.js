const express = require("express");
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const c = require("../controller/bookingController");
const bookingRouter = express.Router();

// Public
bookingRouter.post("/venue/list",      c.listVenues);
bookingRouter.post("/venue/detail",    c.getVenue);
bookingRouter.post("/availability",    c.getAvailability);
bookingRouter.post("/booking/create",  c.createBooking);
bookingRouter.post("/booking/mine",    c.myBookings);
bookingRouter.post("/booking/cancel",  c.cancelBooking);

// Admin
bookingRouter.post("/admin/venue/create", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminCreateVenue);
bookingRouter.post("/admin/venue/update", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminUpdateVenue);
bookingRouter.post("/admin/venue/list",   authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminListVenues);
bookingRouter.post("/admin/court/create", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminCreateCourt);
bookingRouter.post("/admin/court/update", authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminUpdateCourt);
bookingRouter.post("/admin/bookings",     authMiddleware, roleMiddleware(['boss', 'super_user']), c.adminBookings);

module.exports = bookingRouter;
