const express = require("express");
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
bookingRouter.post("/admin/venue/create", c.adminCreateVenue);
bookingRouter.post("/admin/venue/update", c.adminUpdateVenue);
bookingRouter.post("/admin/venue/list",   c.adminListVenues);
bookingRouter.post("/admin/court/create", c.adminCreateCourt);
bookingRouter.post("/admin/court/update", c.adminUpdateCourt);
bookingRouter.post("/admin/bookings",     c.adminBookings);

module.exports = bookingRouter;
