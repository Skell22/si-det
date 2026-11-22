// Starter vocabulary for Si det (Norwegian Bokmål), in three grid sizes.
//
// Each size has its own fixed layout. Inside a size nothing ever moves:
// "frame" cells (pronouns, helper verbs, folders) are the same on every page,
// and words are revealed step by step by un-hiding them in place.
// Changing size is a bigger step: the child learns a new layout.
//
// A word is [label, class, englishSearchTerm].
//   class – pron | verb | desc | noun | prep | soc | ques | adv | neg | fras
//   en    – used by tools/fetch-symbols.mjs to find an ARASAAC picture
// A word list for a review by a speech therapist (logoped) is in docs/words.md.

export const FOLDERS = {
  fraser: { label: 'Fraser', en: 'conversation' },
  mat: { label: 'Mat og drikke', en: 'food' },
  folk: { label: 'Folk', en: 'people' },
  leke: { label: 'Leke', en: 'toys' },
  steder: { label: 'Steder', en: 'places' },
  folelser: { label: 'Følelser', en: 'emotions' },
  klaer: { label: 'Klær', en: 'clothes' },
};

const F = (id) => ({ folder: id });

// Words a beginner starts with when "Vis bare startordene" is chosen.
export const STARTER = new Set([
  'jeg', 'vil', 'ha', 'mer', 'ferdig', 'hjelp', 'stopp', 'ja', 'nei', 'spise', 'drikke', 'leke', 'do',
  'Fraser', 'Mat og drikke', 'Leke',
]);

// ---------- Folder contents (shared; each size shows as many as fit) ----------

const FRASER = [
  ['Jeg vil ha', 'fras', 'want'], ['Kan du hjelpe meg?', 'fras', 'help'], ['Jeg er sulten', 'fras', 'hungry'],
  ['Jeg er tørst', 'fras', 'thirsty'], ['Jeg må på do', 'fras', 'toilet'], ['Jeg vil ikke', 'fras', 'no'],
  ['Jeg har vondt', 'fras', 'pain'], ['Se på meg', 'fras', 'look'], ['Jeg er ferdig', 'fras', 'finished'],
  ['Jeg vil leke', 'fras', 'play'], ['Kan du lese?', 'fras', 'read'], ['Hva er det?', 'fras', 'what'],
  ['Jeg er lei meg', 'fras', 'sad'], ['Jeg er trøtt', 'fras', 'tired'], ['Jeg vil ut', 'fras', 'go out'],
  ['Mer, takk', 'fras', 'more'], ['Kan jeg få?', 'fras', 'give'], ['Jeg liker det', 'fras', 'like'],
  ['Det liker jeg ikke', 'fras', 'dislike'], ['Vent litt', 'fras', 'wait'], ['Jeg vil hjem', 'fras', 'house'],
  ['Hvor er mamma?', 'fras', 'mother'], ['Hvor er pappa?', 'fras', 'father'], ['Jeg er glad', 'fras', 'happy'],
];

const MAT = [
  ['vann', 'noun', 'water'], ['melk', 'noun', 'milk'], ['saft', 'noun', 'juice'], ['brødskive', 'noun', 'slice of bread'],
  ['banan', 'noun', 'banana'], ['eple', 'noun', 'apple'], ['godteri', 'noun', 'sweets'], ['kjeks', 'noun', 'biscuit'],
  ['yoghurt', 'noun', 'yogurt'], ['ost', 'noun', 'cheese'], ['leverpostei', 'noun', 'pâté'], ['syltetøy', 'noun', 'jam'],
  ['pizza', 'noun', 'pizza'], ['is', 'noun', 'ice cream'], ['middag', 'noun', 'dinner'], ['frokost', 'noun', 'breakfast'],
  ['sulten', 'desc', 'hungry'], ['tørst', 'desc', 'thirsty'], ['godt', 'desc', 'delicious'], ['ekkelt', 'desc', 'disgusting'],
];

