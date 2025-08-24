
export function generateNonce(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSiweMessage(params: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  statement: string;
  nonce: string;
}): string {
  const { domain, address, uri, chainId, statement, nonce } = params;
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 60_000).toISOString();
  return (
    `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`
  );
}

// Server helpers (optional). If backend endpoints are present, prefer using them.
export async function fetchServerNonce(): Promise<string | undefined> {
  try {
    const resp = await fetch('/siwe/nonce', { method: 'GET', headers: { 'accept': 'application/json' } })
    if (!resp.ok) return undefined
    const json = (await resp.json()) as { nonce?: string }
    return typeof json?.nonce === 'string' && json.nonce.length > 0 ? json.nonce : undefined
  } catch {
    return undefined
  }
}

export async function verifySiweOnServer(payload: { address: string; message: string; signature: string }): Promise<boolean> {
  try {
    let resp = await fetch('/siwe/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })
    if (!resp.ok) {
      try {
        const data = await resp.json()
        if (data?.mfaRequired) {
          const totp = window.prompt('Enter MFA code')
          if (!totp) return false
          resp = await fetch('/siwe/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({ ...payload, totp }),
            credentials: 'include',
          })
        }
      } catch {}
    }
    if (resp.ok) {
      try { localStorage.setItem('mfa_verified', 'true') } catch {}
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function fetchMe(): Promise<{ ok: boolean; address?: string } | null> {
  try {
    const resp = await fetch('/me', { method: 'GET', headers: { 'accept': 'application/json' }, credentials: 'include' })
    if (!resp.ok) return { ok: false }
    const json = (await resp.json()) as { ok: boolean; address?: string }
    return json
  } catch {
    return null
  }
}

export async function serverLogout(): Promise<void> {
  try {
    await fetch('/siwe/logout', { method: 'POST', credentials: 'include' })
  } catch {}
  try { localStorage.removeItem('mfa_verified') } catch {}
}



