import { APP_CATALOG } from './catalog.js';
import { PLATFORM_APPS, STOREFRONT_SHELVES, mergeCatalog } from './storefront.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const ALL_APPS = Object.freeze(mergeCatalog(APP_CATALOG));
const APPS_BY_ID = new Map(ALL_APPS.map((app) => [app.id, app]));
const CATEGORIES = Object.freeze(['All', ...new Set(ALL_APPS.map((app) => app.category))]);

const icons = {
  'aarulya-play': '🎮',
  'aarulya-saathi': '✦',
  'aarulya-books': '📚',
  'aarulya-cinema': '🎬',
  'aarulya-kisan': '🌾',
  'aarulya-learning': '🎓',
  'aaru-browser': '🌐',
  'aarupay': '₹',
  digitalworks: '💼',
  sentinel: '🛡️',
  cloud: '☁️',
  'owner-os': 'A',
  calculator: '∑',
  'unit-converter': '⇄',
  'qr-tools': '▦',
  notes: '📝',
  clipboard: '📋',
  flashlight: '🔦',
  'voice-recorder': '🎙️',
  'alarm-clock': '⏱️',
  scanner: '▤',
  'image-to-pdf': 'PDF',
  'pdf-suite': 'PDF',
  'document-compressor': 'ZIP',
  'signature-helper': '✍️',
  'form-filler': '☑',
  'photo-editor': '🖼️',
  'photo-resizer': '↔',
  'video-compressor': '🎞️',
  'video-cutter': '✂',
  'audio-cutter': '♫',
  'poster-maker': '🎨',
  'expense-manager': '₹',
  'emi-calculator': '%',
  invoice: '🧾',
  inventory: '📦',
  attendance: '✓',
  'crm-lite': '👥',
  'hindi-keyboard': 'अ',
  'english-practice': 'Aa',
  'math-kids': '123',
  'gk-india': '🇮🇳',
  'exam-planner': '📅',
  'kids-drawing': '🖍️',
  stories: '📖',
  'file-manager': '📁',
  backup: '↥',
  'password-vault': '🔐',
  'permission-checker': '✓',
  'scam-check': '⚠',
  'local-services': '📍',
  'document-checklist': '☑'
};

const statusLabels = {
  planned: 'Planned',
  'in-development': 'In development',
  review: 'Security review',
  published: 'Available'
};

let selectedCategory = 'All';

function iconFor(app) {
  return icons[app.id] || app.name.slice(0, 1).toUpperCase();
}

function appCard(app, compact = false) {
  const available = app.status === 'published';
  return `
    <article class="app-card ${compact ? 'compact' : ''}" data-app-card="${app.id}" tabindex="0" role="button" aria-label="${app.name} details">
      <div class="app-icon">${iconFor(app)}</div>
      <div class="app-info">
        <span class="status ${app.status}">${statusLabels[app.status] || app.status}</span>
        <h3>${app.name}</h3>
        <p>${app.description}</p>
        <div class="app-meta"><span>${app.category}</span><span>${app.age}</span></div>
      </div>
      <button class="card-action" data-open-app="${app.id}">${available ? 'Get' : 'Details'}</button>
    </article>`;
}

function bindAppCards(root = document) {
  $$('[data-open-app]', root).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openApp(button.dataset.openApp);
    });
  });
  $$('[data-app-card]', root).forEach((card) => {
    card.addEventListener('click', () => openApp(card.dataset.appCard));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openApp(card.dataset.appCard);
      }
    });
  });
}

function renderFeatured() {
  const featured = STOREFRONT_SHELVES.find((shelf) => shelf.id === 'featured');
  const apps = featured.appIds.map((id) => APPS_BY_ID.get(id)).filter(Boolean);
  $('#featuredGrid').innerHTML = apps.map((app, index) => `
    <article class="feature-card feature-${index + 1}" data-app-card="${app.id}" tabindex="0" role="button">
      <div class="feature-icon">${iconFor(app)}</div>
      <div>
        <p class="eyebrow">${app.category}</p>
        <h3>${app.name}</h3>
        <p>${app.description}</p>
        <span class="feature-status">${statusLabels[app.status] || app.status}</span>
      </div>
    </article>`).join('');
  bindAppCards($('#featuredGrid'));
}

