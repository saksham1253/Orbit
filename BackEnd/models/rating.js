const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
    // Who gave the rating
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Who received the rating
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Rating score 1-5
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    // Optional review text
    review: {
        type: String,
        trim: true,
        default: ""
    },
    // What skill context was this for
    skillContext: {
        type: String,
        trim: true,
        default: ""
    }
}, {
    timestamps: true
});

// A user can only rate another user once
ratingSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

// Hot read path: ratings received by a user, newest first
// (getUserRatings / getMyTrustScore / recalculateTrustScore all filter on toUser)
ratingSchema.index({ toUser: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
