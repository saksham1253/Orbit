const User = require("../models/user");

// Haversine formula: distance between two lat/lng points in km
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R    = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Fuzz coordinates to protect user privacy (offsets by approx ~1.5km randomly)
function fuzzCoordinates(lat, lng) {
    const latOffset = (Math.random() - 0.5) * 0.03; // +/- ~1.6km
    const lngOffset = (Math.random() - 0.5) * 0.03;
    return {
        lat: lat + latOffset,
        lng: lng + lngOffset
    };
}


async function geocodeLocation(locationStr) {
    const encoded = encodeURIComponent(locationStr);
    const url     = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

    const response = await fetch(url, {
        headers: {
            // Nominatim requires a User-Agent
            "User-Agent": "SkillSwap-App/1.0"
        }
    });

    const data = await response.json();

    if (!data || data.length === 0) {
        return null;
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
    };
}


// ─────────────────────────────────────────────
//  UPDATE USER LOCATION (geocodes and saves coords)
// ─────────────────────────────────────────────

exports.updateLocation = async (req, res) => {
    try {
        const { location } = req.body || {};

        if (!location || location.trim() === "") {
            return res.status(400).json({ message: "Location is required" });
        }

        // Geocode the location string
        const geo = await geocodeLocation(location.trim());

        if (!geo) {
            return res.status(400).json({
                message: "Could not find coordinates for this location. Try a more specific name (e.g. 'Dehradun, India')"
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                location: location.trim(),
                coordinates: { lat: geo.lat, lng: geo.lng }
            },
            { new: true }
        ).select("-password");

        res.status(200).json({
            message: "Location updated successfully",
            location: user.location,
            coordinates: user.coordinates,
            resolvedAs: geo.displayName
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  GET NEARBY USERS (within radius km)
// ─────────────────────────────────────────────

exports.getNearbyUsers = async (req, res) => {
    try {
        const radius = parseFloat(req.query.radius) || 50; // default 50 km

        // Get current user's coordinates and languages
        const me = await User.findById(req.user.id).select("coordinates location languages");

        if (!me.coordinates || me.coordinates.lat === null) {
            return res.status(400).json({
                message: "Please set your location first using PUT /api/geo/location"
            });
        }

        // Get all other users who have coordinates set
        const users = await User.find({
            _id:                 { $ne: req.user.id },
            "coordinates.lat":   { $ne: null },
            "coordinates.lng":   { $ne: null }
        }).select("name email location coordinates trustScore averageRating sentimentScore languages");

        // Calculate distance for each and filter
        const nearby = users
            .map(user => {
                const dist = haversineDistance(
                    me.coordinates.lat, me.coordinates.lng,
                    user.coordinates.lat, user.coordinates.lng
                );
                
                // Privacy Protection: Fuzz coordinates before sending to frontend
                const fuzzed = fuzzCoordinates(user.coordinates.lat, user.coordinates.lng);
                
                return {
                    _id:           user._id,
                    name:          user.name,
                    email:         user.email,
                    location:      user.location,
                    trustScore:    user.trustScore,
                    averageRating: user.averageRating,
                    sentimentScore: user.sentimentScore,
                    languages:     user.languages,
                    distanceKm:    Math.round(dist * 10) / 10,
                    coordinates:   fuzzed
                };
            })
            .filter(u => u.distanceKm <= radius)
            .sort((a, b) => {
                // Priority: High Rating + High Sentiment Score + Shared Language > Distance
                const meLangs = me.languages || ["English"];
                const aSharedLang = a.languages.some(l => meLangs.includes(l)) ? 100 : 0;
                const bSharedLang = b.languages.some(l => meLangs.includes(l)) ? 100 : 0;

                const scoreA = (a.averageRating * 20) + ((a.sentimentScore || 0) * 50) + aSharedLang - (a.distanceKm * 0.5);
                const scoreB = (b.averageRating * 20) + ((b.sentimentScore || 0) * 50) + bSharedLang - (b.distanceKm * 0.5);
                return scoreB - scoreA; // descending order
            });

        res.status(200).json({
            myLocation: me.location,
            radius,
            count:  nearby.length,
            nearby
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  GET NEARBY SKILLS (skills from nearby users)
// ─────────────────────────────────────────────

exports.getNearbySkills = async (req, res) => {
    try {
        const Skill  = require("../models/skill");
        const radius = parseFloat(req.query.radius) || 50;

        const me = await User.findById(req.user.id).select("coordinates location languages");

        if (!me.coordinates || me.coordinates.lat === null) {
            return res.status(400).json({
                message: "Please set your location first using PUT /api/geo/location"
            });
        }

        // Get all skills from other users
        const skills = await Skill.find({ userId: { $ne: req.user.id } })
            .populate("userId", "name location coordinates trustScore averageRating sentimentScore languages");

        // Filter to those within radius
        const nearbySkills = skills
            .filter(skill => {
                const u = skill.userId;
                if (!u || !u.coordinates || u.coordinates.lat === null) return false;
                const dist = haversineDistance(
                    me.coordinates.lat, me.coordinates.lng,
                    u.coordinates.lat, u.coordinates.lng
                );
                return dist <= radius;
            })
            .map(skill => {
                const u    = skill.userId;
                const dist = haversineDistance(
                    me.coordinates.lat, me.coordinates.lng,
                    u.coordinates.lat, u.coordinates.lng
                );
                
                // Privacy Protection: Fuzz coordinates before sending to frontend
                const fuzzed = fuzzCoordinates(u.coordinates.lat, u.coordinates.lng);
                
                return {
                    _id:          skill._id,
                    skillOffered: skill.skillOffered,
                    skillWanted:  skill.skillWanted,
                    description:  skill.description,
                    level:        skill.level,
                    createdAt:    skill.createdAt,
                    user: {
                        _id:          u._id,
                        name:         u.name,
                        email:        u.email,
                        location:     u.location,
                        trustScore:   u.trustScore,
                        averageRating: u.averageRating,
                        sentimentScore: u.sentimentScore,
                        languages:    u.languages,
                        coordinates:  fuzzed
                    },
                    distanceKm: Math.round(dist * 10) / 10
                };
            })
            .sort((a, b) => {
                const uA = a.user;
                const uB = b.user;
                const meLangs = me.languages || ["English"];
                const aSharedLang = (uA.languages || []).some(l => meLangs.includes(l)) ? 100 : 0;
                const bSharedLang = (uB.languages || []).some(l => meLangs.includes(l)) ? 100 : 0;

                const scoreA = ((uA.averageRating || 0) * 20) + ((uA.sentimentScore || 0) * 50) + aSharedLang - (a.distanceKm * 0.5);
                const scoreB = ((uB.averageRating || 0) * 20) + ((uB.sentimentScore || 0) * 50) + bSharedLang - (b.distanceKm * 0.5);
                return scoreB - scoreA; // descending
            });

        res.status(200).json({
            myLocation: me.location,
            radius,
            count: nearbySkills.length,
            skills: nearbySkills
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  GEOCODE endpoint
// ─────────────────────────────────────────────

exports.geocode = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ message: "Query param 'q' is required" });

        const result = await geocodeLocation(q);

        if (!result) {
            return res.status(404).json({ message: "Location not found" });
        }

        res.status(200).json(result);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
