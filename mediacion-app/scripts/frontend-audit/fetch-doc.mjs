import { stitch } from "@google/stitch-sdk";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const projectId = "13244248640108036515";
const docs = [
  { screenId: "7282109169161008795", name: "DESIGN-mediacion-actualizado" },
  { screenId: "7282109169161007503", name: "screen-content-model" },
  { screenId: "7282109169161010197", name: "route-map" },
];

const project = stitch.project(projectId);
const outDir = path.resolve("..", "..", "..", "docs", "frontend-redesign", "stitch-export", "reference-docs");
await mkdir(outDir, { recursive: true });

for (const d of docs) {
  const screen = await project.getScreen(d.screenId);
  let html = null;
  try { html = await screen.getHtml(); } catch (e) { console.log(d.name, "getHtml error", e.message); }
  let content = null;
  if (html) {
    try {
      const res = await fetch(html);
      content = await res.text();
    } catch (e) { console.log(d.name, "download error", e.message); }
  }
  if (content) {
    await writeFile(path.join(outDir, d.name + ".md"), content);
    console.log(d.name, "saved", content.length, "bytes");
  } else {
    console.log(d.name, "NO CONTENT, raw data keys:", Object.keys(screen.data ?? {}));
  }
}
