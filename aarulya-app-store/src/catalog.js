export const APP_CATALOG = Object.freeze([
  { id:'aarulya-store', name:'Aarulya Store', packageId:'com.aarulya.store', category:'Apps', status:'in-development', age:'3+', description:'First-party Aarulya app discovery, verified downloads, installation, updates and Trust Receipts.' },
  { id:'aarulya-play', name:'Aarulya Play', packageId:'com.aarulya.play', category:'Games', status:'in-development', age:'7+', description:'Original family games, battles, missions and safe virtual rewards.' },
  { id:'aarulya-saathi', name:'Aarulya Saathi', packageId:'com.aarulya.saathi', category:'AI & Productivity', status:'in-development', age:'13+', description:'Private assistant for projects, files, research and daily work.' },
  { id:'aaru-browser', name:'Aaru Browser', packageId:'com.aarulya.browser', category:'Internet', status:'in-development', age:'13+', description:'Privacy-first browser and search companion.' },
  { id:'aarupay', name:'AaruPay', packageId:'com.aarulya.pay', category:'Finance', status:'in-development', age:'18+', description:'Merchant and payment operations companion; regulated functions remain gated.' },
  { id:'digitalworks', name:'Aarulya DigitalWorks', packageId:'com.aarulya.digitalworks', category:'Business', status:'in-development', age:'18+', description:'Client projects, proposals, delivery and support workspace.' },
  { id:'sentinel', name:'Aarulya Sentinel', packageId:'com.aarulya.sentinel', category:'Safety', status:'in-development', age:'18+', description:'Defensive safety, evidence and accountability workspace.' },
  { id:'cloud', name:'Aarulya Cloud', packageId:'com.aarulya.cloud', category:'Cloud & Files', status:'planned', age:'13+', description:'Files, backups, deployments and service status.' },
  { id:'owner-os', name:'Aarulya Owner', packageId:'com.aarulya.owner', category:'Business', status:'planned', age:'18+', description:'Owner dashboard for finance, projects, approvals and operations.' },

  { id:'calculator', name:'Aarulya Calculator', packageId:'com.aarulya.tools.calculator', category:'Daily Tools', status:'planned', age:'3+', description:'Basic, scientific, percentage, GST and loan calculations.' },
  { id:'unit-converter', name:'Aarulya Unit Converter', packageId:'com.aarulya.tools.converter', category:'Daily Tools', status:'planned', age:'3+', description:'Length, weight, temperature, area, speed and data conversion.' },
  { id:'qr-tools', name:'Aarulya QR Tools', packageId:'com.aarulya.tools.qr', category:'Daily Tools', status:'planned', age:'7+', description:'Scan and create QR codes with safe-link warnings.' },
  { id:'notes', name:'Aarulya Notes', packageId:'com.aarulya.tools.notes', category:'Daily Tools', status:'planned', age:'7+', description:'Offline notes, checklists, folders and optional cloud sync.' },
  { id:'clipboard', name:'Aarulya Clipboard', packageId:'com.aarulya.tools.clipboard', category:'Daily Tools', status:'planned', age:'13+', description:'Private clipboard history and reusable snippets.' },
  { id:'flashlight', name:'Aarulya Torch', packageId:'com.aarulya.tools.torch', category:'Daily Tools', status:'planned', age:'3+', description:'Torch, SOS pattern and screen light without unnecessary permissions.' },
  { id:'voice-recorder', name:'Aarulya Voice Recorder', packageId:'com.aarulya.tools.recorder', category:'Daily Tools', status:'planned', age:'13+', description:'Local recording, trim, rename and export.' },
  { id:'alarm-clock', name:'Aarulya Alarm & Timer', packageId:'com.aarulya.tools.clock', category:'Daily Tools', status:'planned', age:'7+', description:'Alarms, stopwatch, countdown and focus timer.' },

  { id:'pdf-suite', name:'Aarulya PDF Suite', packageId:'com.aarulya.docs.pdf', category:'Documents', status:'planned', age:'13+', description:'Merge, split, reorder, compress and protect PDF files.' },
  { id:'image-to-pdf', name:'Aarulya Image to PDF', packageId:'com.aarulya.docs.imagetopdf', category:'Documents', status:'planned', age:'7+', description:'Convert selected photos into ordered PDF documents.' },
  { id:'scanner', name:'Aarulya Document Scanner', packageId:'com.aarulya.docs.scanner', category:'Documents', status:'planned', age:'13+', description:'Crop, enhance and export document scans.' },
  { id:'document-compressor', name:'Aarulya File Compressor', packageId:'com.aarulya.docs.compress', category:'Documents', status:'planned', age:'13+', description:'Compress images, PDFs and supported documents locally.' },
  { id:'signature-helper', name:'Aarulya Signature Helper', packageId:'com.aarulya.docs.signature', category:'Documents', status:'planned', age:'18+', description:'Place saved signatures on documents; not a regulated digital signature.' },
  { id:'form-filler', name:'Aarulya Form Filler', packageId:'com.aarulya.docs.forms', category:'Documents', status:'planned', age:'18+', description:'Save reusable profile fields and fill supported forms.' },

  { id:'photo-editor', name:'Aarulya Photo Editor', packageId:'com.aarulya.media.photo', category:'Photo & Video', status:'planned', age:'7+', description:'Crop, rotate, filters, text, background blur and export.' },
  { id:'photo-resizer', name:'Aarulya Photo Resizer', packageId:'com.aarulya.media.resize', category:'Photo & Video', status:'planned', age:'7+', description:'Resize and compress photos for forms and sharing.' },
  { id:'video-compressor', name:'Aarulya Video Compressor', packageId:'com.aarulya.media.videocompress', category:'Photo & Video', status:'planned', age:'13+', description:'Reduce video size with quality presets.' },
  { id:'video-cutter', name:'Aarulya Video Cutter', packageId:'com.aarulya.media.videocut', category:'Photo & Video', status:'planned', age:'13+', description:'Trim, mute, rotate and export short clips.' },
  { id:'audio-cutter', name:'Aarulya Audio Cutter', packageId:'com.aarulya.media.audiocut', category:'Photo & Video', status:'planned', age:'13+', description:'Trim audio and create ringtones locally.' },
  { id:'poster-maker', name:'Aarulya Poster Maker', packageId:'com.aarulya.media.poster', category:'Photo & Video', status:'planned', age:'13+', description:'Original templates for shops, events and social posts.' },

  { id:'expense-manager', name:'Aarulya Expense Manager', packageId:'com.aarulya.finance.expense', category:'Finance', status:'planned', age:'18+', description:'Offline income, expense, budget and export tracking.' },
  { id:'emi-calculator', name:'Aarulya EMI Calculator', packageId:'com.aarulya.finance.emi', category:'Finance', status:'planned', age:'18+', description:'Loan EMI, interest and repayment schedule estimates.' },
  { id:'invoice', name:'Aarulya Invoice', packageId:'com.aarulya.business.invoice', category:'Business', status:'planned', age:'18+', description:'Create estimates, invoices, receipts and PDF exports.' },
  { id:'inventory', name:'Aarulya Inventory', packageId:'com.aarulya.business.inventory', category:'Business', status:'planned', age:'18+', description:'Products, stock movements and low-stock alerts.' },
  { id:'attendance', name:'Aarulya Attendance', packageId:'com.aarulya.business.attendance', category:'Business', status:'planned', age:'18+', description:'Simple staff attendance and monthly reports.' },
  { id:'crm-lite', name:'Aarulya CRM Lite', packageId:'com.aarulya.business.crm', category:'Business', status:'planned', age:'18+', description:'Leads, follow-ups, notes and pipeline stages.' },

  { id:'hindi-keyboard', name:'Aarulya Hindi Typing', packageId:'com.aarulya.language.hindi', category:'Language', status:'planned', age:'7+', description:'Hindi transliteration, phrases and typing practice.' },
  { id:'english-practice', name:'Aarulya English Practice', packageId:'com.aarulya.learning.english', category:'Education', status:'planned', age:'7+', description:'Basic grammar, vocabulary and spoken practice.' },
  { id:'math-kids', name:'Aarulya Maths Kids', packageId:'com.aarulya.learning.math', category:'Education', status:'planned', age:'5+', description:'Arithmetic, tables and short level challenges.' },
  { id:'gk-india', name:'Aarulya India GK', packageId:'com.aarulya.learning.gk', category:'Education', status:'planned', age:'7+', description:'India, Bihar, science and current-topic quiz packs.' },
  { id:'exam-planner', name:'Aarulya Exam Planner', packageId:'com.aarulya.learning.exam', category:'Education', status:'planned', age:'13+', description:'Syllabus, revision plans, mocks and progress tracking.' },
  { id:'kids-drawing', name:'Aarulya Kids Drawing', packageId:'com.aarulya.kids.drawing', category:'Kids & Family', status:'planned', age:'3+', description:'Offline drawing, colouring and shape activities.' },
  { id:'stories', name:'Aarulya Stories', packageId:'com.aarulya.kids.stories', category:'Kids & Family', status:'planned', age:'3+', description:'Original Hindi and English stories with parent controls.' },

  { id:'file-manager', name:'Aarulya File Manager', packageId:'com.aarulya.files.manager', category:'Cloud & Files', status:'planned', age:'13+', description:'Browse, search, organize and share local files.' },
  { id:'backup', name:'Aarulya Backup', packageId:'com.aarulya.files.backup', category:'Cloud & Files', status:'planned', age:'18+', description:'Encrypted backup plans for selected files and folders.' },
  { id:'password-vault', name:'Aarulya Vault', packageId:'com.aarulya.security.vault', category:'Safety', status:'planned', age:'18+', description:'Local encrypted password and secure-note vault.' },
  { id:'permission-checker', name:'Aarulya Permission Check', packageId:'com.aarulya.security.permissions', category:'Safety', status:'planned', age:'13+', description:'Explain installed-app permissions and risky settings.' },
  { id:'scam-check', name:'Aarulya Scam Check', packageId:'com.aarulya.security.scamcheck', category:'Safety', status:'planned', age:'13+', description:'Check suspicious text and links with clear safety guidance.' },
  { id:'local-services', name:'Aarulya Local Services', packageId:'com.aarulya.local.services', category:'India Utility', status:'planned', age:'18+', description:'Verified local business and service discovery.' },
  { id:'document-checklist', name:'Aarulya Document Checklist', packageId:'com.aarulya.india.documents', category:'India Utility', status:'planned', age:'18+', description:'Reusable document lists for applications and registrations.' }
]);

export const CATEGORIES = Object.freeze(['All', ...new Set(APP_CATALOG.map((app) => app.category))]);

export function getApp(appId) {
  return APP_CATALOG.find((app) => app.id === appId) ?? null;
}

export function getPublishedApps() {
  return APP_CATALOG.filter((app) => app.status === 'published');
}
