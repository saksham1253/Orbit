const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    skillOffered: {
        type: String,
        required: true,
        trim: true
    },
    skillWanted: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    level: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "intermediate"
    }
}, {
    timestamps: true
});

// Add Indexes for Scalability
skillSchema.index({ userId: 1 });
skillSchema.index({ skillOffered: "text", skillWanted: "text" });

module.exports = mongoose.model("Skill", skillSchema);