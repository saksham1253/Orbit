const bannedKeywords = [
    // Adult/Explicit
    'porn', 'sex', 'nude', 'nsfw', 'prostitution', 'escort',
    // Violence/Harm
    'murder', 'kill', 'suicide', 'terrorist', 'assassinate',
    // Weapons/Explosives
    'bomb', 'gun', 'rifle', 'explosive', 'making of guns', 'build a bomb',
    // Illegal Drugs
    'cocaine', 'heroin', 'meth', 'lsd', 'fentanyl', 'buy drugs', 'sell drugs',
    // Hate Speech
    'nazi', 'kkk', 'slur'
];

/**
 * Scans text for any of the banned keywords.
 * @param {string} text - The text to scan.
 * @returns {boolean} True if a banned keyword is found, false otherwise.
 */
exports.containsBannedKeywords = (text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    
    // Check if any banned keyword matches as a whole word (or phrase)
    for (const keyword of bannedKeywords) {
        // \b ensures we match whole words (e.g., 'gun' but not 'begun')
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
        if (regex.test(lowerText)) {
            return true;
        }
    }
    return false;
};