const FOLK = [
  ['mamma', 'noun', 'mother'], ['pappa', 'noun', 'father'], ['bror', 'noun', 'brother'], ['søster', 'noun', 'sister'],
  ['baby', 'noun', 'baby'], ['bestemor', 'noun', 'grandmother'], ['bestefar', 'noun', 'grandfather'], ['venn', 'noun', 'friend'],
  ['lærer', 'noun', 'teacher'], ['lege', 'noun', 'doctor'], ['gutt', 'noun', 'boy'], ['jente', 'noun', 'girl'],
];

const LEKE = [
  ['ball', 'noun', 'ball'], ['bok', 'noun', 'book'], ['nettbrett', 'noun', 'tablet'], ['klosser', 'noun', 'building blocks'],
  ['dukke', 'noun', 'doll'], ['bil', 'noun', 'toy car'], ['huske', 'noun', 'swing'], ['sklie', 'noun', 'slide'],
  ['tegne', 'verb', 'draw'], ['musikk', 'noun', 'music'], ['bade', 'verb', 'bath'], ['puslespill', 'noun', 'puzzle'],
  ['TV', 'noun', 'television'], ['ute', 'adv', 'outside'],
];

const STEDER = [
  ['hjem', 'noun', 'house'], ['barnehage', 'noun', 'kindergarten'], ['skole', 'noun', 'school'], ['ute', 'adv', 'outside'],
  ['toalett', 'noun', 'toilet'], ['bad', 'noun', 'bathroom'], ['seng', 'noun', 'bed'], ['park', 'noun', 'park'],
  ['butikk', 'noun', 'shop'], ['bil', 'noun', 'car'], ['buss', 'noun', 'bus'], ['kjøkken', 'noun', 'kitchen'],
];

const FOLELSER = [
  ['glad', 'desc', 'happy'], ['lei seg', 'desc', 'sad'], ['sint', 'desc', 'angry'], ['redd', 'desc', 'scared'],
  ['trøtt', 'desc', 'tired'], ['syk', 'desc', 'sick'], ['sulten', 'desc', 'hungry'], ['tørst', 'desc', 'thirsty'],
  ['varm', 'desc', 'hot'], ['kald', 'desc', 'cold'], ['rolig', 'desc', 'calm'], ['vondt', 'desc', 'pain'],
];

const KLAER = [
  ['jakke', 'noun', 'jacket'], ['bukse', 'noun', 'trousers'], ['genser', 'noun', 'sweater'], ['sko', 'noun', 'shoes'],
  ['støvler', 'noun', 'boots'], ['lue', 'noun', 'cap'], ['votter', 'noun', 'mittens'], ['sokker', 'noun', 'socks'],
  ['regntøy', 'noun', 'raincoat'], ['bleie', 'noun', 'diaper'], ['pysjamas', 'noun', 'pajamas'], ['på', 'prep', 'put on'],
];

// ---------- Sizes ----------
// frame: "row:col" -> word or folder, same on every page.
// pages: words for the other cells, filled left to right, top to bottom. null = empty.

