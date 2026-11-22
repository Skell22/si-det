// Starter vocabulary for Si det 0.1 (Norwegian Bokmål).
// Grid is fixed at 10 columns x 6 rows. Positions never change; empty squares stay empty.
// Word classes follow the Modified Fitzgerald Key (see docs/design-plan.md).
//
// Each word: [label, class, englishSearchTerm, symbolId?]
//   label  – shown on the key and spoken
//   class  – pron | verb | desc | noun | prep | soc | ques | adv | neg
//   en     – English fallback term used by tools/fetch-symbols.mjs when the
//            Norwegian ARASAAC search finds nothing good
//   sym    – ARASAAC pictogram id, filled in by tools/fetch-symbols.mjs

export const COLS = 10;
export const ROWS = 6;

// Columns 1–2: the same on every page (pronouns + helper verbs).
export const FIXED_LEFT = [
  [['jeg', 'pron', 'I'], ['vil', 'verb', 'want']],
  [['du', 'pron', 'you'], ['kan', 'verb', 'can']],
  [['vi', 'pron', 'we'], ['er', 'verb', 'be']],
  [['han', 'pron', 'he'], ['har', 'verb', 'have']],
  [['hun', 'pron', 'she'], ['liker', 'verb', 'like']],
  [['det', 'pron', 'it'], ['får', 'verb', 'get']],
];

// Column 10: folders. Same on every page.
export const FOLDERS = [
  { id: 'mat', label: 'Mat og drikke', en: 'food' },
  { id: 'folk', label: 'Folk', en: 'people' },
  { id: 'leke', label: 'Leke', en: 'toys' },
  { id: 'steder', label: 'Steder', en: 'places' },
  { id: 'folelser', label: 'Følelser', en: 'emotions' },
  { id: 'klaer', label: 'Klær', en: 'clothes' },
];

// Columns 3–9 of the core page, row by row (7 per row). null = empty square.
export const CORE = [
  [['spise', 'verb', 'eat'], ['se', 'verb', 'look'], ['mer', 'desc', 'more'], ['i', 'prep', 'in'], ['hva', 'ques', 'what'], ['ja', 'soc', 'yes'], ['hei', 'soc', 'hello']],
  [['drikke', 'verb', 'drink'], ['lage', 'verb', 'make'], ['stor', 'desc', 'big'], ['på', 'prep', 'on'], ['hvor', 'ques', 'where'], ['nei', 'neg', 'no'], ['ha det', 'soc', 'goodbye']],
  [['leke', 'verb', 'play'], ['ta', 'verb', 'take'], ['liten', 'desc', 'small'], ['inn', 'prep', 'enter'], ['hvem', 'ques', 'who'], ['ikke', 'neg', 'not'], ['takk', 'soc', 'thank you']],
  [['sove', 'verb', 'sleep'], ['gi', 'verb', 'give'], ['bra', 'desc', 'good'], ['ut', 'prep', 'go out'], ['når', 'ques', 'when'], ['stopp', 'neg', 'stop'], ['mamma', 'noun', 'mother']],
  [['gå', 'verb', 'walk'], ['åpne', 'verb', 'open'], ['vondt', 'desc', 'pain'], ['opp', 'prep', 'up'], ['her', 'adv', 'here'], ['vent', 'neg', 'wait'], ['pappa', 'noun', 'father']],
  [['komme', 'verb', 'come'], ['hjelpe', 'verb', 'help'], ['ferdig', 'desc', 'finished'], ['ned', 'prep', 'down'], ['der', 'adv', 'there'], ['hjelp', 'neg', 'help'], ['do', 'noun', 'toilet']],
];

// Folder pages: columns 3–9, filled left to right, top to bottom. Up to 42 words.
export const FOLDER_WORDS = {
  mat: [
    ['vann', 'noun', 'water'], ['melk', 'noun', 'milk'], ['saft', 'noun', 'juice'], ['brød', 'noun', 'bread'],
    ['banan', 'noun', 'banana'], ['eple', 'noun', 'apple'], ['kjeks', 'noun', 'biscuit'], ['yoghurt', 'noun', 'yogurt'],
    ['ost', 'noun', 'cheese'], ['pizza', 'noun', 'pizza'], ['is', 'noun', 'ice cream'], ['middag', 'noun', 'dinner'],
    ['frokost', 'noun', 'breakfast'], ['sulten', 'desc', 'hungry'], ['tørst', 'desc', 'thirsty'], ['godt', 'desc', 'delicious'],
  ],
  folk: [
    ['mamma', 'noun', 'mother'], ['pappa', 'noun', 'father'], ['bror', 'noun', 'brother'], ['søster', 'noun', 'sister'],
    ['baby', 'noun', 'baby'], ['bestemor', 'noun', 'grandmother'], ['bestefar', 'noun', 'grandfather'], ['venn', 'noun', 'friend'],
    ['lærer', 'noun', 'teacher'], ['lege', 'noun', 'doctor'], ['gutt', 'noun', 'boy'], ['jente', 'noun', 'girl'],
  ],
  leke: [
    ['ball', 'noun', 'ball'], ['bok', 'noun', 'book'], ['nettbrett', 'noun', 'tablet'], ['klosser', 'noun', 'building blocks'],
    ['dukke', 'noun', 'doll'], ['bil', 'noun', 'toy car'], ['huske', 'noun', 'swing'], ['sklie', 'noun', 'slide'],
    ['tegne', 'verb', 'draw'], ['musikk', 'noun', 'music'], ['bade', 'verb', 'bath'], ['puslespill', 'noun', 'puzzle'],
  ],
  steder: [
    ['hjem', 'noun', 'house'], ['barnehage', 'noun', 'kindergarten'], ['skole', 'noun', 'school'], ['ute', 'adv', 'outside'],
    ['toalett', 'noun', 'toilet'], ['bad', 'noun', 'bathroom'], ['seng', 'noun', 'bed'], ['park', 'noun', 'park'],
    ['butikk', 'noun', 'shop'], ['bil', 'noun', 'car'], ['buss', 'noun', 'bus'], ['kjøkken', 'noun', 'kitchen'],
  ],
  folelser: [
    ['glad', 'desc', 'happy'], ['lei seg', 'desc', 'sad'], ['sint', 'desc', 'angry'], ['redd', 'desc', 'scared'],
    ['trøtt', 'desc', 'tired'], ['syk', 'desc', 'sick'], ['sulten', 'desc', 'hungry'], ['tørst', 'desc', 'thirsty'],
    ['varm', 'desc', 'hot'], ['kald', 'desc', 'cold'], ['rolig', 'desc', 'calm'], ['vondt', 'desc', 'pain'],
  ],
  klaer: [
    ['jakke', 'noun', 'jacket'], ['bukse', 'noun', 'trousers'], ['genser', 'noun', 'sweater'], ['sko', 'noun', 'shoes'],
    ['støvler', 'noun', 'boots'], ['lue', 'noun', 'cap'], ['votter', 'noun', 'mittens'], ['sokker', 'noun', 'socks'],
    ['regntøy', 'noun', 'raincoat'], ['bleie', 'noun', 'diaper'], ['pysjamas', 'noun', 'pajamas'], ['på', 'prep', 'put on'],
  ],
};
