"""Generate the hand-drawn SVG graphics in docs/images.

    python scripts/gen-docs-graphics.py

Needs the built package (pnpm build): the hero image shows real output from
js/index.cjs, not text typed by hand, and the charts read benches/results.
Standard library only. Strokes get a seeded jitter, drawn twice like a pencil
going over a line, so the output is identical on every run.
"""

import json
import math
import pathlib
import random
import statistics
import subprocess
from html import escape

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "images"
RESULTS = ROOT / "benches" / "results"
# The three pinned runs that measured every operation against every baseline.
# docs/performance.md quotes the same runs, so the charts and tables agree.
RUN_NOTE = "runs 2026-10-24 16:11, 16:16, 16:21 UTC  ·  i7-12700K, Node 24.22, Windows 11"
RUNS = ["2026-10-24T16-11-41-552Z", "2026-10-24T16-16-26-099Z", "2026-10-24T16-21-13-048Z"]

# Fonts inside an <img> SVG cannot be downloaded, so these are stacks of fonts
# that ship with Windows, macOS and Linux, falling back to the generic family.
HAND = "'Segoe Print', 'Bradley Hand', 'Chalkboard SE', 'Comic Neue', 'Comic Sans MS', cursive"
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

# Each image is drawn twice. GitHub picks one through <picture> and
# prefers-color-scheme; a media query inside the SVG would follow the OS theme
# instead of GitHub's. Series colors were checked with the dataviz palette
# validator on PAPER: light CVD delta E 18.7, dark 20.4, both 3:1+. PAPER is
# GitHub's page color, so the image edge disappears; sheets and boxes keep the
# paper tone.
THEMES = {
    "light": dict(
        PAPER="#ffffff", SHEET="#faf9f5", OAT="#f0eee6", INK="#141413", INK2="#5e5d59",
        MUTED="#87867f", CLAY="#c4623f", SKY="#4f86c0", OLIVE="#6b7f4f",
    ),
    "dark": dict(
        PAPER="#0d1117", SHEET="#1c1c1b", OAT="#2a2a28", INK="#f0eee6", INK2="#c2c0b6",
        MUTED="#8f8d85", CLAY="#d97149", SKY="#5794d8", OLIVE="#97ab74",
    ),
}
globals().update(THEMES["light"])

FIXTURES = [
    ("typescript-package", "package.json", "1.8 KB"),
    ("upstream-test", "small mixed document", "4 KB"),
    ("typescript-package-lock", "npm package-lock", "144 KB"),
    ("jsonplaceholder-data", "JSONPlaceholder data", "1.4 MB"),
    ("synthetic-floats", "200k random doubles", "4 MB"),
    ("synthetic-already-sorted", "records, already sorted", "6 MB"),
    ("synthetic-records-8mb", "records, indented, Unicode", "8 MB"),
]