export const SIZES = {
  small: {
    name: 'Liten', hint: '12 store knapper, for de første ordene',
    cols: 4, rows: 3,
    frame: { '0:3': F('mat'), '1:3': F('leke'), '2:3': F('fraser') },
    pages: {
      core: [
        ['mer', 'desc', 'more'], ['spise', 'verb', 'eat'], ['ja', 'soc', 'yes'],
        ['ferdig', 'desc', 'finished'], ['drikke', 'verb', 'drink'], ['nei', 'neg', 'no'],
        ['hjelp', 'neg', 'help'], ['do', 'noun', 'toilet'], ['stopp', 'neg', 'stop'],
      ],
      mat: [MAT[0], MAT[1], MAT[2], MAT[3], MAT[4], MAT[5], MAT[6], MAT[7], MAT[8]],
      leke: [LEKE[0], LEKE[1], LEKE[2], LEKE[3], LEKE[4], LEKE[5], LEKE[6], LEKE[13], LEKE[9]],
      fraser: FRASER.slice(0, 9),
    },
  },

  medium: {
    name: 'Middels', hint: '24 knapper, for korte setninger',
    cols: 6, rows: 4,
    frame: {
      '0:0': ['jeg', 'pron', 'I'], '0:1': ['vil', 'verb', 'want'], '0:5': F('fraser'),
      '1:0': ['du', 'pron', 'you'], '1:1': ['ha', 'verb', 'have'], '1:5': F('mat'),
      '2:0': ['meg', 'pron', 'me'], '2:1': ['kan', 'verb', 'can'], '2:5': F('leke'),
      '3:0': ['det', 'pron', 'it'], '3:1': ['er', 'verb', 'be'], '3:5': F('folelser'),
    },
    pages: {
      core: [
        ['spise', 'verb', 'eat'], ['mer', 'desc', 'more'], ['ja', 'soc', 'yes'],
        ['drikke', 'verb', 'drink'], ['ferdig', 'desc', 'finished'], ['nei', 'neg', 'no'],
        ['leke', 'verb', 'play'], ['hjelp', 'neg', 'help'], ['stopp', 'neg', 'stop'],
        ['do', 'noun', 'toilet'], ['vondt', 'desc', 'pain'], ['takk', 'soc', 'thank you'],
      ],
      fraser: FRASER.slice(0, 12),
      mat: MAT.slice(0, 12),
      leke: LEKE.slice(0, 12),
      folelser: FOLELSER.slice(0, 12),
    },
  },

  large: {
    name: 'Stor', hint: '70 knapper, alle kjerneordene',
    cols: 10, rows: 7,
    frame: {
      '0:0': ['jeg', 'pron', 'I'], '0:1': ['vil', 'verb', 'want'], '0:9': F('fraser'),
      '1:0': ['du', 'pron', 'you'], '1:1': ['kan', 'verb', 'can'], '1:9': F('mat'),
      '2:0': ['vi', 'pron', 'we'], '2:1': ['er', 'verb', 'be'], '2:9': F('folk'),
      '3:0': ['han', 'pron', 'he'], '3:1': ['har', 'verb', 'have'], '3:9': F('leke'),
      '4:0': ['hun', 'pron', 'she'], '4:1': ['liker', 'verb', 'like'], '4:9': F('steder'),
      '5:0': ['det', 'pron', 'it'], '5:1': ['får', 'verb', 'get'], '5:9': F('folelser'),
      '6:0': ['meg', 'pron', 'me'], '6:1': ['ha', 'verb', 'have'], '6:9': F('klaer'),
    },
    pages: {
      core: [
        ['spise', 'verb', 'eat'], ['se', 'verb', 'look'], ['mer', 'desc', 'more'], ['i', 'prep', 'in'], ['hva', 'ques', 'what'], ['ja', 'soc', 'yes'], ['hei', 'soc', 'hello'],
        ['drikke', 'verb', 'drink'], ['lage', 'verb', 'make'], ['stor', 'desc', 'big'], ['på', 'prep', 'on'], ['hvor', 'ques', 'where'], ['nei', 'neg', 'no'], ['ha det', 'soc', 'goodbye'],
        ['leke', 'verb', 'play'], ['ta', 'verb', 'take'], ['liten', 'desc', 'small'], ['inn', 'prep', 'enter'], ['hvem', 'ques', 'who'], ['ikke', 'neg', 'not'], ['takk', 'soc', 'thank you'],
        ['sove', 'verb', 'sleep'], ['gi', 'verb', 'give'], ['bra', 'desc', 'good'], ['ut', 'prep', 'go out'], ['når', 'ques', 'when'], ['stopp', 'neg', 'stop'], ['mamma', 'noun', 'mother'],
        ['gå', 'verb', 'walk'], ['åpne', 'verb', 'open'], ['vondt', 'desc', 'pain'], ['opp', 'prep', 'up'], ['her', 'adv', 'here'], ['vent', 'neg', 'wait'], ['pappa', 'noun', 'father'],
        ['komme', 'verb', 'come'], ['hjelpe', 'verb', 'help'], ['ferdig', 'desc', 'finished'], ['ned', 'prep', 'down'], ['der', 'adv', 'there'], ['hjelp', 'neg', 'help'], ['do', 'noun', 'toilet'],
        ['må', 'verb', 'must'], ['lese', 'verb', 'read'], ['sulten', 'desc', 'hungry'], ['til', 'prep', 'to'], ['hvorfor', 'ques', 'why'], ['unnskyld', 'soc', 'sorry'], ['nå', 'adv', 'now'],
      ],
      fraser: FRASER,
      mat: MAT,
      folk: FOLK,
      leke: LEKE,
      steder: STEDER,
      folelser: FOLELSER,
      klaer: KLAER,
    },
  },
};

