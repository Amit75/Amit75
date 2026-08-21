export const AARULYA_STORE_PROMISE = Object.freeze({
  productPosition: 'intent-first trusted action platform',
  primaryQuestion: 'User को कौन-सा app चाहिए नहीं, user का काम क्या है?',
  corePromise: 'काम खोजो, सुरक्षित tool तुरंत चलाओ, जरूरत होने पर ही app install करो.',
  copiesOtherStores: false,
  paidOrganicRankingAllowed: false,
  hiddenAdsAllowed: false,
  forcedAccountForOfflineTools: false
});

export const DIFFERENTIATORS = Object.freeze([
  {
    id: 'intent-first-search',
    title: 'काम बोलकर खोजें',
    promise: 'User app का नाम नहीं, अपना काम बोले—जैसे फोटो 50 KB, PDF बनाना, GST निकालना या फसल खर्च लिखना.',
    delivery: 'Hindi, Hinglish और regional voice/text intent routing सीधे सही action तक ले जाएगा.'
  },
  {
    id: 'instant-mini-tools',
    title: 'Install से पहले काम पूरा',
    promise: 'छोटे calculator, converter, image resize, QR और PDF actions Store के अंदर Try Now से चलेंगे.',
    delivery: 'User को हर छोटे काम के लिए अलग app install नहीं करना पड़ेगा.'
  },
  {
    id: 'verified-trust-receipt',
    title: 'हर app का Trust Receipt',
    promise: 'Install से पहले permissions, data collection, signer, APK hash, scans, build proof और security review साफ दिखेंगे.',
    delivery: 'Self-declared badge नहीं; exact release digest से बंधी signed evidence दिखाई जाएगी.'
  },
  {
    id: 'safe-update-and-rollback',
    title: 'खराब update से सुरक्षा',
    promise: 'Staged rollout, health monitoring, revocation और last-safe-version rollback रहेगा.',
    delivery: 'Crash या security incident पर affected release रोका जा सकेगा.'
  },
  {
    id: 'lite-offline-first',
    title: 'कम data और कमजोर network में उपयोगी',
    promise: 'जहाँ possible हो core task offline चलेगा, downloads resumable होंगे और Lite assets उपलब्ध होंगे.',
    delivery: 'App size, data use और offline capability listing पर पहले से दिखेंगे.'
  },
  {
    id: 'need-packs',
    title: 'एक tap में काम के Packs',
    promise: 'Student, Kisan, Shop, Creator, Family और Business Packs curated apps व mini-tools देंगे.',
    delivery: 'User को dozens of categories में भटकने की जरूरत नहीं होगी.'
  },
  {
    id: 'privacy-control-center',
    title: 'एक जगह privacy control',
    promise: 'हर Aarulya app की permissions, sessions, cloud sync, export और deletion एक dashboard से manage होंगे.',
    delivery: 'Shared account के बावजूद per-app consent और data isolation रहेगा.'
  },
  {
    id: 'family-safe-mode',
    title: 'बच्चों के लिए अलग सुरक्षित अनुभव',
    promise: 'No stranger chat, no behavioral ads, parent gate, time controls और age-appropriate discovery.',
    delivery: 'Kids ranking में केवल child-safety eligible releases आएँगे.'
  },
  {
    id: 'transparent-discovery',
    title: 'साफ Top Charts',
    promise: 'Organic ranking verified installs, retention, stability, ratings और uninstall/fraud signals पर बनेगी.',
    delivery: 'Sponsored placement अलग label होगा और organic rank खरीदा नहीं जा सकेगा.'
  },
  {
    id: 'human-support-and-fix-path',
    title: 'समस्या पर स्पष्ट मदद',
    promise: 'One-tap report, status tracking, safe workaround, rollback और verified support identity.',
    delivery: 'Fake support numbers और hidden complaint flow की अनुमति नहीं होगी.'
  }
]);

export const DELIVERY_MODES = Object.freeze({
  miniTool: Object.freeze({
    label: 'Try Now mini-tool',
    bestFor: 'छोटा, focused, low-risk और तुरंत पूरा होने वाला task',
    examples: ['calculator', 'unit-converter', 'photo-resizer', 'qr-tools', 'image-to-pdf']
  }),
  dedicatedApp: Object.freeze({
    label: 'Dedicated app',
    bestFor: 'लंबे sessions, background work, large files, account sync या complex workflow',
    examples: ['aarulya-play', 'aarulya-saathi', 'aaru-browser', 'aarulya-books', 'aarulya-kisan']
  }),
  curatedPack: Object.freeze({
    label: 'Need-based pack',
    bestFor: 'एक user group के कई related apps और actions',
    examples: ['student-pack', 'kisan-pack', 'shop-pack', 'creator-pack', 'family-pack']
  })
});

export const RELEASED_DIFFERENTIATOR_RULES = Object.freeze({
  claimOnlyWhenOperational: true,
  showPlannedFeaturesAsAvailable: false,
  tryNowRequiresSandboxBoundary: true,
  trustReceiptRequiresVerifiedEvidence: true,
  offlineClaimRequiresOfflineTest: true,
  liteClaimRequiresMeasuredSizeAndDataBudget: true,
  regionalLanguageClaimRequiresHumanQualityReview: true,
  supportClaimRequiresStaffedEscalationPath: true
});

export function chooseDeliveryMode(capability = {}) {
  const permissions = Array.isArray(capability.permissions) ? capability.permissions : [];
  const isLowRisk = permissions.length === 0 || permissions.every((permission) => ['CAMERA', 'READ_MEDIA_IMAGES'].includes(permission));
  const finishesQuickly = Number(capability.typicalTaskMinutes || 99) <= 3;
  const smallRuntime = Number(capability.runtimeSizeMb || 999) <= 12;
  const noBackgroundWork = capability.backgroundWorkRequired !== true;
  const noPersistentAccount = capability.accountRequired !== true;

  if (isLowRisk && finishesQuickly && smallRuntime && noBackgroundWork && noPersistentAccount) return 'miniTool';
  if (capability.belongsToNeedPack === true) return 'curatedPack';
  return 'dedicatedApp';
}
