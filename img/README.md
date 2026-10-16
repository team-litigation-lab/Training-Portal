# Logo files

- **`logo.svg`** — what every page uses. Vector, so it is as sharp as whatever
  size it is drawn at: in a top bar, on a sign-in card, or on a printed page.
- **`logo.png`** — the master the SVG was traced from, 646x397. Nothing on the
  site loads it. Keep it: it is the original brand file, and `make-logo-svg.py`
  regenerates `logo.svg` from it.

To regenerate after the master changes:

    pip install potracer pillow numpy
    python3 img/make-logo-svg.py        # run from the repo root

The script snaps each pixel to one of the brand's three flats (navy #2a2e40,
orange #d7782e, white), traces each as its own layer, and writes `logo.svg`.