class Sketch:
    def __init__(self, width, height, title, seed):
        self.w, self.h, self.title = width, height, title
        self.rng = random.Random(seed)
        self.strokes = []  # pencil-filtered layer
        self.texts = []  # crisp layer on top
        self.defs = []
        self.ids = 0

    def j(self, amount):
        return self.rng.uniform(-amount, amount)

    # ------------------------------------------------------------ strokes

    def line(self, x1, y1, x2, y2, color=None, width=1.5, rough=1.0, passes=2, dash=None, opacity=1):
        color = color or INK  # read per call, since main() swaps the theme globals
        length = max(math.hypot(x2 - x1, y2 - y1), 1)
        nx, ny = -(y2 - y1) / length, (x2 - x1) / length
        for p in range(passes):
            bow = self.j(min(0.6 + length * 0.008, 2.6) * rough)
            mx = (x1 + x2) / 2 + nx * bow + self.j(rough * 0.4)
            my = (y1 + y2) / 2 + ny * bow + self.j(rough * 0.4)
            d = (
                f"M{x1 + self.j(rough):.1f},{y1 + self.j(rough):.1f} "
                f"Q{mx:.1f},{my:.1f} {x2 + self.j(rough):.1f},{y2 + self.j(rough):.1f}"
            )
            extra = f' stroke-dasharray="{dash}"' if dash else ""
            w = width if p == 0 else width * 0.55
            self.strokes.append(
                f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w:.2f}" '
                f'stroke-linecap="round" opacity="{opacity * (1 if p == 0 else 0.7):.2f}"{extra}/>'
            )

    def poly(self, points, color=None, width=1.5, rough=1.0, closed=True):
        color = color or INK
        pts = points + ([points[0]] if closed else [])
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            # Overshoot the corners a little, the way a quick hand does.
            dx, dy = x2 - x1, y2 - y1
            length = max(math.hypot(dx, dy), 1)
            o = self.rng.uniform(0.5, 3) / length
            self.line(x1 - dx * o, y1 - dy * o, x2 + dx * o, y2 + dy * o, color, width, rough)

    def fill(self, points, color, opacity=1):
        d = "M" + " L".join(f"{x + self.j(1.2):.1f},{y + self.j(1.2):.1f}" for x, y in points) + " z"
        self.strokes.append(f'<path d="{d}" fill="{color}" opacity="{opacity}"/>')

    def hachure(self, points, color, gap=6, width=1.0, opacity=0.8):
        """Diagonal pencil hatching clipped to a polygon."""
        self.ids += 1
        cid = f"h{self.ids}"
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points) + " z"
        self.defs.append(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        h = y1 - y0
        start = len(self.strokes)
        x = x0 - h
        while x < x1:
            self.line(x, y1 + 2, x + h + 4, y0 - 2, color, width, rough=0.7, passes=1, opacity=opacity)
            x += gap + self.j(0.8)
        group = self.strokes[start:]
        del self.strokes[start:]
        self.strokes.append(f'<g clip-path="url(#{cid})">' + "".join(group) + "</g>")

    def rect(self, x, y, w, h, color=None, width=1.5, fill=None, hatch=None, rough=1.0):
        color = color or INK
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        if fill:
            self.fill(pts, fill)
        if hatch:
            self.hachure(pts, hatch)
        self.poly(pts, color, width, rough)

    def sheet(self, x, y, w, h, fold=16):
        """A sheet of paper with a folded corner."""
        pts = [(x, y), (x + w - fold, y), (x + w, y + fold), (x + w, y + h), (x, y + h)]
        self.fill([(x + 4, y + 5), (x + w + 4, y + fold + 5), (x + w + 4, y + h + 5), (x + 4, y + h + 5)], OAT)
        self.fill(pts, SHEET)
        self.poly(pts, INK, 1.4)
        self.poly([(x + w - fold, y), (x + w - fold, y + fold), (x + w, y + fold)], INK, 1.1, closed=False)

    def ellipse(self, cx, cy, rx, ry, color=None, width=1.5):
        color = color or INK
        start = self.rng.uniform(0, math.tau)
        n = 18
        pts = []
        for i in range(n + 3):  # past a full turn, so the ends overlap
            a = start + i * math.tau / n
            k = 1 + self.j(0.05)
            pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
        self.strokes.append(
            f'<path d="{catmull_rom(pts)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
        )

    def arrow(self, x1, y1, x2, y2, color=None, width=1.6, bend=0.15, head=11):
        color = color or INK
        dx, dy = x2 - x1, y2 - y1
        cx = (x1 + x2) / 2 - dy * bend + self.j(2)
        cy = (y1 + y2) / 2 + dx * bend + self.j(2)
        for p in range(2):
            d = (
                f"M{x1 + self.j(1):.1f},{y1 + self.j(1):.1f} "
                f"Q{cx + self.j(1.5):.1f},{cy + self.j(1.5):.1f} {x2:.1f},{y2:.1f}"
            )
            w = width if p == 0 else width * 0.5
            self.strokes.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')
        angle = math.atan2(y2 - cy, x2 - cx)
        for side in (-1, 1):
            a = angle + math.pi - side * math.radians(26 + self.j(4))
            self.line(x2, y2, x2 + head * math.cos(a), y2 + head * math.sin(a), color, width, rough=0.4, passes=1)

    def check(self, x, y, color=None, size=14):
        color = color or OLIVE
        self.line(x, y, x + size * 0.35, y + size * 0.4, color, 2.4, 0.5, 1)
        self.line(x + size * 0.35, y + size * 0.4, x + size, y - size * 0.5, color, 2.4, 0.5, 1)

    def squiggle(self, x, y, w, color=None, width=1.6):
        color = color or CLAY
        d = f"M{x:.1f},{y:.1f}"
        step = 8
        for i in range(int(w // step)):
            d += f" q{step / 2:.1f},{(-3 if i % 2 else 3) + self.j(0.8):.1f} {step:.1f},0"
        self.strokes.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>')

    # ------------------------------------------------------------ text

    def text(self, x, y, s, size=14, fill=None, family=SANS, anchor="start", weight="normal", rotate=0):
        fill = fill or INK
        rot = f' transform="rotate({rotate} {x} {y})"' if rotate else ""
        self.texts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" xml:space="preserve"{rot}>{escape(s)}</text>'
        )

    def hand(self, x, y, s, size=15, fill=None, anchor="start", rotate=0):
        fill = fill or INK2
        self.text(x, y, s, size, fill, HAND, anchor, rotate=rotate)

    def mono(self, x, y, s, size=12.5, fill=None, anchor="start"):
        fill = fill or INK
        self.text(x, y, s, size, fill, MONO, anchor)

    def tooltip(self, s):
        """Wrap the last stroke in a <title> so hovering the open SVG shows the value."""
        self.strokes[-1] = f"<g><title>{escape(s)}</title>{self.strokes[-1]}</g>"

    def render(self):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{escape(self.title)}">\n'
            f"<title>{escape(self.title)}</title>\n"
            "<defs>\n"
            # A little displacement turns clean vector strokes into graphite.
            '<filter id="pencil" x="-2%" y="-2%" width="104%" height="104%">'
            '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>'
            '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter>\n'
            + "\n".join(self.defs)
            + "\n</defs>\n"
            f'<rect width="{self.w}" height="{self.h}" rx="14" fill="{PAPER}"/>\n'
            '<g filter="url(#pencil)">\n' + "\n".join(self.strokes) + "\n</g>\n"
            + "\n".join(self.texts)
            + "\n</svg>\n"
        )


def catmull_rom(pts):
    d = f"M{pts[1][0]:.1f},{pts[1][1]:.1f}"
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d


def mix(a, b, t):
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(pa, pb))


