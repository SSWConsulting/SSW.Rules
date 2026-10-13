import { anchorSide, clampAnchor, DEFAULT_PANEL_SIZE, PILL_SIZE, panelAtAnchor, pillPosition, resizePanel } from "@/components/chat/floating";

const viewport = { width: 1440, height: 900 };
const bottomRight = { right: 24, bottom: 24 };
const topLeft = { right: 1440 - PILL_SIZE.width - 24, bottom: 900 - PILL_SIZE.height - 24 };
const place = (anchor: typeof bottomRight, size = DEFAULT_PANEL_SIZE, view = viewport) => panelAtAnchor(anchor, size, anchorSide(anchor, view), view);

describe("clampAnchor", () => {
  it("pulls an off-screen pill back inside the viewport", () => {
    expect(clampAnchor({ right: 5000, bottom: -50 }, viewport)).toEqual({ right: 1440 - PILL_SIZE.width - 8, bottom: 8 });
  });
});

describe("panelAtAnchor", () => {
  it("grows up and to the left from a pill in the bottom-right corner, covering the pill's place", () => {
    const panel = place(bottomRight);
    expect(panel.left + panel.width).toBe(1440 - 24);
    expect(panel.top + panel.height).toBe(900 - 24);
  });

  it("grows down and to the right from a pill in the top-left corner", () => {
    const panel = place(topLeft);
    expect(panel.left).toBe(24);
    expect(panel.top).toBe(24);
  });

  it("shrinks to the room above the pill on a short viewport", () => {
    const short = { width: 1152, height: 560 };
    const panel = place(bottomRight, DEFAULT_PANEL_SIZE, short);
    expect(panel.top).toBe(16);
    expect(panel.top + panel.height).toBe(560 - 24);
  });

  it("stays inside the viewport with a size saved on a larger screen", () => {
    const small = { width: 800, height: 500 };
    const panel = place(bottomRight, { width: 2000, height: 2000 }, small);
    expect(panel.left).toBeGreaterThanOrEqual(16);
    expect(panel.left + panel.width).toBeLessThanOrEqual(800 - 16);
    expect(panel.top).toBeGreaterThanOrEqual(16);
    expect(panel.top + panel.height).toBeLessThanOrEqual(500 - 16);
  });

  it("moves with the pill by the same distance while the side is held", () => {
    const side = anchorSide(bottomRight, viewport);
    const before = panelAtAnchor(bottomRight, DEFAULT_PANEL_SIZE, side, viewport);
    const after = panelAtAnchor({ right: 124, bottom: 74 }, DEFAULT_PANEL_SIZE, side, viewport);
    expect(after.left).toBe(before.left - 100);
    expect(after.top).toBe(before.top - 50);
  });
});

describe("pillPosition", () => {
  it("places the pill by its offsets from the bottom-right corner", () => {
    expect(pillPosition(bottomRight, viewport)).toEqual({ left: 1440 - 24 - PILL_SIZE.width, top: 900 - 24 - PILL_SIZE.height });
  });
});

describe("resizePanel", () => {
  it("grows up and to the left when the pill is bottom-right", () => {
    expect(resizePanel(DEFAULT_PANEL_SIZE, anchorSide(bottomRight, viewport), -100, -50, viewport)).toEqual({ width: 520, height: 650 });
  });

  it("grows down and to the right when the pill is top-left", () => {
    expect(resizePanel(DEFAULT_PANEL_SIZE, anchorSide(topLeft, viewport), 100, 50, viewport)).toEqual({ width: 520, height: 650 });
  });

  it("stops at the minimum size and at the viewport", () => {
    const side = anchorSide(bottomRight, viewport);
    expect(resizePanel(DEFAULT_PANEL_SIZE, side, 5000, 5000, viewport)).toEqual({ width: 320, height: 400 });
    expect(resizePanel(DEFAULT_PANEL_SIZE, side, -5000, -5000, viewport)).toEqual({ width: 1440 - 32, height: 900 - 32 });
  });
});
