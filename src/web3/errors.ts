export type Eip1193LikeError = unknown & { code?: number; message?: string; data?: unknown; name?: string };

export type NormalizedError = {
  code?: number;
  name?: string;
  message: string;
  data?: unknown;
};

export function normalizeEip1193Error(err: Eip1193LikeError): NormalizedError {
  if (!err) return { message: 'Unknown error' };
  const anyErr = err as { code?: number; message?: string; data?: unknown; name?: string };
  const code = anyErr.code;
  const name = anyErr.name;
  const data = anyErr.data;
  const message = typeof anyErr.message === 'string' && anyErr.message.length > 0 ? anyErr.message : 'Unknown error';
  return { code, name, message, data };
}

export function friendlyMessageForError(err: NormalizedError): string {
  const code = err.code;
  switch (code) {
    case 4001: // user rejected
      return 'Request was cancelled by the user';
    case -32002: // request already pending
      return 'A wallet request is already pending. Please open your wallet.';
    case 4100: // unauthorized
      return 'Operation not authorized in the wallet.';
    case 4900: // disconnected
      return 'Wallet is disconnected from all networks.';
    case 4902: // unrecognized chain
      return 'Requested network is not available in the wallet.';
    default:
      return err.message || 'Wallet error occurred';
  }
}

export function isUserRejected(err: NormalizedError): boolean {
  return err.code === 4001;
}