# ---------------------------------------------------------------- hero

A_JSON = '{\n  "total": 1.50,\n  "id": 4012,\n  "name": "caf\\u00e9",\n  "items": [{ "sku": "A-1",\n              "qty": 2e0 }]\n}\n'
B_JSON = '{"name":"café",\n "items":[{"qty":2,"sku":"A-1"}],\n "total":1.5,"id":4012}\n'


def live_output():
    script = (
        "const j=require('./js/index.cjs');const [a,b]=JSON.parse(process.argv[1]);"
        "console.log(JSON.stringify({c:j.canonicalize(a),ha:j.canonicalHash(a),hb:j.canonicalHash(b),"
        "eq:j.equal(a,b),version:require('./package.json').version}))"
    )
    out = subprocess.run(
        ["node", "-e", script, json.dumps([A_JSON, B_JSON])],
        cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8",
    )
    return json.loads(out.stdout)


def hero():
    live = live_output()
    assert live["eq"] and live["ha"] == live["hb"]
    s = Sketch(960, 420, "Two differently written JSON files become the same canonical bytes and the same hash", 11)

    s.text(40, 52, "json-canonical", 26, INK, SERIF)
    s.hand(236, 52, f"v{live['version']}", 15, MUTED)
    s.squiggle(40, 64, 180, CLAY)

    # Two sheets of paper that look different.
    s.sheet(40, 96, 250, 150)
    s.hand(52, 90, "a.json", 15, INK)
    for i, line in enumerate(A_JSON.splitlines()):
        s.mono(56, 122 + i * 17, line, 12)
    s.sheet(70, 286, 250, 84)
    s.hand(82, 280, "b.json", 15, INK)
    for i, line in enumerate(B_JSON.splitlines()):
        s.mono(84, 312 + i * 17, line, 12)

    s.hand(40, 404, "different spellings, same value", 14, CLAY, rotate=-1.5)
    s.arrow(36, 392, 58, 372, CLAY, 1.4, bend=-0.3, head=9)

    # The command, and the one canonical form both files reduce to.
    s.arrow(330, 190, 420, 172, INK, 1.8, bend=-0.12)
    s.arrow(336, 318, 420, 196, INK, 1.8, bend=0.12)
    s.mono(436, 140, "$ jcanon canonicalize", 13, INK2)
    s.rect(430, 152, 500, 40, INK, 1.5, fill=SHEET)
    s.mono(442, 177, live["c"], 12, SKY)

    s.arrow(680, 196, 680, 238, INK, 1.6, bend=0.05, head=9)
    s.hand(692, 224, "sha256", 14, INK2)
    s.rect(430, 244, 500, 66, INK, 1.5, fill=SHEET)
    s.mono(442, 268, live["ha"], 11.5, OLIVE)
    s.mono(442, 292, live["hb"], 11.5, OLIVE)
    s.hand(560, 334, "both files, same hash", 15, OLIVE)
    s.check(536, 326)

    s.mono(436, 376, "$ jcanon equal a.json b.json && echo same", 12.5, INK2)
    s.mono(436, 398, "same", 12.5, OLIVE)
    s.ellipse(452, 394, 24, 13, OLIVE, 1.3)
    return s.render()


