export const STORE_ZONES = Object.freeze([
  {
    id: 'games',
    name: 'Game Zone',
    icon: '🎮',
    tagline: 'Original games, tournaments and family play',
    audience: 'Kids, teens and adults',
    color: 'violet',
    appIds: ['aarulya-play'],
    planned: ['Arcade games', 'Cricket games', 'Puzzle games', 'Board games', 'Kids learning games', 'Offline mini games'],
    rules: ['No wagering', 'No cash stake', 'Child-safe ads', 'Age-based profiles']
  },
  {
    id: 'tools',
    name: 'Daily Tools Zone',
    icon: '🧰',
    tagline: 'छोटे-छोटे रोज़ काम आने वाले tools',
    audience: 'Everyone',
    color: 'cyan',
    appIds: ['calculator', 'unit-converter', 'qr-tools', 'notes', 'clipboard', 'flashlight', 'voice-recorder', 'alarm-clock'],
    planned: ['Calculator', 'QR scanner', 'Unit converter', 'Notes', 'Alarm', 'Torch', 'Clipboard', 'Voice recorder'],
    rules: ['Minimum permissions', 'Offline-first', 'No forced login', 'No disruptive ads']
  },
  {
    id: 'books',
    name: 'Book & Knowledge Zone',
    icon: '📚',
    tagline: 'Books, audiobooks, notes and knowledge collections',
    audience: 'Readers and learners',
    color: 'amber',
    appIds: ['stories', 'english-practice', 'gk-india'],
    planned: ['Book reader', 'Hindi books', 'Children stories', 'Audiobooks', 'Bookmarks', 'Personal library', 'Public-domain classics'],
    rules: ['Original or licensed books only', 'Public-domain verification', 'No pirated PDFs', 'Author attribution']
  },
  {
    id: 'cinema',
    name: 'Cinema & Entertainment Zone',
    icon: '🎬',
    tagline: 'Original videos, trailers, short films and licensed entertainment',
    audience: 'Age-rated viewers',
    color: 'rose',
    appIds: [],
    planned: ['Aarulya originals', 'Short films', 'Trailers', 'Music videos', 'Kids animation', 'Regional creator channels', 'Watchlist'],
    rules: ['Licensed content only', 'Age ratings', 'No pirated movies', 'Regional language controls']
  },
  {
    id: 'farmer',
    name: 'Farmer Zone',
    icon: '🌾',
    tagline: 'खेती, खर्च, फसल और पशुपालन के records',
    audience: 'Farmers and rural families',
    color: 'green',
    appIds: ['expense-manager', 'document-checklist', 'local-services'],
    planned: ['Crop diary', 'Farm expense record', 'Seed and fertilizer log', 'Harvest record', 'Livestock record', 'Weather alerts', 'Mandi information', 'Land document organizer', 'Voice notes'],
    rules: ['Clear source dates', 'Offline records', 'No false price guarantee', 'Hindi and regional language support']
  },
  {
    id: 'students',
    name: 'Student & Education Zone',
    icon: '🎓',
    tagline: 'Study, exams, languages and learning tools',
    audience: 'Students and parents',
    color: 'blue',
    appIds: ['english-practice', 'math-kids', 'gk-india', 'exam-planner', 'kids-drawing'],
    planned: ['Exam planner', 'Mock tests', 'Math practice', 'English practice', 'GK', 'Revision cards', 'School tools'],
    rules: ['Age-appropriate content', 'No misleading rank promise', 'Parent controls', 'Learning progress privacy']
  },
  {
    id: 'business',
    name: 'Business Zone',
    icon: '🏪',
    tagline: 'Shop, office, client and team management',
    audience: 'Businesses and professionals',
    color: 'indigo',
    appIds: ['digitalworks', 'owner-os', 'invoice', 'inventory', 'attendance', 'crm-lite', 'expense-manager'],
    planned: ['Invoice', 'Inventory', 'CRM', 'Attendance', 'Expense tracking', 'Shop dashboard', 'Client portal'],
    rules: ['Business data isolation', 'Exports and backups', 'Role permissions', 'Audit history']
  },
  {
    id: 'creator',
    name: 'Photo, Video & Creator Zone',
    icon: '🎨',
    tagline: 'Photo editing, video tools, audio and posters',
    audience: 'Creators and businesses',
    color: 'pink',
    appIds: ['photo-editor', 'photo-resizer', 'video-compressor', 'video-cutter', 'audio-cutter', 'poster-maker'],
    planned: ['Photo editor', 'Background tools', 'Video compressor', 'Video cutter', 'Audio cutter', 'Poster maker', 'Thumbnail maker'],
    rules: ['Original templates', 'Local processing where possible', 'No watermark deception', 'Export quality disclosure']
  },
  {
    id: 'kids-family',
    name: 'Kids & Family Zone',
    icon: '👨‍👩‍👧‍👦',
    tagline: 'Safe learning, stories, drawing and family utilities',
    audience: 'Children and parents',
    color: 'orange',
    appIds: ['math-kids', 'kids-drawing', 'stories', 'aarulya-play'],
    planned: ['Kids stories', 'Drawing', 'Math games', 'Memory games', 'Parent dashboard', 'Screen-time reminders'],
    rules: ['No open chat', 'No cash prompts', 'Contextual child-safe ads only', 'Parent controls']
  },
  {
    id: 'government-docs',
    name: 'Government & Documents Zone',
    icon: '📄',
    tagline: 'Documents, forms, scanning and application helpers',
    audience: 'Indian citizens and service operators',
    color: 'slate',
    appIds: ['pdf-suite', 'image-to-pdf', 'scanner', 'document-compressor', 'signature-helper', 'form-filler', 'document-checklist'],
    planned: ['PDF tools', 'Document scanner', 'Form helper', 'Document checklist', 'Application tracker', 'Receipt organizer'],
    rules: ['Not an official government app unless authorized', 'Source links shown', 'No fake approvals', 'Sensitive files protected']
  },
  {
    id: 'jobs-skills',
    name: 'Jobs & Skills Zone',
    icon: '💼',
    tagline: 'Jobs, freelancing, skills and work preparation',
    audience: 'Job seekers and workers',
    color: 'teal',
    appIds: ['exam-planner', 'english-practice', 'digitalworks'],
    planned: ['Job alerts', 'Resume builder', 'Interview practice', 'Skill courses', 'Freelance leads', 'Application tracker'],
    rules: ['Verified source labels', 'No job guarantee', 'Scam reporting', 'No advance-fee job listings']
  },
  {
    id: 'safety',
    name: 'Safety & Privacy Zone',
    icon: '🛡️',
    tagline: 'Privacy, scam awareness and secure personal tools',
    audience: 'Teens and adults',
    color: 'red',
    appIds: ['sentinel', 'password-vault', 'permission-checker', 'scam-check'],
    planned: ['Permission checker', 'Scam check', 'Secure vault', 'Emergency records', 'Evidence organizer'],
    rules: ['Defensive use only', 'Encryption for sensitive data', 'No spyware', 'Clear emergency limitations']
  },
  {
    id: 'cloud-files',
    name: 'Cloud & Files Zone',
    icon: '☁️',
    tagline: 'Files, backup, sync and Aarulya Cloud services',
    audience: 'Everyone with age controls',
    color: 'sky',
    appIds: ['cloud', 'file-manager', 'backup'],
    planned: ['File manager', 'Encrypted backup', 'Cloud drive', 'Device sync', 'Release downloads'],
    rules: ['Encryption in transit', 'Backup recovery checks', 'Storage quotas shown', 'No silent uploads']
  }
]);

export function getZone(zoneId) {
  return STORE_ZONES.find((zone) => zone.id === zoneId) ?? null;
}

export function getAppsForZone(zone, catalog) {
  const ids = new Set(zone.appIds);
  return catalog.filter((app) => ids.has(app.id));
}
