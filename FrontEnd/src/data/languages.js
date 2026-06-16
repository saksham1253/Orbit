/**
 * languages.js — canonical spoken-language dataset for the shared
 * <LanguageMultiSelect> used in signup and profile (v6 §1).
 *
 * Plain data, no dependencies. Stored/submitted as the language `name` string
 * (the existing `languages: [String]` contract — no migration needed). A short
 * "common" cluster surfaces first; the rest follow alphabetically. `native` is
 * optional and shown as a dim hint + included in search matching.
 */

// Surfaced first so the most-picked languages are one tap away.
export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'Hindi', 'German', 'Mandarin Chinese',
  'Japanese', 'Arabic', 'Portuguese', 'Korean', 'Russian', 'Italian',
];

// Full list (120+). `native` optional; extend freely from ISO 639.
const ALL = [
  { name: 'English', native: 'English' },
  { name: 'Spanish', native: 'Español' },
  { name: 'French', native: 'Français' },
  { name: 'Hindi', native: 'हिन्दी' },
  { name: 'German', native: 'Deutsch' },
  { name: 'Mandarin Chinese', native: '普通话' },
  { name: 'Japanese', native: '日本語' },
  { name: 'Arabic', native: 'العربية' },
  { name: 'Portuguese', native: 'Português' },
  { name: 'Korean', native: '한국어' },
  { name: 'Russian', native: 'Русский' },
  { name: 'Italian', native: 'Italiano' },
  { name: 'Dutch', native: 'Nederlands' },
  { name: 'Turkish', native: 'Türkçe' },
  { name: 'Polish', native: 'Polski' },
  { name: 'Ukrainian', native: 'Українська' },
  { name: 'Romanian', native: 'Română' },
  { name: 'Greek', native: 'Ελληνικά' },
  { name: 'Czech', native: 'Čeština' },
  { name: 'Swedish', native: 'Svenska' },
  { name: 'Hungarian', native: 'Magyar' },
  { name: 'Finnish', native: 'Suomi' },
  { name: 'Danish', native: 'Dansk' },
  { name: 'Norwegian', native: 'Norsk' },
  { name: 'Hebrew', native: 'עברית' },
  { name: 'Thai', native: 'ไทย' },
  { name: 'Vietnamese', native: 'Tiếng Việt' },
  { name: 'Indonesian', native: 'Bahasa Indonesia' },
  { name: 'Malay', native: 'Bahasa Melayu' },
  { name: 'Filipino (Tagalog)', native: 'Tagalog' },
  { name: 'Bengali', native: 'বাংলা' },
  { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { name: 'Telugu', native: 'తెలుగు' },
  { name: 'Marathi', native: 'मराठी' },
  { name: 'Tamil', native: 'தமிழ்' },
  { name: 'Urdu', native: 'اردو' },
  { name: 'Gujarati', native: 'ગુજરાતી' },
  { name: 'Kannada', native: 'ಕನ್ನಡ' },
  { name: 'Malayalam', native: 'മലയാളം' },
  { name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { name: 'Assamese', native: 'অসমীয়া' },
  { name: 'Nepali', native: 'नेपाली' },
  { name: 'Sinhala', native: 'සිංහල' },
  { name: 'Burmese', native: 'မြန်မာ' },
  { name: 'Khmer', native: 'ខ្មែរ' },
  { name: 'Lao', native: 'ລາວ' },
  { name: 'Mongolian', native: 'Монгол' },
  { name: 'Persian (Farsi)', native: 'فارسی' },
  { name: 'Pashto', native: 'پښتو' },
  { name: 'Kurdish', native: 'Kurdî' },
  { name: 'Swahili', native: 'Kiswahili' },
  { name: 'Amharic', native: 'አማርኛ' },
  { name: 'Hausa', native: 'Hausa' },
  { name: 'Yoruba', native: 'Yorùbá' },
  { name: 'Igbo', native: 'Igbo' },
  { name: 'Zulu', native: 'isiZulu' },
  { name: 'Xhosa', native: 'isiXhosa' },
  { name: 'Afrikaans', native: 'Afrikaans' },
  { name: 'Somali', native: 'Soomaali' },
  { name: 'Serbian', native: 'Српски' },
  { name: 'Croatian', native: 'Hrvatski' },
  { name: 'Bosnian', native: 'Bosanski' },
  { name: 'Slovak', native: 'Slovenčina' },
  { name: 'Slovenian', native: 'Slovenščina' },
  { name: 'Bulgarian', native: 'Български' },
  { name: 'Macedonian', native: 'Македонски' },
  { name: 'Albanian', native: 'Shqip' },
  { name: 'Lithuanian', native: 'Lietuvių' },
  { name: 'Latvian', native: 'Latviešu' },
  { name: 'Estonian', native: 'Eesti' },
  { name: 'Icelandic', native: 'Íslenska' },
  { name: 'Irish', native: 'Gaeilge' },
  { name: 'Welsh', native: 'Cymraeg' },
  { name: 'Scottish Gaelic', native: 'Gàidhlig' },
  { name: 'Catalan', native: 'Català' },
  { name: 'Basque', native: 'Euskara' },
  { name: 'Galician', native: 'Galego' },
  { name: 'Cantonese', native: '廣東話' },
  { name: 'Taiwanese Hokkien', native: '臺灣話' },
  { name: 'Javanese', native: 'Basa Jawa' },
  { name: 'Sundanese', native: 'Basa Sunda' },
  { name: 'Cebuano', native: 'Cebuano' },
  { name: 'Georgian', native: 'ქართული' },
  { name: 'Armenian', native: 'Հայերեն' },
  { name: 'Azerbaijani', native: 'Azərbaycanca' },
  { name: 'Kazakh', native: 'Қазақша' },
  { name: 'Uzbek', native: 'Oʻzbekcha' },
  { name: 'Turkmen', native: 'Türkmençe' },
  { name: 'Kyrgyz', native: 'Кыргызча' },
  { name: 'Tajik', native: 'Тоҷикӣ' },
  { name: 'Tibetan', native: 'བོད་སྐད་' },
  { name: 'Dzongkha', native: 'རྫོང་ཁ' },
  { name: 'Maltese', native: 'Malti' },
  { name: 'Luxembourgish', native: 'Lëtzebuergesch' },
  { name: 'Frisian', native: 'Frysk' },
  { name: 'Belarusian', native: 'Беларуская' },
  { name: 'Haitian Creole', native: 'Kreyòl Ayisyen' },
  { name: 'Maori', native: 'Te Reo Māori' },
  { name: 'Samoan', native: 'Gagana Sāmoa' },
  { name: 'Tongan', native: 'Lea Faka-Tonga' },
  { name: 'Fijian', native: 'Na Vosa Vakaviti' },
  { name: 'Hawaiian', native: 'ʻŌlelo Hawaiʻi' },
  { name: 'Esperanto', native: 'Esperanto' },
  { name: 'Latin', native: 'Latina' },
  { name: 'Yiddish', native: 'ייִדיש' },
  { name: 'Tatar', native: 'Татарча' },
  { name: 'Chechen', native: 'Нохчийн' },
  { name: 'Uyghur', native: 'ئۇيغۇرچە' },
  { name: 'Sanskrit', native: 'संस्कृतम्' },
  { name: 'Quechua', native: 'Runa Simi' },
  { name: 'Guarani', native: 'Avañeʼẽ' },
  { name: 'Aymara', native: 'Aymar aru' },
  { name: 'Wolof', native: 'Wolof' },
  { name: 'Twi', native: 'Twi' },
  { name: 'Shona', native: 'chiShona' },
  { name: 'Sesotho', native: 'Sesotho' },
  { name: 'Tswana', native: 'Setswana' },
  { name: 'Malagasy', native: 'Malagasy' },
];

// Build the display order: common cluster first (in the COMMON order), then the
// remaining languages alphabetically by name. De-duplicated by name.
const byName = new Map(ALL.map((l) => [l.name, l]));
const commonEntries = COMMON_LANGUAGES.map((n) => byName.get(n)).filter(Boolean);
const rest = ALL
  .filter((l) => !COMMON_LANGUAGES.includes(l.name))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Ordered list of `{ name, native, common }` — common first, then A→Z. */
export const LANGUAGES = [
  ...commonEntries.map((l) => ({ ...l, common: true })),
  ...rest.map((l) => ({ ...l, common: false })),
];

export default LANGUAGES;