# ---------------------------------------------------------------- pipeline


def pipeline():
    s = Sketch(960, 430, "Data flow: input, TypeScript wrapper, Rust single-pass parser, output", 23)
    s.text(36, 48, "One call, one pass over the bytes", 22, INK, SERIF)
    s.hand(36, 76, "no JavaScript objects get built: the parser writes output while it validates", 14)

    top, h = 116, 270
    # input
    s.rect(36, top, 134, h, fill=SHEET)
    s.hand(50, top - 8, "you pass in", 15, INK)
    for i, t in enumerate(["string", "Buffer", "Uint8Array"]):
        s.mono(50, top + 36 + i * 24, t, 13.5)
    s.hand(50, top + 140, "UTF-8 bytes,", 13, MUTED)
    s.hand(50, top + 160, "or a JS string", 13, MUTED)

    # wrapper
    s.rect(220, top, 190, h, fill=SHEET)
    s.hand(234, top - 8, "js/index.ts", 15, INK)
    s.text(236, top + 34, "checks arguments", 13.5)
    s.text(236, top + 54, "and options", 13.5)
    s.text(236, top + 96, "strings of 1 KiB and up:", 13, INK2)
    s.mono(236, top + 116, "encodeInto()", 12.5, SKY)
    s.text(236, top + 136, "into a reused buffer", 13, INK2)
    s.text(236, top + 178, "native errors become", 13, INK2)
    s.mono(236, top + 198, "JsonError", 12.5, CLAY)
    s.arrow(174, top + h / 2, 214, top + h / 2)

    # core
    s.rect(470, top, 300, h, CLAY, 2, fill=SHEET)
    s.hand(484, top - 8, "crates/core  (Rust, no dependencies)", 15, CLAY)
    s.text(486, top + 32, "recursive descent parser over UTF-8", 13.5)
    s.hand(486, top + 56, "the mode decides what each token does:", 13, INK2)
    modes = [
        ("validate", "writes nothing"),
        ("minify", "copies tokens"),
        ("sortKeys", "copies, sorts members"),
        ("canonicalize", "re-encodes strings, numbers"),
        ("select", "follows the pointer path"),
    ]
    for i, (m, d) in enumerate(modes):
        y = top + 86 + i * 25
        s.mono(488, y, m, 12.5, CLAY)
        s.text(600, y, d, 13, INK2)
    s.hand(486, top + 228, "unsorted objects leave a patch;", 13, MUTED)
    s.hand(486, top + 248, "one final copy applies them all", 13, MUTED)
    s.arrow(414, top + h / 2, 464, top + h / 2)
    s.hand(440, top + h / 2 - 14, "Node-API", 11, MUTED, anchor="middle")

    # output
    s.rect(836, top, 106, h, fill=SHEET)
    s.hand(850, top - 8, "you get", 15, INK)
    for i, t in enumerate(["string", "Buffer", "boolean", "undefined"]):
        s.mono(850, top + 36 + i * 24, t, 13)
    s.hand(850, top + 160, "Buffers of", 12, MUTED)
    s.hand(850, top + 178, "64 KiB+ wrap", 12, MUTED)
    s.hand(850, top + 196, "Rust memory", 12, MUTED)
    s.hand(850, top + 214, "(no copy)", 12, MUTED)
    s.arrow(774, top + h / 2, 830, top + h / 2)
    return s.render()


# ---------------------------------------------------------------- numbers


