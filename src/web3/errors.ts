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
      return 'Операция отменена пользователем';
    case -32002: // request already pending
      return 'Запрос к кошельку уже ожидает. Откройте кошелёк.';
    case 4100: // unauthorized
      return 'Операция не авторизована в кошельке.';
    case 4900: // disconnected
      return 'Кошелёк отключён от всех сетей.';
    case 4902: // unrecognized chain
      return 'Запрошенная сеть отсутствует в кошельке.';
    case -32602: // invalid params
      return 'Неверные параметры запроса к RPC.';
    case -32603: // internal error
      return 'Внутренняя ошибка RPC. Повторите попытку позже.';
    default:
      // Normalize common wallet provider wrappers
      if (typeof err.message === 'string') {
        if (/Already processing/.test(err.message)) return 'Запрос к кошельку уже ожидает. Откройте кошелёк.';
        if (/User rejected/i.test(err.message)) return 'Операция отменена пользователем';
      }
      return err.message || 'Произошла ошибка кошелька';
  }
}

export function isUserRejected(err: NormalizedError): boolean {
  return err.code === 4001;
}


