import type { MermaidConfig } from "mermaid";

// SSW brand colors — keep these in sync with the @theme block in styles.css
const SSW_RED = "#cc4141";
const SSW_RED_LIGHT = "#d26e6e";
const SSW_RED_TINT = "#fdecea"; // very light red for shape fills
const SSW_GRAY = "#797979";
const SSW_BLACK = "#333333";
const SSW_LIGHT_BG = "#f6f8fa";
const WHITE = "#ffffff";

export const sswMermaidConfig: MermaidConfig = {
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    // ── Primary shapes (nodes, states, entities) ──────────────────────────
    primaryColor: SSW_RED_TINT,
    primaryBorderColor: SSW_RED,
    primaryTextColor: SSW_BLACK,

    // ── Secondary shapes ──────────────────────────────────────────────────
    secondaryColor: SSW_LIGHT_BG,
    secondaryBorderColor: SSW_GRAY,
    secondaryTextColor: SSW_BLACK,

    // ── Tertiary shapes ───────────────────────────────────────────────────
    tertiaryColor: SSW_LIGHT_BG,
    tertiaryBorderColor: SSW_GRAY,
    tertiaryTextColor: SSW_BLACK,

    // ── Edges & lines ─────────────────────────────────────────────────────
    lineColor: SSW_GRAY,
    edgeLabelBackground: WHITE,

    // ── General background & text ─────────────────────────────────────────
    background: WHITE,
    mainBkg: SSW_RED_TINT,
    nodeBorder: SSW_RED,
    clusterBkg: SSW_LIGHT_BG,
    clusterBorder: SSW_GRAY,
    titleColor: SSW_BLACK,
    textColor: SSW_BLACK,

    // ── Sequence diagrams ─────────────────────────────────────────────────
    actorBkg: SSW_RED_TINT,
    actorBorder: SSW_RED,
    actorTextColor: SSW_BLACK,
    actorLineColor: SSW_GRAY,
    signalColor: SSW_GRAY,
    signalTextColor: SSW_BLACK,
    labelBoxBkgColor: SSW_RED_TINT,
    labelBoxBorderColor: SSW_RED,
    labelTextColor: SSW_BLACK,
    loopTextColor: SSW_BLACK,
    activationBorderColor: SSW_RED,
    activationBkgColor: SSW_RED_TINT,
    sequenceNumberColor: WHITE,

    // ── Notes ─────────────────────────────────────────────────────────────
    noteBkgColor: SSW_RED_TINT,
    noteTextColor: SSW_BLACK,
    noteBorderColor: SSW_RED_LIGHT,

    // ── Gantt charts ──────────────────────────────────────────────────────
    gridColor: SSW_LIGHT_BG,
    section0: SSW_RED_TINT,
    section1: SSW_LIGHT_BG,
    altSectionColor: SSW_LIGHT_BG,
    taskBorderColor: SSW_RED,
    taskBkgColor: SSW_RED_TINT,
    activeTaskBorderColor: SSW_RED,
    activeTaskBkgColor: SSW_RED_LIGHT,
    doneTaskBkgColor: SSW_LIGHT_BG,
    doneTaskBorderColor: SSW_GRAY,
    critBorderColor: SSW_RED,
    critBkgColor: SSW_RED_TINT,
    todayLineColor: SSW_RED,

    // ── Class diagrams ────────────────────────────────────────────────────
    classText: SSW_BLACK,

    // ── Fill & stroke overrides ───────────────────────────────────────────
    fillType0: SSW_RED_TINT,
    fillType1: SSW_LIGHT_BG,
    fillType2: SSW_RED_TINT,
    fillType3: SSW_LIGHT_BG,
    fillType4: SSW_RED_TINT,
    fillType5: SSW_LIGHT_BG,
    fillType6: SSW_RED_TINT,
    fillType7: SSW_LIGHT_BG,
  },
};