def numbers():
    s = Sketch(960, 384, "Number formatting paths in canonicalize", 37)
    s.text(36, 48, "How canonicalize prints a number", 22, INK, SERIF)
    s.hand(36, 76, "always what JavaScript's String(Number) prints; sortKeys and minify never touch numbers", 14)

    s.sheet(36, 150, 170, 80)
    s.hand(48, 144, "the token", 15, INK)
    s.mono(52, 182, "1.50", 14)
    s.mono(52, 208, "113017829008754.13", 11.5)

    # decision diamond
    cx, cy = 340, 190
    s.fill([(cx, cy - 70), (cx + 110, cy), (cx, cy + 70), (cx - 110, cy)], SHEET)
    s.poly([(cx, cy - 70), (cx + 110, cy), (cx, cy + 70), (cx - 110, cy)], INK, 1.6)
    s.text(cx, cy - 4, "15 significant", 13.5, INK, anchor="middle")
    s.text(cx, cy + 15, "digits or fewer?", 13.5, INK, anchor="middle")
    s.arrow(210, 190, 226, 190)

    s.rect(520, 104, 240, 76, OLIVE, 1.8, fill=SHEET)
    s.hand(532, 98, "yes: re-spell the digits", 15, OLIVE)
    s.text(534, 132, "no float parse at all", 13.5, INK2)
    s.mono(534, 160, "1.50  ->  1.5", 13)
    s.arrow(430, 160, 514, 142, OLIVE, bend=-0.1)

    s.rect(520, 220, 240, 96, SKY, 1.8, fill=SHEET)
    s.hand(532, 214, "no: parse, then Ryu", 15, SKY)
    s.text(534, 246, "nearest double, then the", 13.5, INK2)
    s.text(534, 266, "shortest digits that round-trip", 13.5, INK2)
    s.text(534, 290, "(ported d2d, ECMA-262 ties)", 13, MUTED)
    s.arrow(430, 220, 514, 254, SKY, bend=0.1)

    s.sheet(796, 150, 152, 80)
    s.hand(808, 144, "output", 15, INK)
    s.mono(810, 182, "1.5", 14)
    s.mono(810, 208, "113017829008754.12", 11.5)
    s.arrow(764, 140, 792, 166, OLIVE, bend=0.1)
    s.arrow(764, 262, 792, 214, SKY, bend=-0.1)

    s.hand(36, 370, "15 digits is enough: distinct decimals of that length are distinct doubles.", 13, MUTED)
    s.hand(36, 350, "strictNumbers: true throws ERR_JSON_PRECISION if the printed value would change.", 13, MUTED)
    return s.render()


# ---------------------------------------------------------------- benchmark data


def load_runs():
    runs = []
    for name in RUNS:
        data = json.loads((RESULTS / f"{name}.json").read_text(encoding="utf-8"))
        runs.append({(c["fixture"], c["op"], c["impl"]): c["median"] for c in data["results"]})
    return runs


def ratio_stats(runs, fixture, op, native, baseline):
    """Median and range over the runs of native ops/s divided by baseline ops/s.

    baseline is an implementation name, or None for the fastest JS baseline in
    that run (the rule docs/performance.md uses for "vs best JS")."""
    ratios = []
    for r in runs:
        if baseline is None:
            base = max(v for (f, o, i), v in r.items() if f == fixture and o == op and i.startswith("JS"))
        else:
            base = r[(fixture, op, baseline)]
        ratios.append(r[(fixture, op, native)] / base)
    return statistics.median(ratios), min(ratios), max(ratios)


# ---------------------------------------------------------------- speedup bars


def speedup(runs):
    series = [
        ("JSON.parse + canonical-json", "JS JSON.parse+canonical-json", SKY),
        ("JSON.parse + json-stable-stringify", "JS JSON.parse+json-stable-stringify", CLAY),
    ]
    left, right, top = 250, 900, 150
    bar, gap, group = 15, 4, 56
    h = top + group * len(FIXTURES) + 70
    s = Sketch(960, h, "canonicalize speedup over JSON.parse plus canonical-json and plus json-stable-stringify", 53)
    xmax = 4.5

    def sx(v):
        return left + (right - left) * v / xmax

    s.text(36, 48, "canonicalize(text), times faster than the JavaScript route", 22, INK, SERIF)
    s.hand(36, 76, "string in, string out, identical bytes. median of 3 pinned runs; the thin line is the range", 14)
    s.hand(36, 98, RUN_NOTE, 13, MUTED)
    lx = left
    for label, _, color in series:
        s.rect(lx, 112, 16, 14, color, 1.2, fill=mix(PAPER, color, 0.35), hatch=color)
        s.text(lx + 24, 124, "vs " + label, 13, INK2)
        lx += 300

    base = h - 52
    s.line(left, top - 12, left, base, INK, 1.6)
    s.line(left, base, right + 10, base, INK, 1.6)
    for t in range(0, 5):
        x = sx(t)
        s.line(x, base - 2, x, base + 6, INK, 1.2, passes=1)
        s.text(x, base + 24, f"{t}x", 13, INK2, anchor="middle")
    s.line(sx(1), top - 12, sx(1), base, MUTED, 1.4, dash="5 5")
    s.hand(sx(1) + 8, base - 8, "same speed", 13, MUTED)

    for gi, (fx, label, size) in enumerate(FIXTURES):
        gy = top + gi * group
        s.text(left - 16, gy + 15, label, 13.5, INK, anchor="end")
        s.text(left - 16, gy + 33, size, 12, MUTED, anchor="end")
        for si, (name, impl, color) in enumerate(series):
            med, lo, hi = ratio_stats(runs, fx, "canonicalize", "native string", impl)
            y = gy + si * (bar + gap)
            s.rect(left, y, sx(med) - left, bar, color, 1.4, fill=mix(PAPER, color, 0.3), hatch=color, rough=0.7)
            s.tooltip(f"{label}, vs {name}: {med:.2f}x (runs {lo:.2f}-{hi:.2f})")
            s.line(sx(lo), y + bar / 2, sx(hi), y + bar / 2, INK, 1.4, rough=0.3, passes=1)
            s.text(max(sx(med), sx(hi)) + 8, y + 12, f"{med:.2f}x", 13, INK)
    return s.render()


