import assert from 'node:assert/strict';
import test from 'node:test';
import { curlPoint } from '../src/lib/page-curl.ts';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('a turned sheet lands flat, unmirrored in geometry, on the opposite side', () => {
  for (const u of [0, .2, .5, 1]) for (const v of [0, .5, 1]) {
    const start = curlPoint(u, v, 0, 1.4), end = curlPoint(u, v, 1, 1.4);
    near(start.x, u); near(end.x, -u);
    near(start.y, v * 1.4); near(end.y, v * 1.4);
    near(start.z, 0); near(end.z, 0);
  }
});
test('the hinge stays fixed and paper never passes below the book', () => {
  for (let p = 0; p <= 1; p += .025) for (let v = 0; v <= 1; v += .1) {
    const hinge = curlPoint(0, v, p, 1.4);
    near(hinge.x, 0); near(hinge.z, 0);
    for (let u = 0; u <= 1; u += .025) {
      const point = curlPoint(u, v, p, 1.4);
      assert.ok(Object.values(point).every(Number.isFinite));
      assert.ok(point.z >= -1e-9);
    }
  }
});
test('mid-turn paper has a curved cross-section and a diagonal fold', () => {
  const a = curlPoint(.2, .5, .5, 1.4), b = curlPoint(.5, .5, .5, 1.4), c = curlPoint(.8, .5, .5, 1.4);
  assert.ok(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)) > .01);
  assert.notEqual(curlPoint(.5, 0, .5, 1.4).angle, curlPoint(.5, 1, .5, 1.4).angle);
});