export const DEFAULT_SIZE = 'large';

// Other forms of a word. Hold a key to pick one. Bokmål, to be checked by a logoped.
export const FORMS = {
  jeg: ['meg', 'min', 'mitt', 'mine'], du: ['deg', 'din', 'ditt', 'dine'], vi: ['oss', 'vår', 'vårt'],
  han: ['ham', 'hans'], hun: ['henne', 'hennes'], det: ['den', 'de'], meg: ['jeg', 'min'],
  vil: ['ville'], kan: ['kunne'], er: ['være', 'var'], har: ['ha', 'hadde'], ha: ['har', 'hadde'],
  liker: ['like', 'likte'], får: ['få', 'fikk'], må: ['måtte'],
  spise: ['spiser', 'spiste', 'har spist'], drikke: ['drikker', 'drakk'], leke: ['leker', 'lekte'],
  sove: ['sover', 'sov'], gå: ['går', 'gikk'], komme: ['kommer', 'kom'], se: ['ser', 'så'],
  lage: ['lager', 'laget'], ta: ['tar', 'tok'], gi: ['gir', 'ga'], åpne: ['åpner', 'åpnet'],
  hjelpe: ['hjelper', 'hjalp'], lese: ['leser', 'leste'], tegne: ['tegner', 'tegnet'], bade: ['bader', 'badet'],
  stor: ['store', 'større', 'størst'], liten: ['lita', 'lite', 'små', 'mindre', 'minst'], bra: ['bedre', 'best'],
  mer: ['mest'], glad: ['glade'], sulten: ['sultne'], 'tørst': ['tørste'],
  banan: ['bananen', 'bananer'], eple: ['eplet', 'epler'], brødskive: ['brødskiva', 'brødskiver'],
  kjeks: ['kjeksen'], ball: ['ballen', 'baller'], bok: ['boka', 'bøker'], bil: ['bilen', 'biler'],
  dukke: ['dukka', 'dukker'], sko: ['skoen', 'skoene'], venn: ['vennen', 'venner'],
};

// ---------- Helpers shared by the app and the build tools ----------

const folderWord = (id) => [FOLDERS[id].label, 'noun', FOLDERS[id].en];

// The base cells of one page in one size, row by row: { key, word, folder? }.
// word is null for an empty cell. Keys never change, so a parent's edits stay put.
export function baseCells(sizeId, page) {
  const s = SIZES[sizeId];
  const list = s.pages[page] || [];
  const out = [];
  let i = 0;
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const at = `${r}:${c}`;
    const f = s.frame[at];
    if (f?.folder) out.push({ key: `${sizeId}:frame:${at}`, word: folderWord(f.folder), folder: f.folder });
    else if (f) out.push({ key: `${sizeId}:frame:${at}`, word: f });
    else out.push({ key: `${sizeId}:${page}:${at}`, word: list[i++] || null });
  }
  return out;
}

// Every page id a size has: core first, then its folders.
export const pagesOf = (sizeId) => Object.keys(SIZES[sizeId].pages);

// Every distinct word in every size, plus folder names: [label, cls, en].
export function allWords() {
  const seen = new Map();
  for (const id of Object.keys(SIZES)) for (const page of pagesOf(id)) {
    for (const cell of baseCells(id, page)) if (cell.word) seen.set(`${cell.word[0]}|${cell.word[2]}`, cell.word);
  }
  return [...seen.values()];
}
