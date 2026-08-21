export const PLATFORM_APPS = Object.freeze([
  {
    id: 'aarulya-books',
    name: 'Aarulya Books',
    packageId: 'com.aarulya.books',
    category: 'Books & Learning',
    status: 'planned',
    age: '7+',
    description: 'Original and licensed books, audiobooks, bookmarks, notes and a personal reading library.'
  },
  {
    id: 'aarulya-cinema',
    name: 'Aarulya Cinema',
    packageId: 'com.aarulya.cinema',
    category: 'Entertainment',
    status: 'planned',
    age: '13+',
    description: 'Aarूल्या originals, short films, regional creator videos and licensed entertainment with age ratings.'
  },
  {
    id: 'aarulya-kisan',
    name: 'Aarulya Kisan',
    packageId: 'com.aarulya.kisan',
    category: 'Farmer & Rural',
    status: 'planned',
    age: '18+',
    description: 'Crop diary, farm expenses, livestock records, mandi notes, land-document organizer and weather alerts.'
  },
  {
    id: 'aarulya-learning',
    name: 'Aarulya Learning',
    packageId: 'com.aarulya.learning',
    category: 'Education',
    status: 'planned',
    age: '7+',
    description: 'School learning, exams, languages, maths, GK, revision and parent-visible progress.'
  }
]);

export const STOREFRONT_SHELVES = Object.freeze([
  {
    id: 'featured',
    title: 'Featured Aarulya apps',
    subtitle: 'बड़े platforms और ecosystem apps',
    appIds: ['aarulya-play', 'aarulya-saathi', 'aarulya-books', 'aarulya-cinema', 'aarulya-kisan', 'aaru-browser']
  },
  {
    id: 'daily',
    title: 'Daily essentials',
    subtitle: 'रोज़ काम आने वाले छोटे और fast tools',
    appIds: ['calculator', 'unit-converter', 'qr-tools', 'notes', 'alarm-clock', 'flashlight', 'voice-recorder', 'clipboard']
  },
  {
    id: 'documents',
    title: 'Documents & PDF',
    subtitle: 'Scan, convert, compress और organize',
    appIds: ['scanner', 'image-to-pdf', 'pdf-suite', 'document-compressor', 'form-filler', 'signature-helper', 'document-checklist']
  },
  {
    id: 'creator',
    title: 'Photo, video & creator tools',
    subtitle: 'Editing, resizing, posters और media utilities',
    appIds: ['photo-editor', 'photo-resizer', 'video-compressor', 'video-cutter', 'audio-cutter', 'poster-maker']
  },
  {
    id: 'games',
    title: 'Games',
    subtitle: 'Original family games और battle experiences',
    appIds: ['aarulya-play']
  },
  {
    id: 'books-learning',
    title: 'Books & learning',
    subtitle: 'Reading, stories, study और exam preparation',
    appIds: ['aarulya-books', 'aarulya-learning', 'stories', 'english-practice', 'math-kids', 'gk-india', 'exam-planner', 'kids-drawing']
  },
  {
    id: 'farmer',
    title: 'For farmers and rural families',
    subtitle: 'Records, local services और useful rural tools',
    appIds: ['aarulya-kisan', 'expense-manager', 'local-services', 'document-checklist', 'voice-recorder']
  },
  {
    id: 'business',
    title: 'Business & work',
    subtitle: 'Invoice, inventory, CRM, attendance और client work',
    appIds: ['digitalworks', 'owner-os', 'invoice', 'inventory', 'attendance', 'crm-lite', 'expense-manager']
  },
  {
    id: 'safety-cloud',
    title: 'Safety, privacy & cloud',
    subtitle: 'Secure tools, files, backup और protection',
    appIds: ['sentinel', 'cloud', 'file-manager', 'backup', 'password-vault', 'permission-checker', 'scam-check']
  }
]);

export function mergeCatalog(coreCatalog) {
  const byId = new Map();
  [...PLATFORM_APPS, ...coreCatalog].forEach((app) => byId.set(app.id, app));
  return [...byId.values()];
}
