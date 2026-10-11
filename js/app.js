const PREVIEW_LIMIT = 300;
const DELIMITERS = [",", ";", "\t", "|"];

const $ = (id) => document.getElementById(id);
const els = {
  deckName: $("deck-name"),
  hasHeaders: $("has-headers"),
  csvInput: $("csv-input"),
  convertBtn: $("convert-btn"),
  spinner: $("spinner"),
  downloadLink: $("download-link"),
  error: $("error"),
  cardCount: $("card-count"),
  previewEmpty: $("preview-empty"),
  previewList: $("preview-list"),
  previewNote: $("preview-note"),
  engineStatus: $("engine-status"),
  cardTemplate: $("card-template"),
};

let cards = [];
let downloadUrl = null;
let state = "idle";

// --- CSV parsing -----------------------------------------------------------

function detectDelimiter(text) {
  const counts = Object.fromEntries(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return DELIMITERS.reduce((best, d) => (counts[d] > counts[best] ? d : best), ",");
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row);
      row = []; field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function extractCards(text, hasHeaders) {
  text = text.replace(/^\uFEFF/, "");
  if (!text.trim()) return { cards: [], skipped: 0 };

  let rows = parseCsv(text, detectDelimiter(text));
  if (hasHeaders) rows = rows.slice(1);

  const result = [];
  let skipped = 0;
  for (const row of rows) {
    const [q = "", a = ""] = row;
    if (q.trim() && a.trim()) result.push([q.trim(), a.trim()]);
    else if (row.some((cell) => cell.trim())) skipped++;
  }
  return { cards: result, skipped };
}

// --- UI --------------------------------------------------------------------

function setState(next) {
  state = next;
  els.convertBtn.hidden = state !== "idle";
  els.spinner.hidden = state !== "busy";
  els.downloadLink.hidden = state !== "done";
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = !message;
}

function renderPreview() {
  const parsed = extractCards(els.csvInput.value, els.hasHeaders.checked);
  cards = parsed.cards;

  const fragment = document.createDocumentFragment();
  for (const [q, a] of cards.slice(0, PREVIEW_LIMIT)) {
    const item = els.cardTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector("[data-question]").textContent = q;
    item.querySelector("[data-answer]").textContent = a;
    fragment.appendChild(item);
  }
  els.previewList.replaceChildren(fragment);

  els.cardCount.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
  els.previewEmpty.hidden = cards.length > 0;
  els.previewList.hidden = cards.length === 0;

  const notes = [];
  if (cards.length > PREVIEW_LIMIT) notes.push(`Showing first ${PREVIEW_LIMIT} of ${cards.length}.`);
  if (parsed.skipped) notes.push(`${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} skipped (missing question or answer).`);
  els.previewNote.textContent = notes.join(" ");

  els.convertBtn.disabled = cards.length === 0;
  resetIfDone();
}

function resetIfDone() {
  if (state === "done") setState("idle");
}

// --- Conversion (runs in a Web Worker) -------------------------------------

const worker = new Worker("js/worker.js");

worker.onmessage = ({ data }) => {
  if (data.type === "ready") {
    els.engineStatus.hidden = true;
  } else if (data.type === "result") {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([data.bytes], { type: "application/octet-stream" }));
    els.downloadLink.href = downloadUrl;
    els.downloadLink.download = data.fileName;
    setState("done");
    els.downloadLink.click();
  } else if (data.type === "error") {
    showError(data.message);
    setState("idle");
  }
};

worker.onerror = (event) => {
  showError(`Worker error: ${event.message}`);
  setState("idle");
};

els.convertBtn.addEventListener("click", () => {
  if (!cards.length) return;
  showError("");
  setState("busy");
  worker.postMessage({ type: "convert", cards, deckName: els.deckName.value });
});

els.csvInput.addEventListener("input", renderPreview);
els.hasHeaders.addEventListener("change", renderPreview);
els.deckName.addEventListener("input", resetIfDone);

renderPreview();
