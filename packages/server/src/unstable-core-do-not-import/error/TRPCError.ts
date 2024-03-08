import type { TRPC_ERROR_CODE_KEY } from '../rpc/codes';
import { isObject } from '../utils';

class UnknownCauseError extends Error {
  [key: string]: unknown;
}
export function getCauseFromUnknown(cause: unknown): Error | undefined {
  if (cause instanceof Error) {
    return cause;
  }

  const type = typeof cause;
  if (type === 'undefined' || type === 'function' || cause === null) {
    return undefined;
  }

  // Primitive types just get wrapped in an error
  if (type !== 'object') {
    return new Error(String(cause));
  }

  // If it's an object, we'll create a synthetic error
  if (isObject(cause)) {
    const err = new UnknownCauseError();
    for (const key in cause) {
      err[key] = cause[key];
    }
    return err;
  }

  return undefined;
}

export function getTRPCErrorFromUnknown(cause: unknown): TRPCError {
  if (cause instanceof TRPCError) {
    return cause;
  }
  if (cause instanceof Error && cause.name === 'TRPCError') {
    // https://github.com/trpc/trpc/pull/4848
    return cause as TRPCError;
  }

  const trpcError = new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    cause,
  });

  // Inherit stack from error
  if (cause instanceof Error && cause.stack) {
    trpcError.stack = cause.stack;
  }

  return trpcError;
}

type TRPCErrorOptions = {
  message?: string;
  code: TRPC_ERROR_CODE_KEY;
  cause?: unknown;
};

export class TRPCError extends Error {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore override doesn't work in all environments due to "This member cannot have an 'override' modifier because it is not declared in the base class 'Error'"
  public override readonly cause?: Error;
  public readonly code;

  constructor(opts: TRPCErrorOptions) {
    const cause = getCauseFromUnknown(opts.cause);
    const message = opts.message ?? cause?.message ?? opts.code;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore https://github.com/tc39/proposal-error-cause
    super(message, { cause });

    this.code = opts.code;
    this.name = 'TRPCError';

    if (!this.cause) {
      // < ES2022 / < Node 16.9.0 compatability
      this.cause = cause;
    }
  }
}

export const errorSymbol = Symbol('errorSymbol');

export function trpcError<
  TData extends TRPCErrorOptions & Record<string, unknown>,
>(opts: TData) {
  const { code, cause, message, ...rest } = opts;

  const error = new TRPCError({
    code,
    cause,
    message,
  }) as TRPCError &
    TData & {
      [errorSymbol]: typeof errorSymbol;
    };

  for (const key in rest as Record<string, unknown>) {
    (error as any)[key] = opts[key];
  }

  return error;
}
