import { jsPDF } from "jspdf";
import type { UiMessage } from "@/components/teaching/types";

/* ---- Layout constants (millimetres) ---- */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const HEADER_H = 54;
const FIRST_CONTENT_TOP = HEADER_H + 10;
const PAGE_CONTENT_TOP = 22;
const CONTENT_BOTTOM = 274;
const MAX_BUBBLE_W = 132;
const PAD = 4.6;
const LINE_H = 5.2;
const TURN_GAP = 8;
const AVATAR_R = 4.4;

/* ---- Palette (RGB) ---- */
const TEAL: RGB = [31, 77, 74];
const TEAL_MID: RGB = [42, 99, 96];
const TEACHER_SOFT: RGB = [238, 244, 242];
const TEACHER_LINE: RGB = [214, 228, 224];
const STUDENT: RGB = [47, 125, 79];
const STUDENT_SOFT: RGB = [238, 246, 239];
const STUDENT_LINE: RGB = [211, 231, 216];
const INK: RGB = [27, 39, 51];
const MUTED: RGB = [92, 107, 122];
const LIGHT: RGB = [243, 247, 245];

type RGB = [number, number, number];

/**
 * Render the tutor conversation as a polished, vector PDF and trigger a direct
 * one-click download — no print dialog. Drawn with the jsPDF primitive API so
 * the text stays crisp and selectable.
 */
export function downloadChatPdf(messages: UiMessage[], documentTitle: string): void {
  const visible = messages.filter((message) => !message.hidden && message.content.trim());
  if (visible.length === 0) {
    return;
  }

  const title = documentTitle || "Untitled document";
  const exchanges = visible.filter((message) => message.role === "user").length;
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, title, generatedOn, exchanges, visible.length);

  let y = FIRST_CONTENT_TOP;
  for (const message of visible) {
    y = drawTurn(doc, message, y);
  }

  drawFooters(doc, title);
  doc.save(`Chat - ${sanitizeFileName(title)}.pdf`);
}

/* ---- Cover header band ---- */
function drawHeader(
  doc: jsPDF,
  title: string,
  generatedOn: string,
  exchanges: number,
  messageCount: number
): void {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");
  // Subtle two-tone wedge for depth.
  doc.setFillColor(...TEAL_MID);
  doc.triangle(PAGE_W, 0, PAGE_W, HEADER_H, PAGE_W - 70, 0, "F");

  doc.setTextColor(...withAlpha(LIGHT, 0.7));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setCharSpace(1.4);
  doc.text("AI VOICE TUTOR", MARGIN, 15);
  doc.setCharSpace(0);

  doc.setTextColor(...LIGHT);
  doc.setFontSize(21);
  doc.text("Conversation Transcript", MARGIN, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...withAlpha(LIGHT, 0.85));
  doc.text(truncate(doc, title, PAGE_W - MARGIN * 2), MARGIN, 32);

  doc.setDrawColor(...withAlpha(LIGHT, 0.3));
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 38, PAGE_W - MARGIN, 38);

  drawMetaCell(doc, MARGIN, "EXPORTED", generatedOn);
  drawMetaCell(doc, MARGIN + 62, "QUESTIONS ASKED", String(exchanges));
  drawMetaCell(doc, MARGIN + 124, "TOTAL MESSAGES", String(messageCount));
}

function drawMetaCell(doc: jsPDF, x: number, label: string, value: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setCharSpace(0.8);
  doc.setTextColor(...withAlpha(LIGHT, 0.6));
  doc.text(label, x, 45);
  doc.setCharSpace(0);
  doc.setFontSize(12);
  doc.setTextColor(...LIGHT);
  doc.text(value, x, 50.5);
}

