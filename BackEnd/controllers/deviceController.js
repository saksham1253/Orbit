const User = require("../models/user");

// ================= REGISTER FCM DEVICE TOKEN =================
// Called by the native client after it obtains an FCM registration token.
// $addToSet keeps the list unique so re-registering the same device is a no-op.
exports.registerDeviceToken = async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token || typeof token !== "string") {
            return res.status(400).json({ message: "token is required" });
        }
        await User.updateOne({ _id: req.user.id }, { $addToSet: { fcmTokens: token } });
        res.status(200).json({ message: "Device token registered" });
    } catch (err) {
        console.error("registerDeviceToken:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= REMOVE FCM DEVICE TOKEN =================
// Called on logout so a shared device stops receiving the previous user's push.
exports.removeDeviceToken = async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token || typeof token !== "string") {
            return res.status(400).json({ message: "token is required" });
        }
        await User.updateOne({ _id: req.user.id }, { $pull: { fcmTokens: token } });
        res.status(200).json({ message: "Device token removed" });
    } catch (err) {
        console.error("removeDeviceToken:", err);
        res.status(500).json({ message: "Server error" });
    }
};
