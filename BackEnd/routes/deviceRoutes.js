const express = require("express");
const router = express.Router();

const { registerDeviceToken, removeDeviceToken } = require("../controllers/deviceController");
const auth = require("../middleware/auth");

// FCM device-token management (user-scoped, protected).
// DELETE carries the token in the body — clients send it via axios `data`.
router.post("/token", auth, registerDeviceToken);
router.delete("/token", auth, removeDeviceToken);

module.exports = router;
