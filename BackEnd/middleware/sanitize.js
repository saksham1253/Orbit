/**
 * Custom middleware to sanitize incoming data and prevent NoSQL injection.
 * Replaces express-mongo-sanitize which is currently incompatible with Express 5
 * due to how it overrides the req.query getter.
 */

function sanitize(obj) {
    if (obj instanceof Object) {
        for (const key in obj) {
            // If the key starts with $, it's potentially a MongoDB operator
            if (key.startsWith('$')) {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    }
}

const mongoSanitize = (req, res, next) => {
    ['body', 'params', 'headers', 'query'].forEach((k) => {
        if (req[k]) {
            sanitize(req[k]);
        }
    });
    next();
};

module.exports = mongoSanitize;
