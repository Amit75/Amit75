const STORE_ORIGIN = 'https://store.aarulya.com';

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    ...options
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || 'store-account-request-failed'));
  return body;
}

const sessionStatus = () => requestJson('/auth/session');
const accountOverview = () => requestJson('/auth/account/overview');
const developerSubmissions = () => requestJson('/auth/developer/submissions');

function beginSignIn() {
  window.location.assign('/auth/start');
}

async function signOut() {
  await requestJson('/auth/logout', { method: 'POST' });
}

export function bindAccountUi() {
  if (window.location.origin !== STORE_ORIGIN) return;

  const q = (selector) => document.querySelector(selector);
  const accountButton = q('#accountButton');
  const accountDialog = q('#accountDialog');
  const closeAccount = q('#closeAccount');
  const accountState = q('#accountState');
  const accountRoles = q('#accountRoles');
  const accountSession = q('#accountSession');
  const accountDevices = q('#accountDevices');
  const accountInstalls = q('#accountInstalls');
  const accountSessionList = q('#accountSessionList');
  const accountPrivacyState = q('#accountPrivacyState');
  const accountExportButton = q('#accountExportButton');
  const accountDeletionButton = q('#accountDeletionButton');
  const accountDeletionCancel = q('#accountDeletionCancel');
  const accountPrimary = q('#accountPrimary');
  const developerButton = q('#developerButton');
  const developerDialog = q('#developerDialog');
  const closeDeveloper = q('#closeDeveloper');
  const developerAccessState = q('#developerAccessState');
  const developerForm = q('#developerForm');
  const developerAction = q('#developerAction');
  const developerSubmissionsRoot = q('#developerSubmissions');

  let state = Object.freeze({ signedIn: false });
  let overview = Object.freeze({ devices: [], sessions: [], installs: [], updates: [], privacyRequests: [] });

  function renderSessionRows() {
    accountSessionList.replaceChildren();
    if (!state.signedIn) return;
    for (const session of overview.sessions || []) {
      const row = document.createElement('div');
      row.className = 'account-row';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = session.current ? 'Current session' : 'Other session';
      const meta = document.createElement('small');
      meta.textContent =
        (session.deviceId || 'Unlinked device') + ' • ' +
        (session.revoked ? 'revoked' : 'active') + ' • expires ' +
        new Date(session.expiresAt).toLocaleString();
      info.append(title, document.createElement('br'), meta);
      row.append(info);

      if (!session.current && !session.revoked) {
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = 'Sign out';
        revoke.addEventListener('click', async () => {
          revoke.disabled = true;
          try {
            await requestJson('/auth/account/sessions/' + encodeURIComponent(session.sessionId) + '/revoke', {
              method: 'POST'
            });
            await loadOverview();
          } finally {
            revoke.disabled = false;
          }
        });
        row.append(revoke);
      }
      accountSessionList.append(row);
    }
  }

  function render() {
    const signedIn = state.signedIn === true;
    accountButton.textContent = signedIn ? 'Account' : 'Sign in';
    accountState.textContent = signedIn ? 'Verified session active' : 'Not signed in';
    accountRoles.textContent =
      signedIn && state.account?.roles?.length ? state.account.roles.join(', ') : 'No verified role';

    const expiresAt = Number(state.account?.expiresAt || 0);
    accountSession.textContent =
      signedIn && expiresAt ? 'Valid until ' + new Date(expiresAt * 1000).toLocaleString() : 'Secure sign-in is required.';
    accountDevices.textContent = signedIn ? String(overview.devices?.length || 0) + ' known device(s)' : 'Sign in to load';
    accountInstalls.textContent = signedIn ? String(overview.installs?.length || 0) + ' recent install receipt(s)' : 'Sign in to load';
    accountPrimary.textContent = signedIn ? 'Sign out securely' : 'Sign in securely';
    const activeDeletion = (overview.privacyRequests || []).find(
      (request) => request.type === 'deletion' && request.state === 'requested'
    );
    accountPrivacyState.textContent = !signedIn
      ? 'Sign in to use privacy controls.'
      : activeDeletion
        ? 'Account deletion requested on ' + new Date(activeDeletion.requestedAt).toLocaleString() + '.'
        : 'No active deletion request.';
    accountExportButton.disabled = !signedIn;
    accountDeletionButton.hidden = !signedIn || Boolean(activeDeletion);
    accountDeletionCancel.hidden = !signedIn || !activeDeletion;
    renderSessionRows();

    const developer = signedIn && state.account?.developerAccess === true;
    developerAccessState.textContent = !signedIn
      ? 'Sign in to verify developer access.'
      : developer
        ? 'Developer identity verified. Drafts can be submitted for gated review.'
        : 'This account does not have a developer, publisher or owner role.';
    developerForm.hidden = !developer;
  }

  async function refresh() {
    state = Object.freeze(await sessionStatus().catch(() => ({ signedIn: false })));
    if (!state.signedIn) overview = Object.freeze({ devices: [], sessions: [], installs: [], updates: [], privacyRequests: [] });
    render();
    return state;
  }

  async function loadOverview() {
    overview = Object.freeze(
      await accountOverview().catch(() => ({ devices: [], sessions: [], installs: [], updates: [], privacyRequests: [] }))
    );
    render();
  }

  function renderDeveloperSubmissions(submissions) {
    developerSubmissionsRoot.replaceChildren();
    for (const submission of submissions) {
      const row = document.createElement('div');
      row.className = 'account-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = submission.appName;
      const meta = document.createElement('small');
      meta.textContent = submission.packageId + ' • ' + submission.state;
      info.append(title, document.createElement('br'), meta);
      row.append(info);

      if (submission.state === 'draft') {
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.textContent = 'Submit for review';
        submit.addEventListener('click', async () => {
          submit.disabled = true;
          try {
            await requestJson('/auth/developer/submissions/' + submission.id + '/submit', { method: 'POST' });
            await loadDeveloperSubmissions();
          } finally {
            submit.disabled = false;
          }
        });
        row.append(submit);
      }
      developerSubmissionsRoot.append(row);
    }
  }

  async function loadDeveloperSubmissions() {
    if (!(state.signedIn && state.account?.developerAccess)) {
      renderDeveloperSubmissions([]);
      return;
    }
    const result = await developerSubmissions().catch(() => ({ submissions: [] }));
    renderDeveloperSubmissions(result.submissions || []);
  }

  accountButton.addEventListener('click', async () => {
    await refresh();
    if (state.signedIn) await loadOverview();
    accountDialog.showModal();
  });

  closeAccount.addEventListener('click', () => accountDialog.close());

  accountPrimary.addEventListener('click', async () => {
    if (!state.signedIn) return beginSignIn();
    accountPrimary.disabled = true;
    try {
      await signOut();
      state = Object.freeze({ signedIn: false });
      overview = Object.freeze({ devices: [], sessions: [], installs: [], updates: [], privacyRequests: [] });
      render();
      accountDialog.close();
    } finally {
      accountPrimary.disabled = false;
    }
  });

  accountExportButton.addEventListener('click', async () => {
    accountExportButton.disabled = true;
    try {
      const data = await requestJson('/auth/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'aarulya-store-account-export.json';
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } finally {
      accountExportButton.disabled = false;
    }
  });

  accountDeletionButton.addEventListener('click', async () => {
    if (!window.confirm('This creates a deletion request. It does not silently delete the account immediately. Continue?')) return;
    accountDeletionButton.disabled = true;
    try {
      await requestJson('/auth/account/deletion/request', { method: 'POST' });
      await loadOverview();
    } catch (error) {
      accountPrivacyState.textContent = error.message === 'step-up-authentication-required'
        ? 'A fresh MFA/passkey step-up is required before requesting deletion.'
        : 'Deletion request could not be created.';
    } finally {
      accountDeletionButton.disabled = false;
    }
  });

  accountDeletionCancel.addEventListener('click', async () => {
    accountDeletionCancel.disabled = true;
    try {
      await requestJson('/auth/account/deletion/cancel', { method: 'POST' });
      await loadOverview();
    } catch (error) {
      accountPrivacyState.textContent = error.message === 'step-up-authentication-required'
        ? 'A fresh MFA/passkey step-up is required before cancelling this request.'
        : 'Deletion request could not be cancelled.';
    } finally {
      accountDeletionCancel.disabled = false;
    }
  });

  developerButton.addEventListener('click', async () => {
    await refresh();
    await loadDeveloperSubmissions();
    developerDialog.showModal();
  });

  closeDeveloper.addEventListener('click', () => developerDialog.close());

  developerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    developerAction.disabled = true;
    try {
      await requestJson('/auth/developer/submissions', {
        method: 'POST',
        body: JSON.stringify({
          appName: q('#developerAppName').value,
          packageId: q('#developerPackageId').value,
          category: q('#developerCategory').value,
          privacyPolicyUrl: q('#developerPrivacyUrl').value,
          ownershipEvidenceUrl: q('#developerOwnershipUrl').value
        })
      });
      developerForm.reset();
      await loadDeveloperSubmissions();
    } finally {
      developerAction.disabled = false;
    }
  });

  void refresh();
}
