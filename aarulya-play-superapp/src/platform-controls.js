import { getPublicMonetizationStatus, normalizeAudience } from './monetization-policy.js';

const STORAGE_KEY = 'aarulya-play-audience-mode-v1';
const buttons = [...document.querySelectorAll('[data-audience]')];
const summary = document.querySelector('#audienceSummary');
const provider = document.querySelector('#adProviderStatus');
const placement = document.querySelector('#adPlacementStatus');
const rewardType = document.querySelector('#rewardTypeStatus');
const referral = document.querySelector('#referralStatus');

const messages = Object.freeze({
  child: 'Child mode: contextual level-end ads only after a provider is approved; no cash prompts or open chat.',
  teen: 'Teen mode: contextual level-end and optional rewarded ads; rewards remain non-cash.',
  adult: 'Adult / Parent mode: broader non-disruptive placements, but cash referral remains disabled until a settled campaign pool exists.'
});

function render(mode) {
  const audience = normalizeAudience(mode);
  const status = getPublicMonetizationStatus(audience);
  localStorage.setItem(STORAGE_KEY, audience);

  buttons.forEach((button) => {
    const active = button.dataset.audience === audience;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (summary) summary.textContent = messages[audience];
  if (provider) provider.textContent = status.provider;
  if (placement) placement.textContent = status.placement;
  if (rewardType) rewardType.textContent = status.rewardType;
  if (referral) referral.textContent = status.cashReferral;
}

buttons.forEach((button) => button.addEventListener('click', () => render(button.dataset.audience)));
render(localStorage.getItem(STORAGE_KEY) || 'child');
