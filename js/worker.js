/* global loadPyodide */
const PYODIDE_VERSION = "0.29.5";
importScripts(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`);

async function init() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["micropip", "sqlite3"]);
  await pyodide.pyimport("micropip").install("genanki");

  const response = await fetch(new URL("../python/converter.py", self.location.href));
  if (!response.ok) throw new Error(`converter.py: HTTP ${response.status}`);
  pyodide.FS.writeFile("/home/pyodide/converter.py", await response.text());
  return { pyodide, converter: pyodide.pyimport("converter") };
}

const ready = init();
ready.then(
  () => self.postMessage({ type: "ready" }),
  (err) => self.postMessage({ type: "error", message: `Failed to load Python runtime: ${err.message}` }),
);

self.onmessage = async ({ data }) => {
  if (data.type !== "convert") return;
  try {
    const { pyodide, converter } = await ready;
    const cards = pyodide.toPy(data.cards);
    const path = converter.build_apkg(cards, data.deckName);
    cards.destroy();
    const bytes = pyodide.FS.readFile(path);
    pyodide.FS.unlink(path);
    self.postMessage({ type: "result", fileName: path.split("/").pop(), bytes }, [bytes.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
