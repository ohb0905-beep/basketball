/** 시드 고정 난수 (밸런스 스크립트 공용): Math.random 대신 넣어 같은 시드면 같은 결과가 나오게 합니다. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** fn을 실행하는 동안만 Math.random을 rng로 바꾸고, 예외가 나도 원래대로 되돌립니다. */
export function withRandom<T>(rng: () => number, fn: () => T): T {
  const prev = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = prev;
  }
}
