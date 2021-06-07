/* eslint-disable @typescript-eslint/no-empty-function */
import { waitFor } from '@testing-library/dom';
import { dataLoader } from '../../client/src/internals/dataLoader';

test('basic', async () => {
  const fetchManyCalled = jest.fn();
  const loader = dataLoader<number, number>(function fetchMany(keys) {
    fetchManyCalled();
    const promise = new Promise<number[]>((resolve) => {
      resolve(keys.map((v) => v + 1));
    });
    return { promise, cancel: () => {} };
  });
  {
    const $result = await Promise.all([
      loader.load(1).promise,
      loader.load(2).promise,
    ]);
    expect($result).toEqual([2, 3]);
  }
  {
    const $result = await Promise.all([
      loader.load(3).promise,
      loader.load(4).promise,
    ]);
    expect($result).toEqual([4, 5]);
  }
  expect(fetchManyCalled).toHaveBeenCalledTimes(2);
});

test('cancellation', async () => {
  const fetchManyCalled = jest.fn();
  const cancelCalled = jest.fn();
  const loader = dataLoader<number, number>(function fetchMany(keys) {
    fetchManyCalled();
    const promise = new Promise<number[]>((resolve) => {
      setTimeout(() => {
        resolve(keys.map((v) => v + 1));
      }, 10);
    });

    return { promise, cancel: cancelCalled };
  });

  {
    // immediate, before it's actually executed
    const res1 = loader.load(1);
    const res2 = loader.load(2);

    res1.cancel();
    res2.cancel();

    expect(cancelCalled).toHaveBeenCalledTimes(0);
  }
  {
    // after some time
    const res1 = loader.load(2);
    const res2 = loader.load(3);

    await new Promise((resolve) => setTimeout(resolve, 5));

    res1.cancel();
    res2.cancel();

    await waitFor(() => {
      expect(cancelCalled).toHaveBeenCalledTimes(1);
    });
  }
});

test('errors', async () => {
  const loader = dataLoader<number, number>(function fetchMany(keys) {
    const promise = new Promise<number[]>((_resolve, reject) => {
      reject(new Error('Some error'));
    });

    return { promise, cancel: () => {} };
  });

  const results = await Promise.allSettled([
    loader.load(1).promise,
    loader.load(2).promise,
  ]);

  expect(results).toMatchInlineSnapshot(`
    Array [
      Object {
        "reason": [Error: Some error],
        "status": "rejected",
      },
      Object {
        "reason": [Error: Some error],
        "status": "rejected",
      },
    ]
  `);
});
