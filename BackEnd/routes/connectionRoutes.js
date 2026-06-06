const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requestConnection, getPendingConnections, getMyConnections, respondConnection, cancelConnection } = require("../controllers/connectionController");

// Send connection request
router.post("/request", auth, requestConnection);

// Get pending connections
router.get("/pending", auth, getPendingConnections);

// Get ALL connections (pending + accepted)
router.get("/all", auth, getMyConnections);

// Accept/Decline connection request
router.put("/:id/respond", auth, respondConnection);

// Cancel connection request
router.delete("/cancel/:id", auth, cancelConnection);

module.exports = router;