# ---------------------------------------------------------------- operations grid


def cell_fill(v):
    t = math.log2(v)
    if t >= 0:
        return mix(OAT, SKY, min(t / 2.2, 1) * 0.85)
    return mix(OAT, CLAY, min(-t / 1.0, 1) * 0.85)


def operations(runs):
    ops = [
        ("canonicalize", "native string"),
        ("sortKeys", "native string"),
        ("minify", "native string"),
        ("validate", "native"),
        ("select", "native"),
        ("canonicalHash", "native string"),
        ("equal", "native string"),
    ]
    left, top = 250, 160
    cw, ch, g = 94, 40, 4
    h = top + len(FIXTURES) * (ch + g) + 80
    s = Sketch(960, h, "Speedup of each operation over the fastest JavaScript baseline, per fixture", 71)

    s.text(36, 48, "Every operation against the fastest JavaScript route", 22, INK, SERIF)
    s.hand(36, 76, "native ops/s divided by the best JS baseline's, median of 3 runs", 14)
    s.hand(36, 98, RUN_NOTE, 13, MUTED)
    s.hand(36, 120, "hatched orange: JavaScript wins", 14, CLAY)
    for oi, (op, _) in enumerate(ops):
        s.mono(left + oi * (cw + g) + cw / 2, top - 14, op, 12, INK, anchor="middle")
    for fi, (fx, label, size) in enumerate(FIXTURES):
        y = top + fi * (ch + g)
        s.text(left - 16, y + 18, label, 13.5, INK, anchor="end")
        s.text(left - 16, y + 35, size, 12, MUTED, anchor="end")
        for oi, (op, native) in enumerate(ops):
            med, lo, hi = ratio_stats(runs, fx, op, native, None)
            x = left + oi * (cw + g)
            slower = med < 1
            s.rect(x, y, cw, ch, INK if slower else MUTED, 1.4 if slower else 0.9,
                   fill=cell_fill(med), hatch=CLAY if slower else None, rough=0.6)
            s.tooltip(f"{label}, {op}: {med:.2f}x (runs {lo:.2f}-{hi:.2f})")
            s.text(x + cw / 2, y + 26, f"{med:.2f}x", 14, INK, anchor="middle", weight="600" if slower else "normal")

    ly = h - 42
    stops = [0.5, 0.75, 1, 1.5, 2, 3, 4.5]
    s.hand(left - 10, ly + 16, "slower", 14, INK2, anchor="end")
    for i, v in enumerate(stops):
        x = left + i * 62
        s.rect(x, ly, 56, 22, MUTED, 0.9, fill=cell_fill(v), hatch=CLAY if v < 1 else None, rough=0.5)
        s.text(x + 28, ly + 16, f"{v:g}x", 12, INK, anchor="middle")
    s.hand(left + len(stops) * 62 + 4, ly + 16, "faster", 14, INK2)
    return s.render()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    runs = load_runs()
    for theme, suffix in (("light", ""), ("dark", "-dark")):
        globals().update(THEMES[theme])
        files = {
            "hero": hero(),
            "pipeline": pipeline(),
            "numbers": numbers(),
            "speedup": speedup(runs),
            "operations": operations(runs),
        }
        for name, content in files.items():
            (OUT / f"{name}{suffix}.svg").write_text(content, encoding="utf-8", newline="\n")
            print(f"docs/images/{name}{suffix}.svg")


if __name__ == "__main__":
    main()