/* ---- One conversation turn (may span pages) ---- */
function drawTurn(doc: jsPDF, message: UiMessage, startY: number): number {
  const isStudent = message.role === "user";
  const accent = isStudent ? STUDENT : TEAL;
  const fill = isStudent ? STUDENT_SOFT : TEACHER_SOFT;
  const stroke = isStudent ? STUDENT_LINE : TEACHER_LINE;
  const label = isStudent ? "You" : "AI Teacher";
  const initial = isStudent ? "Y" : "T";

  const textW = MAX_BUBBLE_W - PAD * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines: string[] = doc.splitTextToSize(cleanContent(message.content), textW);

  // Width hugs the longest line so short replies don't look like blank slabs.
  let widest = 0;
  for (const line of lines) {
    widest = Math.max(widest, doc.getTextWidth(line));
  }
  const bubbleW = Math.min(MAX_BUBBLE_W, Math.max(widest + PAD * 2, 34));

  let y = startY;
  // Keep the avatar + role label with at least the first text line.
  if (y + 7 + LINE_H + PAD * 2 > CONTENT_BOTTOM) {
    doc.addPage();
    y = PAGE_CONTENT_TOP;
  }

  // Reserve a margin column for the avatar on both sides so the disc never
  // sits on top of the bubble — symmetrical with the teacher layout.
  const COLUMN = AVATAR_R * 2 + 4;
  const avatarCx = isStudent ? PAGE_W - MARGIN - AVATAR_R : MARGIN + AVATAR_R;
  const bubbleX = isStudent
    ? PAGE_W - MARGIN - COLUMN - bubbleW
    : MARGIN + COLUMN;

  // Avatar disc.
  doc.setFillColor(...accent);
  doc.circle(avatarCx, y + AVATAR_R, AVATAR_R, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(initial, avatarCx, y + AVATAR_R + 0.3, { align: "center", baseline: "middle" });

  // Role label — anchored just inside the bubble, clear of the avatar disc.
  doc.setFontSize(8);
  doc.setCharSpace(0.5);
  doc.setTextColor(...accent);
  doc.text(
    label.toUpperCase(),
    isStudent ? avatarCx - AVATAR_R - 4 : bubbleX,
    y + 3.2,
    { align: isStudent ? "right" : "left" }
  );
  doc.setCharSpace(0);
  y += 7;

  // Bubble body — chunked so it flows across page breaks cleanly.
  let index = 0;
  let firstChunk = true;
  while (index < lines.length) {
    const available = CONTENT_BOTTOM - y - PAD * 2;
    let fit = Math.max(1, Math.floor(available / LINE_H));
    if (fit >= lines.length - index) {
      fit = lines.length - index;
    }
    const chunk = lines.slice(index, index + fit);
    const chunkH = chunk.length * LINE_H + PAD * 2;

    doc.setFillColor(...fill);
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.3);
    doc.roundedRect(bubbleX, y, bubbleW, chunkH, 3, 3, "FD");
    // Squared-off corner on the avatar side, chat-bubble style.
    doc.setFillColor(...fill);
    if (firstChunk) {
      if (isStudent) {
        doc.rect(bubbleX + bubbleW - 3, y, 3, 3, "F");
      } else {
        doc.rect(bubbleX, y, 3, 3, "F");
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(chunk, bubbleX + PAD, y + PAD + LINE_H * 0.72, { lineHeightFactor: LINE_H / 3.5 });

    y += chunkH;
    index += fit;
    firstChunk = false;

    if (index < lines.length) {
      doc.addPage();
      y = PAGE_CONTENT_TOP;
    }
  }

  return y + TURN_GAP;
}

/* ---- Page footers (drawn once page count is final) ---- */
function drawFooters(doc: jsPDF, title: string): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...withAlpha(MUTED, 0.35));
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Grounded in “${title}”`, MARGIN, PAGE_H - 11);
    doc.text(`Page ${page} of ${total}`, PAGE_W - MARGIN, PAGE_H - 11, { align: "right" });
  }
}

/* ---- Helpers ---- */

/** Flatten an RGB colour over the teal/white backdrop to fake transparency. */
function withAlpha(color: RGB, alpha: number): RGB {
  const base: RGB = color === LIGHT ? TEAL : [255, 255, 255];
  return color.map((channel, i) =>
    Math.round(channel * alpha + base[i] * (1 - alpha))
  ) as RGB;
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  let clipped = text;
  while (clipped.length > 1 && doc.getTextWidth(`${clipped}…`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trimEnd()}…`;
}

/** Drop the simple markdown emphasis markers the tutor occasionally emits. */
function cleanContent(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1$2")
    .trim();
}

function sanitizeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "transcript";
}
