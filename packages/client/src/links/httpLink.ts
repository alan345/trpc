import { AnyRouter } from '@trpc/server';
import { observable } from '../rx/observable';
import { TRPCLink } from './core';
import { HTTPLinkOptions, httpRequest } from './httpUtils';

export function httpLink<TRouter extends AnyRouter>(
  opts: HTTPLinkOptions,
): TRPCLink<TRouter> {
  const { url } = opts;
  return (runtime) =>
    ({ op }) =>
      observable((observer) => {
        const { path, input, type } = op;
        const { promise, cancel } = httpRequest({
          runtime,
          path,
          input,
          type,
          url,
        });
        promise
          .then((res) =>
            observer.next({
              meta: res.meta,
              data: res.json as any,
            }),
          )
          .catch(observer.error)
          .finally(() => observer.complete());

        return () => {
          cancel();
        };
      });
}
