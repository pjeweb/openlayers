# Canvas dashed-line clipping benchmark

Run from the repository root after installing dependencies and Playwright Chromium:

```sh
node test/performance/canvas-dashed-lines.js
```

To compare with the unchanged upstream base using the same dependencies:

```sh
baseline=$(mktemp -d)
git archive d4851af298 src package.json | tar -x -C "$baseline"
ln -s "$PWD/node_modules" "$baseline/node_modules"
node test/performance/canvas-dashed-lines.js --root "$baseline"
```

The script also accepts `--firefox` (requires `npx playwright install firefox`).

## Method and measured results

Measured on 2026-10-30 (Europe/Berlin), Linux x86_64, Ryzen 5 3600XT,
Node 24.18.0, headless Chromium 151.0.7922.34. Baseline is upstream/main
`d4851af298`; clipped is the implementation accompanying this file.
The complete one-line and 25-line results are in
[canvas-dashed-lines-results.json](canvas-dashed-lines-results.json).

An 800x600 Canvas VectorLayer, pixel ratio 1, contains 1 or 25 two-point
LineStrings, each 262144 map units long. All 25 lines intersect the viewport at
all resolutions. Strokes are 3 pixels wide with round caps and either solid or
[5, 5] dashes. There are no tiles or external data. Each case measures 12 small
pans, discards 3 warmups, and reports the median and maximum of the remaining 9
samples. Timing covers `renderSync()` and a one-pixel readback to flush deferred
Canvas work. Warmup excludes initial construction and first geometry processing;
the view is marked interacting during the small pans to exercise cached
instructions with changing transforms. The center is reset before each resolution.

25-line measurements below are milliseconds (median / maximum). Transitions
count changes between transparent and nontransparent pixels along the center
line of the last frame, outside the timed region.

| Stroke | Resolution | Upstream ms | Clipped ms | Transitions upstream / clipped |
| --- | ---: | ---: | ---: | ---: |
| Solid | 256 | 0.2 / 3.5 | 0.1 / 1.2 | 0 / 0 |
| Solid | 16 | 0.1 / 0.2 | 0.1 / 0.1 | 0 / 0 |
| Solid | 1 | 0.1 / 0.4 | 0.1 / 0.2 | 0 / 0 |
| Solid | 0.25 | 0.1 / 0.2 | 0.1 / 0.2 | 0 / 0 |
| Dashed | 256 | 2.5 / 2.7 | 2.0 / 3.2 | 160 / 160 |
| Dashed | 16 | 28.2 / 34.5 | 2.1 / 2.2 | 160 / 160 |
| Dashed | 1 | 449.2 / 458.1 | 2.0 / 2.1 | 160 / 160 |
| Dashed | 0.25 | 49.8 / 55.9 | 2.1 / 2.5 | 0 / 160 |

This is a single local run, not a portable speed guarantee. Solid timings and
some one-line timings approach the browser timer's 0.1 ms granularity. Chromium
already handles a single long line efficiently in this case; the conspicuous
slowdown occurs with multiple paths. At resolution 0.25 the baseline's zero
transitions indicate a browser fallback to solid strokes, so its faster timing
than resolution 1 is **not** equivalent dashed output. Clipping retains 160
transitions at every measured resolution. No Firefox timings are claimed:
Firefox 153.0 launched here but local-server navigation failed with
`NS_ERROR_NET_EMPTY_RESPONSE`, including after disabling its proxy settings.

These measurements do not cover interactive frame scheduling, other browsers,
million-vertex inputs, or initial/rebuilt instruction costs. They include a
readback and should not be described as animation FPS.

## Design and regression coverage

Dashed LineString and MultiLineString instructions retain all vertices of the
simplified geometry, including offscreen bends. After transformation (and any
stroke offset), an allocation-free Liang-Barsky pass clips to the current render
canvas plus a conservative stroke/miter margin. Each disconnected fragment gets
an offscreen lead-in shorter than one full dash period. The omitted prefix is
therefore an integer number of periods, preserving the native dash offset,
including odd patterns, without splitting a translucent stroke into separate
compositing operations. Visible joins and original caps stay intact. Phase resets
for each MultiLineString part, just as with native Canvas subpaths.

This costs O(n) segment processing per replay and retains more offscreen vertices
for dashed lines than the previous extent-based vertex skipping. Native dashing
is bounded by visible segments plus at most one period per entry, rather than
full offscreen segment lengths. Very large periods can still produce long
lead-ins, but do not contain the millions of repeated dashes that caused this
issue. There are no geometry conversions or new dependencies. The solid path
and solid hit-detection instructions do not opt into clipping. No public style
or layer option changes. Polygon, circle, and Immediate renderer strokes are
outside this change's scope.

Browser regressions compare against the same full path with clipping disabled,
covering offscreen re-entry, multipart phase reset, all caps/joins, translucent
overlap, odd and zero patterns, positive/negative dash offsets, stroke offsets,
rotation, scaling, HiDPI, wide strokes at the canvas edge, and deferred contexts.
Map tests cover solid hit detection across dash gaps with renderBuffer 0 and 100,
including replay reuse during a buffered pan. The rendering case
`linestring-style-dash-clipping` uses a reference generated with clipping
disabled while retaining the full path, so the expected image comes from native
unclipped dashing.
