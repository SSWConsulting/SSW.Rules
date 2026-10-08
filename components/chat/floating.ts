import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useRef } from "react";

export type Viewport = { width: number; height: number };
// Where the minimised pill sits, as offsets from the viewport's bottom-right corner, so it keeps its
// corner when the window is resized. The open window grows out of the pill's place.
export type Anchor = { right: number; bottom: number };
export type PanelSize = { width: number; height: number };
export type PanelRect = PanelSize & { left: number; top: number };
// Which half of the screen the anchor is in. The window grows towards the opposite, roomier side.
export type AnchorSide = { isLeft: boolean; isTop: boolean };

export const PILL_SIZE = { width: 200, height: 44 };
export const DEFAULT_ANCHOR: Anchor = { right: 24, bottom: 24 };
export const DEFAULT_PANEL_SIZE: PanelSize = { width: 420, height: 600 };

const PILL_MARGIN = 8;
const PANEL_MARGIN = 16;
const PANEL_MIN_WIDTH = 320;
const PANEL_MIN_HEIGHT = 400;
// Below this many pixels a press-and-release is a click, not a drag.
const DRAG_THRESHOLD = 6;

// The minimum wins when the viewport is too small to fit it.
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function pillPosition(anchor: Anchor, viewport: Viewport) {
  return { left: viewport.width - anchor.right - PILL_SIZE.width, top: viewport.height - anchor.bottom - PILL_SIZE.height };
}

export function clampAnchor(anchor: Anchor, viewport: Viewport): Anchor {
  return {
    right: clamp(anchor.right, PILL_MARGIN, viewport.width - PILL_SIZE.width - PILL_MARGIN),
    bottom: clamp(anchor.bottom, PILL_MARGIN, viewport.height - PILL_SIZE.height - PILL_MARGIN),
  };
}

export function anchorSide(anchor: Anchor, viewport: Viewport): AnchorSide {
  const { left, top } = pillPosition(anchor, viewport);
  return { isLeft: left + PILL_SIZE.width / 2 < viewport.width / 2, isTop: top + PILL_SIZE.height / 2 < viewport.height / 2 };
}

// The window covers the pill's place: its corner nearest the screen edge lines up with the pill's,
// and it shrinks to the room left on the other side.
export function panelAtAnchor(anchor: Anchor, size: PanelSize, side: AnchorSide, viewport: Viewport): PanelRect {
  const pill = pillPosition(anchor, viewport);
  const pillRight = pill.left + PILL_SIZE.width;
  const pillBottom = pill.top + PILL_SIZE.height;
  const room = {
    width: side.isLeft ? viewport.width - pill.left - PANEL_MARGIN : pillRight - PANEL_MARGIN,
    height: side.isTop ? viewport.height - pill.top - PANEL_MARGIN : pillBottom - PANEL_MARGIN,
  };
  const width = clamp(Math.min(size.width, room.width), PANEL_MIN_WIDTH, viewport.width - 2 * PANEL_MARGIN);
  const height = clamp(Math.min(size.height, room.height), PANEL_MIN_HEIGHT, viewport.height - 2 * PANEL_MARGIN);
  return {
    width,
    height,
    left: clamp(side.isLeft ? pill.left : pillRight - width, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN),
    top: clamp(side.isTop ? pill.top : pillBottom - height, PANEL_MARGIN, viewport.height - height - PANEL_MARGIN),
  };
}

// The window grows away from its anchored corner, so dragging the free corner outwards makes it bigger.
export function resizePanel(start: PanelSize, side: AnchorSide, deltaX: number, deltaY: number, viewport: Viewport): PanelSize {
  return {
    width: clamp(start.width + (side.isLeft ? deltaX : -deltaX), PANEL_MIN_WIDTH, viewport.width - 2 * PANEL_MARGIN),
    height: clamp(start.height + (side.isTop ? deltaY : -deltaY), PANEL_MIN_HEIGHT, viewport.height - 2 * PANEL_MARGIN),
  };
}

type PointerDragOptions<T> = {
  begin: () => T;
  move: (start: T, deltaX: number, deltaY: number) => void;
  end?: () => void;
  // Lets a press on a button inside the element start a drag too. A press that doesn't move past the threshold is still a click.
  fromControls?: boolean;
};

export function usePointerDrag<T>({ begin, move, end, fromControls = false }: PointerDragOptions<T>) {
  const suppressNextClick = useRef(false);

  const onPointerDown = (downEvent: ReactPointerEvent<HTMLElement>) => {
    if (downEvent.button !== 0) return;
    const element = downEvent.currentTarget;
    const control = (downEvent.target as Element).closest("button, a, input, textarea");
    if (!fromControls && control && control !== element) return;

    const start = begin();
    const pointerId = downEvent.pointerId;
    const startX = downEvent.clientX;
    const startY = downEvent.clientY;
    let dragging = false;

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!dragging && Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        // Captured only once it's a drag: a captured press retargets its click to the element, so a button inside wouldn't get it.
        element.setPointerCapture(pointerId);
      }
      move(start, deltaX, deltaY);
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      // The browser fires a click after the pointerup that ends a drag, but not after a pointercancel.
      suppressNextClick.current = dragging && upEvent.type === "pointerup";
      end?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onClickCapture = (clickEvent: ReactMouseEvent<HTMLElement>) => {
    if (!suppressNextClick.current) return;
    suppressNextClick.current = false;
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
  };

  return { onPointerDown, onClickCapture };
}