function renderCategories() {
  $('#categoryChips').innerHTML = CATEGORIES.map((category) => `
    <button class="chip ${category === selectedCategory ? 'active' : ''}" data-category="${category}">${category}</button>`).join('');

  $$('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedCategory = button.dataset.category;
      renderCategories();
      renderAllApps();
      $('#allAppsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderShelves() {
  const shelves = STOREFRONT_SHELVES.filter((shelf) => shelf.id !== 'featured');
  $('#shelves').innerHTML = shelves.map((shelf) => {
    const apps = shelf.appIds.map((id) => APPS_BY_ID.get(id)).filter(Boolean);
    if (!apps.length) return '';
    return `
      <section class="shelf" data-shelf="${shelf.id}">
        <div class="section-head">
          <div><p class="eyebrow">CURATED</p><h2>${shelf.title}</h2><p class="section-subtitle">${shelf.subtitle}</p></div>
          <button class="text-button" data-show-shelf="${shelf.id}">सभी देखें</button>
        </div>
        <div class="shelf-row">${apps.map((app) => appCard(app, true)).join('')}</div>
      </section>`;
  }).join('');

  bindAppCards($('#shelves'));
  $$('[data-show-shelf]').forEach((button) => {
    button.addEventListener('click', () => {
      const shelf = STOREFRONT_SHELVES.find((item) => item.id === button.dataset.showShelf);
      const first = shelf?.appIds.map((id) => APPS_BY_ID.get(id)).find(Boolean);
      if (!first) return;
      selectedCategory = first.category;
      renderCategories();
      renderAllApps();
      $('#allAppsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderAllApps() {
  const apps = selectedCategory === 'All'
    ? ALL_APPS
    : ALL_APPS.filter((app) => app.category === selectedCategory);

  $('#visibleCount').textContent = `${apps.length} apps`;
  $('#appGrid').innerHTML = apps.map((app) => appCard(app)).join('');
  $('#emptyState').hidden = apps.length > 0;
  bindAppCards($('#appGrid'));
}

function runSearch(query) {
  const normalized = query.trim().toLocaleLowerCase('en-IN');
  const searchSection = $('#searchResultsSection');
  const normalSections = [$('#featured'), $('#shelves'), $('#allAppsSection')];

  if (!normalized) {
    searchSection.hidden = true;
    normalSections.forEach((section) => { section.hidden = false; });
    return;
  }

  const results = ALL_APPS.filter((app) => [app.name, app.category, app.description, app.packageId]
    .join(' ')
    .toLocaleLowerCase('en-IN')
    .includes(normalized));

  normalSections.forEach((section) => { section.hidden = true; });
  searchSection.hidden = false;
  $('#searchTitle').textContent = `“${query.trim()}” के results`;
  $('#searchResults').innerHTML = results.map((app) => appCard(app)).join('');
  $('#searchEmpty').hidden = results.length > 0;
  bindAppCards($('#searchResults'));
}

function openApp(appId) {
  const app = APPS_BY_ID.get(appId);
  if (!app) return;

  $('#detailCategory').textContent = app.category;
  $('#detailName').textContent = app.name;
  $('#detailIcon').textContent = iconFor(app);
  $('#detailDescription').textContent = app.description;
  $('#detailPackage').textContent = app.packageId;
  $('#detailStatus').textContent = statusLabels[app.status] || app.status;
  $('#detailAge').textContent = app.age;

  const download = $('#downloadButton');
  const available = app.status === 'published' && app.apkUrl;
  download.disabled = !available;
  download.textContent = available ? 'Verified APK डाउनलोड करें' : 'Release अभी उपलब्ध नहीं';
  $('#appDialog').showModal();
}

$('#searchInput').addEventListener('input', (event) => runSearch(event.target.value));
$('#clearSearch').addEventListener('click', () => {
  $('#searchInput').value = '';
  runSearch('');
  $('#searchInput').focus();
});
$('#closeDialog').addEventListener('click', () => $('#appDialog').close());
$('#developerButton').addEventListener('click', () => $('#developerDialog').showModal());
$('#closeDeveloper').addEventListener('click', () => $('#developerDialog').close());

$('#catalogCount').textContent = `${ALL_APPS.length} apps catalogued`;
renderFeatured();
renderCategories();
renderShelves();
renderAllApps();
