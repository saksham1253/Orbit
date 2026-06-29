/**
 * CONTENT MODERATION - BANNED KEYWORDS
 * 
 * Comprehensive list of prohibited content across multiple categories
 * Used for skill names, descriptions, bios, and user-generated content
 * 
 * Security Level: CRITICAL
 * Department: Red Team / Security / Trust & Safety
 */

const BANNED_KEYWORDS = [
  // === EXPLICIT SEXUAL CONTENT ===
  'porn', 'pornography', 'xxx', 'sex', 'sexy', 'sexual', 'nude', 'naked', 'nudity',
  'ass', 'asses', 'booty', 'butt', 'buttocks', 'tits', 'boobs', 'breasts', 'nipple',
  'dick', 'cock', 'penis', 'pussy', 'vagina', 'cunt', 'genital', 'genitals',
  'masturbate', 'masturbation', 'orgasm', 'climax', 'ejaculate', 'cum', 'cumming',
  'erotic', 'erotica', 'fetish', 'kinky', 'kink', 'bdsm', 'bondage', 'dominatrix',
  'fingering', 'handjob', 'blowjob', 'anal', 'oral', 'penetration', 'intercourse',
  'fornication', 'adultery', 'hooker', 'prostitute', 'escort', 'stripper', 'webcam',
  'camgirl', 'camboy', 'onlyfans', 'nsfw', 'r34', 'rule34', 'hentai', 'doujin',
  
  // === LGBTQ+ SLURS (hateful context) ===
  'faggot', 'fag', 'dyke', 'tranny', 'shemale', 'sissy', 'femboy',
  
  // === ADULT SERVICES ===
  'massage', 'sensual', 'tantric', 'intimate', 'pleasure', 'escort service',
  'sugar daddy', 'sugar baby', 'hook up', 'hookup', 'one night', 'fling',
  'affair', 'mistress', 'lover', 'sexting', 'nudes', 'send pics',
  
  // === VIOLENCE & HARM ===
  'kill', 'murder', 'rape', 'assault', 'abuse', 'violence', 'torture', 'mutilate',
  'suicide', 'self harm', 'cut myself', 'end my life', 'hang myself',
  'shoot up', 'school shooter', 'mass shooting', 'terrorist', 'terrorism',
  'bomb', 'explosive', 'weapon', 'gun trade', 'firearms', 'ammunition',
  
  // === ILLEGAL DRUGS ===
  'cocaine', 'heroin', 'meth', 'methamphetamine', 'crack', 'lsd', 'acid',
  'ecstasy', 'mdma', 'molly', 'ketamine', 'pcp', 'fentanyl', 'opioid',
  'weed dealer', 'drug dealer', 'narcotics', 'trafficking', 'cartel',
  
  // === HATE SPEECH & DISCRIMINATION ===
  'nigger', 'nigga', 'negro', 'coon', 'kike', 'chink', 'gook', 'spic',
  'wetback', 'beaner', 'raghead', 'towelhead', 'nazi', 'hitler', 'holocaust',
  'white power', 'white supremacy', 'kkk', 'ku klux', 'genocide', 'ethnic cleansing',
  
  // === FINANCIAL SCAMS ===
  'bitcoin', 'crypto scam', 'investment scam', 'pyramid scheme', 'ponzi',
  'money laundering', 'offshore account', 'tax evasion', 'credit card fraud',
  'identity theft', 'phishing', 'ransomware', 'wire transfer', 'western union',
  'cash app', 'venmo me', 'paypal me', 'send money', 'quick cash',
  
  // === CHILD SAFETY (CRITICAL) ===
  'child', 'minor', 'teen', 'teenager', 'underage', 'loli', 'lolita', 'shota',
  'jailbait', 'pedo', 'pedophile', 'cp', 'child abuse', 'grooming',
  
  // === ILLEGAL SERVICES ===
  'hacking', 'hack into', 'ddos', 'botnet', 'malware', 'virus', 'trojan',
  'fake id', 'fake passport', 'counterfeit', 'forged', 'stolen', 'black market',
  'darknet', 'dark web', 'tor browser', 'vpn service', 'proxy service',
  
  // === SPAM & MANIPULATION ===
  'click here', 'buy now', 'limited time', 'act now', 'free trial', 'earn money fast',
  'work from home', 'get rich quick', 'lose weight fast', 'miracle cure',
  'guaranteed', 'risk free', 'no questions asked', 'offshore', 'anonymous',
  
  // === DOXXING & HARASSMENT ===
  'dox', 'doxx', 'swat', 'swatting', 'home address', 'phone number leak',
  'social security', 'ssn', 'credit card number', 'bank account',
  
  // === EXPLICIT BODY PARTS & ACTS ===
  'anus', 'rectum', 'sphincter', 'scrotum', 'testicle', 'balls', 'labia',
  'clitoris', 'clit', 'vulva', 'areola', 'phallus', 'shaft', 'glans',
  'foreskin', 'circumcision', 'perineum', 'prostate', 'g-spot',
  'rimming', 'rimjob', 'felching', 'fisting', 'gangbang', 'threesome',
  'foursome', 'orgy', 'swinger', 'polyamory', 'cuckold', 'creampie',
  
  // === PORNOGRAPHIC TERMS ===
  'milf', 'dilf', 'gilf', 'barely legal', 'virgin', 'deflower', 'cherry',
  'squirt', 'queef', 'facial', 'money shot', 'dp', 'double penetration',
  'bukkake', 'gokkun', 'ahegao', 'lewdness', 'pervert', 'voyeur',
  
  // === ESCORT & SEX WORK ===
  'call girl', 'rent boy', 'brothel', 'pimp', 'madam', 'john', 'trick',
  'street walker', 'red light', 'massage parlor', 'happy ending',
  
  // === DATING SCAMS ===
  'romance scam', 'catfish', 'fake profile', 'stolen photos', 'military scam',
  'nigerian prince', 'inheritance scam', 'lottery scam', 'sweepstakes',
  
  // === GAMBLING ===
  'online casino', 'sports betting', 'poker site', 'slot machine', 'jackpot',
  'gambling tips', 'betting system', 'odds manipulation',
  
  // === COUNTERFEIT GOODS ===
  'replica', 'knockoff', 'fake designer', 'bootleg', 'pirated', 'cracked software',
  
  // === ACADEMIC FRAUD ===
  'essay writing', 'dissertation help', 'thesis writing', 'exam answers',
  'test bank', 'homework answers', 'take my exam', 'write my paper',
  
  // === MULTI-LANGUAGE VARIANTS ===
  // Spanish
  'porno', 'sexo', 'desnudo', 'puta', 'perra', 'verga', 'coño', 'culo',
  // French
  'sexe', 'nu', 'nue', 'putain', 'salope', 'bite', 'chatte', 'cul',
  // German
  'nackt', 'fotze', 'schwanz', 'arsch', 'fick',
  // Italian
  'sesso', 'nudo', 'puttana', 'cazzo', 'fica',
  // Portuguese
  'sexo', 'nu', 'puta', 'pau', 'buceta', 'cu',
  
  // === SLANG & LEETSPEAK ===
  'pr0n', 's3x', 'f*ck', 'f**k', 'sh!t', 'sh*t', 'b!tch', 'b*tch',
  'a$$', '@ss', 'p0rn', 'h0t', 's3xy', 'xxx', 'x x x',
  
  // === SUGGESTIVE & GROOMING ===
  'private lesson', 'one on one', 'discreet', 'no strings', 'casual encounter',
  'friends with benefits', 'fwb', 'nsa', 'dtf', 'netflix and chill',
  'after dark', 'late night', 'bedroom skills', 'massage therapy',
  
  // === ADDITIONAL EXPLICIT TERMS ===
  'hump', 'humping', 'grinding', 'twerk', 'twerking', 'striptease',
  'lap dance', 'pole dance', 'exotic dancer', 'adult entertainment',
  'x-rated', 'r-rated', 'mature content', 'adult only', '18+', '21+',
  'viagra', 'cialis', 'penis enlargement', 'breast enhancement',
  'sex toy', 'vibrator', 'dildo', 'fleshlight', 'sex doll',

  // ====================================================================
  // === EXPANDED SET (v2) — researched against widely-used moderation
  // lists (Shutterstock/LDNOOBW, words/cuss, Google profanity words) and
  // the Unified Harmful-Content taxonomy. Whole-word matching (see below)
  // keeps the "Scunthorpe problem" in check: "skill" never trips "kill",
  // "Pakistan" never trips "paki".
  // ====================================================================

  // --- Plain profanity (the list previously had only leetspeak forms) ---
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'motherfucker', 'mofo',
  'fuckface', 'fuckwit', 'clusterfuck', 'shit', 'shits', 'shitty', 'shithead',
  'shithole', 'bullshit', 'dipshit', 'bitch', 'bitches', 'bitching', 'asshole',
  'assholes', 'arsehole', 'bastard', 'bastards', 'dumbass', 'jackass', 'dickhead',
  'prick', 'douche', 'douchebag', 'wanker', 'tosser', 'bollocks', 'twat',
  'cocksucker', 'jerkoff', 'slut', 'sluts', 'slutty', 'whore', 'whores', 'skank',
  'cumslut', 'cockhead', 'knobhead', 'shitbag', 'piss off', 'pissed off',

  // --- Violence / threats (incl. the requested kill-family) ---
  'killer', 'killing', 'killed', 'kills', 'kill you', 'kill u', 'kill them',
  'kill yourself', 'kill myself', 'manslaughter', 'homicide', 'slaughter',
  'massacre', 'behead', 'beheading', 'decapitate', 'decapitation', 'dismember',
  'strangle', 'strangulation', 'choke you', 'lynch', 'lynching', 'stab',
  'stabbing', 'stabbed', 'shooter', 'gunman', 'mass murder', 'mass murderer',
  'serial killer', 'hitman', 'hit man', 'assassinate', 'assassination', 'maim',
  'slit your throat', 'slit throat', 'bloodbath', 'death threat', 'i will kill',

  // --- Hate speech / slurs (additional) ---
  'retard', 'retarded', 'retards', 'spastic', 'mongoloid', 'paki', 'pakis',
  'jigaboo', 'porch monkey', 'tar baby', 'sand nigger', 'wop', 'dago', 'kraut',
  'zipperhead', 'half breed', 'subhuman', 'untermensch', 'heil hitler',

  // --- Self-harm (additional) ---
  'kms', 'kys', 'slit my wrists', 'slit wrists', 'cut my wrists', 'noose',
  'jump off a bridge', 'overdose on', 'want to die', 'how to commit suicide',

  // --- Drugs (additional slang) ---
  'crystal meth', 'angel dust', 'speedball', 'oxycontin', 'oxycodone', 'percocet',
  'vicodin', 'shrooms', 'magic mushrooms', 'crack cocaine', 'dope dealer',
  'roofies', 'ghb', 'date rape drug', 'buy drugs', 'sell drugs', 'score drugs',

  // --- Weapons / mass harm ---
  'glock', 'ar-15', 'ar15', 'ak-47', 'ak47', 'silencer', 'suppressor',
  'pipe bomb', 'molotov', 'molotov cocktail', 'grenade', 'hand grenade',
  'dirty bomb', 'nerve agent', 'anthrax', 'ghost gun', '3d printed gun',
  'untraceable gun', 'gun for sale', 'buy a gun', 'sell a gun', 'illegal firearm',

  // --- Sexual (additional explicit) ---
  'deepthroat', 'titjob', 'cumshot', 'jizz', 'horny', 'thot', 'gooner',
  'cumdump', 'facefuck', 'titfuck',

  // --- Child safety (additional, CRITICAL) ---
  'child porn', 'childporn', 'kiddie porn', 'kiddy porn', 'lolicon', 'preteen',
  'prepubescent', 'underage girl', 'underage boy', 'child model',

  // --- Scams (additional) ---
  'gift card scam', 'crypto giveaway', 'double your money', 'guaranteed returns',
  'multi level marketing', 'advance fee', '419 scam', 'fake check', 'money mule',
  'seed phrase', 'wallet recovery',

  // --- Leetspeak / obfuscation of the worst terms ---
  'fuk', 'fck', 'fcuk', 'phuck', 'fvck', 'sh1t', 'b1tch', 'biatch', 'azz',
  'a55', 'pu55y', 'pussi', 'd1ck', 'c0ck', 'n1gger', 'n1gga', 'fagg0t', 'r4pe',
  'k1ll', 'h3ntai', 'pron', 's3xx',
];

