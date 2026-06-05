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
];

/**
 * Check if text contains banned keywords
 * @param {string} text - Text to check
 * @returns {Object} - { isClean: boolean, foundKeywords: string[] }
 */
function checkForBannedContent(text) {
  if (!text || typeof text !== 'string') {
    return { isClean: true, foundKeywords: [] };
  }

  const lowerText = text.toLowerCase();
  const foundKeywords = [];

  for (const keyword of BANNED_KEYWORDS) {
    // Word boundary check to avoid false positives (e.g., "classic" containing "ass")
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundKeywords.push(keyword);
    }
  }

  return {
    isClean: foundKeywords.length === 0,
    foundKeywords: foundKeywords,
  };
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
