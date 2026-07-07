const mongoose = require("mongoose");

/**
 * SkillCategory — an admin-managed skill taxonomy (spec I). NET-NEW: today
 * Skill.skillOffered/skillWanted are free text with no controlled vocabulary.
 * This is a non-destructive overlay — it does NOT rewrite user skills; it gives
 * staff a curated category list (with aliases) that matching/search can map free
 * text onto later. Reversible: soft-archive via `active:false`.
 */
const skillCategorySchema = new mongoose.Schema({
    slug:    { type: String, required: true, unique: true },   // "web-development"
    label:   { type: String, required: true },                 // "Web Development"
    aliases: { type: [String], default: [] },                  // ["frontend", "react", "webdev"]
    parent:  { type: String, default: null },                  // optional parent slug
    active:  { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.models.SkillCategory || mongoose.model("SkillCategory", skillCategorySchema);
