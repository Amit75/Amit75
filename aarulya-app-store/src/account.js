const STORE_ORIGIN = 'https://store.aarulya.com';

async function sessionStatus() {
  const response = await fetch('/auth/session', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
  if (!response.ok) return { signedIn: false };
  const data = await response.json();
  return data && typeof data === 'object' ? data : { signedIn: false };
}

function beginSignIn() {
  window.location.assign('/auth/start');
}

async function signOut() {
  const response = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
  if (!response.ok && response.status !== 204) throw new Error('secure-sign-out-failed');
}

export function bindAccountUi() {
  if (window.location.origin !== STORE_ORIGIN) return;

  const accountButton = document.querySelector('#accountButton');
  const accountDialog = document.querySelector('#accountDialog');
  const closeAccount = document.querySelector('#closeAccount');
  const accountState = document.querySelector('#accountState');
  const accountRoles = document.querySelector('#accountRoles');
  const accountSession = document.querySelector('#accountSession');
  const accountPrimary = document.querySelector('#accountPrimary');
  const developerButton = document.querySelector('#developerButton');
  const developerDialog = document.querySelector('#developerDialog');
  const closeDeveloper = document.querySelector('#closeDeveloper');
  const developerAccessState = document.querySelector('#developerAccessState');
  const developerAction = document.querySelector('#developerAction');

  let state = Object.freeze({ signedIn: false });

  function render() {
    const signedIn = state.signedIn === true;
    accountButton.textContent = signedIn ? 'Account' : 'Sign in';
    accountState.textContent = signedIn ? 'Verified session active' : 'Not signed in';
    accountRoles.textContent = signedIn && state.account?.roles?.length
      ? state.account.roles.join(', ')
      : 'No verified role';
    const expiresAt = Number(state.account?.expiresAt || 0);
    accountSession.textContent = signedIn && expiresAt
      ? `Session valid until ${new Date(expiresAt * 1000).toLocaleString()}`
      : 'Secure sign-in is required for account-bound Store actions.';
    accountPrimary.textContent = signedIn ? 'Sign out securely' : 'Sign in securely';

    const developer = signedIn && state.account?.developerAccess === true;
    developerAccessState.textContent = !signedIn
      ? 'Sign in to verify developer access.'
      : developer
        ? 'Developer identity verified. Publication remains gated by release evidence and owner controls.'
        : 'This account does not currently have a developer or publisher role.';
    developerAction.textContent = developer ? 'Developer console verified • submissions gated' : 'Developer access unavailable';
    developerAction.disabled = true;
  }

  async function refresh() {
    state = Object.freeze(await sessionStatus().catch(() => ({ signedIn: false })));
    render();
    return state;
  }

  accountButton.addEventListener('click', async () => {
    await refresh();
    accountDialog.showModal();
  });
  closeAccount.addEventListener('click', () => accountDialog.close());
  accountPrimary.addEventListener('click', async () => {
    if (!state.signedIn) return beginSignIn();
    accountPrimary.disabled = true;
    try {
      await signOut();
      state = Object.freeze({ signedIn: false });
      render();
      accountDialog.close();
    } finally {
      accountPrimary.disabled = false;
    }
  });
  developerButton.addEventListener('click', async () => {
    await refresh();
    developerDialog.showModal();
  });
  closeDeveloper.addEventListener('click', () => developerDialog.close());

  void refresh();
}
