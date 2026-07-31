// Isolated, read-only audit script. Downloads ALL candidate versions (not a
// final selection yet) for the three target screens from the confirmed
// Stitch project "Sistema de Diseño Mediación Serena". Every screenId below
// was copied verbatim from a real `list-screens` call against this project —
// none invented. Never reads/logs/persists STITCH_API_KEY.
import { stitch } from "@google/stitch-sdk";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const projectId = "13244248640108036515";

const candidates = [
  // Listado de Casos
  { category: "cases-list", versionSlug: "v3-desktop", screenId: "721ab1fca16f405cad188150e0c1e173", title: "Listado de Casos (Desktop) v3" },
  { category: "cases-list", versionSlug: "v4-desktop", screenId: "980e7dc20e44406e86fcceff7ec97b78", title: "Listado de Casos (Desktop) v4" },
  { category: "cases-list", versionSlug: "v4-mobile", screenId: "6038011f44f84a71a6f619b2267cede1", title: "Listado de Casos (Mobile) v4" },
  // Detalle del Caso
  { category: "case-detail", versionSlug: "v2-desktop", screenId: "47db51acd0794ac1b75839fd2ed227e5", title: "Detalle del Caso (Desktop) v2" },
  { category: "case-detail", versionSlug: "v3-desktop", screenId: "e1f72a369ca74787b447ba4cc3cfd0d0", title: "Detalle del Caso (Desktop) v3" },
  { category: "case-detail", versionSlug: "v2-mobile", screenId: "c47a74a436f944669ef02e8919afc583", title: "Detalle del Caso (Mobile) v2" },
  { category: "case-detail", versionSlug: "v3-mobile", screenId: "583a5113016a49bdb5c426684e9a7fda", title: "Detalle del Caso (Mobile) v3" },
  // Propuesta de IA
  { category: "ai-proposal", versionSlug: "v1-desktop", screenId: "eefb68e5d4d54a1cac7a35ee7fbe0938", title: "Propuesta de IA (Desktop)" },
  { category: "ai-proposal", versionSlug: "v2-desktop", screenId: "eb795363b88447bc81d24fe46c350f79", title: "Propuesta de IA (Desktop) v2" },
  { category: "ai-proposal", versionSlug: "v3-desktop", screenId: "540288af2fc64489bdecb42051577209", title: "Propuesta de IA (Desktop) v3" },
  { category: "ai-proposal", versionSlug: "v1-mobile", screenId: "5acdecba4b0c44089e56551c73f4398a", title: "Propuesta de IA (Mobile)" },
  { category: "ai-proposal", versionSlug: "v2-mobile", screenId: "261e1f9e849d42089f9fa3f9d6d86c25", title: "Propuesta de IA (Mobile) v2" },
  { category: "ai-proposal", versionSlug: "v3-mobile", screenId: "72bf18985fd4472e81e6a8fc50cbe86f", title: "Propuesta de IA (Mobile) v3" },
];

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${destPath}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  return buf.length;
}

function screenSummary(screen) {
  const d = screen.data ?? {};
  return {
    screenId: screen.id,
    projectId: screen.projectId,
    title: d.title ?? null,
    width: d.width ?? null,
    height: d.height ?? null,
    deviceType: d.deviceType ?? null,
    screenType: d.screenType ?? null,
  };
}

const baseOut = path.resolve("..", "..", "..", "docs", "frontend-redesign", "stitch-export", "candidates");
const project = stitch.project(projectId);
const results = [];

for (const c of candidates) {
  const outDir = path.join(baseOut, c.category, c.versionSlug);
  process.stdout.write(`Fetching ${c.title} (${c.screenId})...\n`);
  const screen = await project.getScreen(c.screenId);
  const summary = screenSummary(screen);

  let previewBytes = null;
  let htmlBytes = null;
  let htmlAvailable = false;

  try {
    const imageUrl = await screen.getImage();
    previewBytes = await downloadTo(imageUrl, path.join(outDir, "preview.png"));
  } catch (err) {
    process.stdout.write(`  preview failed: ${err.message}\n`);
  }

  try {
    const htmlUrl = await screen.getHtml();
    if (htmlUrl) {
      htmlBytes = await downloadTo(htmlUrl, path.join(outDir, "screen.html"));
      htmlAvailable = true;
    }
  } catch (err) {
    process.stdout.write(`  html failed: ${err.message}\n`);
  }

  const metadata = { ...summary, category: c.category, versionSlug: c.versionSlug, previewBytes, htmlAvailable, htmlBytes };
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "metadata.json"), JSON.stringify(metadata, null, 2));
  results.push(metadata);
}

console.log(JSON.stringify({ projectId, downloaded: results.length, results }, null, 2));
