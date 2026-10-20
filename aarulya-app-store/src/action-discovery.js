const ACTIONS = Object.freeze([
  {
    id: 'resize-form-photo',
    appId: 'photo-resizer',
    mode: 'miniTool',
    title: 'फोटो का size कम करें',
    aliases: ['photo 50 kb', 'passport photo size', 'फोटो छोटा करना', 'image compress', 'form photo', 'फोटो 20 केबी', 'फोटो resize'],
    safety: 'local-processing-preferred'
  },
  {
    id: 'scan-to-pdf',
    appId: 'scanner',
    mode: 'miniTool',
    title: 'कागज scan करके PDF बनाएं',
    aliases: ['scan pdf', 'document scan', 'कागज का pdf', 'दस्तावेज स्कैन', 'camera se pdf'],
    safety: 'local-processing-preferred'
  },
  {
    id: 'images-to-pdf',
    appId: 'image-to-pdf',
    mode: 'miniTool',
    title: 'फोटो जोड़कर PDF बनाएं',
    aliases: ['photo to pdf', 'image pdf', 'कई फोटो एक pdf', 'फोटो से पीडीएफ'],
    safety: 'local-processing-preferred'
  },
  {
    id: 'gst-calculation',
    appId: 'calculator',
    mode: 'miniTool',
    title: 'GST जोड़ें या निकालें',
    aliases: ['gst calculate', '18 percent gst', 'जीएसटी निकालना', 'tax calculator', 'gst amount'],
    safety: 'no-account-required'
  },
  {
    id: 'emi-estimate',
    appId: 'emi-calculator',
    mode: 'miniTool',
    title: 'EMI का अनुमान निकालें',
    aliases: ['emi calculate', 'loan installment', 'किस्त कितना होगा', 'ब्याज कैलकुलेटर'],
    safety: 'estimate-only-clear-disclosure'
  },
  {
    id: 'create-qr',
    appId: 'qr-tools',
    mode: 'miniTool',
    title: 'QR code बनाएं या scan करें',
    aliases: ['qr बनाना', 'qr scan', 'link qr', 'wifi qr', 'क्यूआर कोड'],
    safety: 'safe-link-warning'
  },
  {
    id: 'translate-type-hindi',
    appId: 'hindi-keyboard',
    mode: 'miniTool',
    title: 'Hinglish से Hindi लिखें',
    aliases: ['hindi typing', 'english se hindi', 'हिंदी में लिखना', 'hinglish convert'],
    safety: 'local-processing-preferred'
  },
  {
    id: 'farm-expense-record',
    appId: 'aarulya-kisan',
    mode: 'dedicatedApp',
    title: 'खेती का खर्च और रिकॉर्ड रखें',
    aliases: ['खेती खर्च', 'फसल का हिसाब', 'किसान रिकॉर्ड', 'बीज खाद खर्च', 'farm diary'],
    safety: 'account-optional-offline-first'
  },
  {
    id: 'student-revision-plan',
    appId: 'exam-planner',
    mode: 'dedicatedApp',
    title: 'पढ़ाई और revision plan बनाएं',
    aliases: ['study plan', 'exam timetable', 'revision schedule', 'पढ़ाई का टाइम टेबल', 'mock plan'],
    safety: 'child-safe-profile-when-applicable'
  },
  {
    id: 'shop-invoice',
    appId: 'invoice',
    mode: 'dedicatedApp',
    title: 'Bill और invoice बनाएं',
    aliases: ['bill बनाना', 'invoice pdf', 'दुकान रसीद', 'estimate बनाना', 'quotation'],
    safety: 'local-first-encrypted-records'
  },
  {
    id: 'check-suspicious-link',
    appId: 'scam-check',
    mode: 'miniTool',
    title: 'संदिग्ध link या message जांचें',
    aliases: ['fraud link', 'scam check', 'फर्जी मैसेज', 'लिंक सुरक्षित है', 'otp fraud'],
    safety: 'never-ask-for-otp-or-password'
  },
  {
    id: 'play-family-games',
    appId: 'aarulya-play',
    mode: 'dedicatedApp',
    title: 'Safe family games खेलें',
    aliases: ['game खेलना', 'बच्चों का game', 'family games', 'offline games', 'cricket game'],
    safety: 'age-mode-and-parent-controls'
  }
]);

const normalize = (value = '') => value
  .toLocaleLowerCase('en-IN')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function tokenScore(query, text) {
  const queryTokens = new Set(normalize(query).split(' ').filter(Boolean));
  const textTokens = new Set(normalize(text).split(' ').filter(Boolean));
  if (!queryTokens.size || !textTokens.size) return 0;
  let matches = 0;
  queryTokens.forEach((token) => { if (textTokens.has(token)) matches += 1; });
  return matches / queryTokens.size;
}

export function findActions(query, limit = 5) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return ACTIONS
    .map((action) => {
      const exactAlias = action.aliases.some((alias) => normalize(alias) === normalizedQuery);
      const containsAlias = action.aliases.some((alias) => normalize(alias).includes(normalizedQuery) || normalizedQuery.includes(normalize(alias)));
      const searchable = [action.title, ...action.aliases].join(' ');
      const score = exactAlias ? 1 : containsAlias ? 0.88 : tokenScore(normalizedQuery, searchable);
      return { ...action, score };
    })
    .filter((action) => action.score >= 0.34)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'hi'))
    .slice(0, Math.max(1, Math.min(limit, 10)));
}

export function listStarterActions() {
  return ACTIONS.map(({ aliases, ...action }) => Object.freeze({ ...action }));
}
