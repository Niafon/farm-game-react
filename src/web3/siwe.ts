import type { JsonRpcSigner } from 'ethers';

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

export async function signSiweMessage(signer: JsonRpcSigner, message: string): Promise<string> {
  return signer.signMessage(message);
}