/**
 * Check if text contains banned keywords
 * @param {string} text - Text to check
 * @returns {Object} - { isClean: boolean, foundKeywords: string[] }
 */
// Precompiled ONCE at module load: a single whole-word alternation regex over
// the entire blocklist. Far cheaper than compiling one RegExp per keyword on
// every check (the list is now several hundred terms). The \b...\b boundaries
// keep the "Scunthorpe problem" away — "skill" never matches "kill", "classic"
// never matches "ass", "Pakistan" never matches "paki". Multi-word phrases work
// because the alternation matches the literal spaces inside them.
const BANNED_REGEX = new RegExp(
  `\\b(?:${BANNED_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

function checkForBannedContent(text) {
  if (!text || typeof text !== 'string') {
    return { isClean: true, foundKeywords: [] };
  }
  const matches = text.match(BANNED_REGEX);
  if (!matches) return { isClean: true, foundKeywords: [] };
  // De-dupe and normalize so the same term isn't reported twice.
  const foundKeywords = [...new Set(matches.map((m) => m.toLowerCase()))];
  return { isClean: false, foundKeywords };
}

/**
 * Validate skill name and description
 * @param {string} name - Skill name
 * @param {string} description - Skill description
 * @returns {Object} - { isValid: boolean, message: string, foundKeywords: string[] }
 */
function validateSkillContent(name, description) {
  const nameCheck = checkForBannedContent(name);
  const descCheck = checkForBannedContent(description);

  const allKeywords = [...nameCheck.foundKeywords, ...descCheck.foundKeywords];

  if (allKeywords.length > 0) {
    return {
      isValid: false,
      message: 'Content contains prohibited terms and cannot be posted. Please review our community guidelines.',
      foundKeywords: allKeywords,
    };
  }

  return {
    isValid: true,
    message: 'Content is acceptable',
    foundKeywords: [],
  };
}

/**
 * Validate user bio
 * @param {string} bio - User bio text
 * @returns {Object} - { isValid: boolean, message: string, foundKeywords: string[] }
 */
function validateBio(bio) {
  if (!bio) return { isValid: true, message: 'Bio is acceptable', foundKeywords: [] };

  const check = checkForBannedContent(bio);

  if (!check.isClean) {
    return {
      isValid: false,
      message: 'Bio contains prohibited content. Please remove inappropriate terms.',
      foundKeywords: check.foundKeywords,
    };
  }

  return {
    isValid: true,
    message: 'Bio is acceptable',
    foundKeywords: [],
  };
}

module.exports = {
  BANNED_KEYWORDS,
  checkForBannedContent,
  validateSkillContent,
  validateBio,
};
