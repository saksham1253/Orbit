const express = require("express")
const router = express.Router()

const authController = require("../controllers/authController")

router.post("/register",authController.register)
router.post("/login",authController.login)

// Test route (for debugging/demo)
router.get("/test", (req, res) => {
    res.json({ message: "Auth routes working" });
});

module.exports = router