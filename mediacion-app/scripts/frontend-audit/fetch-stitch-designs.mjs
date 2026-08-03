// Isolated, read-only audit script. Not part of any production build.
// Talks to the real Stitch service via @google/stitch-sdk (never the native
// Claude Code MCP client, which fails tools/list on this account with a
// broken $ref in its manifest). STITCH_API_KEY must already be present in
// process.env (loaded via `node --env-file=.env.local`) — this file never
// reads, logs, or writes that value anywhere.
import { stitch } from "@google/stitch-sdk";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const command = process.argv[2];

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
    prompt: d.prompt ?? null,
    status: d.screenMetadata?.status ?? null,
    summary: d.screenMetadata?.summary ?? null,
    // Not all fields documented by the SDK exist on every screen; report
    // what's actually present instead of guessing.
    rawKeysPresent: Object.keys(d),
  };
}

async function listProjects() {
  const projects = await stitch.projects();
  const rows = [];
  for (const project of projects) {
    const d = project.data ?? {};
    let screenCount = null;
    try {
      const screens = await project.screens();
      screenCount = screens.length;
    } catch (err) {
      screenCount = `error: ${err.message}`;
    }
    rows.push({
      id: project.id,
      projectId: project.projectId,
      title: d.title ?? d.name ?? null,
      createTime: d.createTime ?? null,
      updateTime: d.updateTime ?? null,
      visibility: d.visibility ?? null,
      screenCount,
    });
  }
  console.log(JSON.stringify({ count: rows.length, projects: rows }, null, 2));
}

async function listScreens() {
  const projectId = process.argv[3];
  if (!projectId) {
    console.error("Usage: list-screens <projectId>");
    process.exit(1);
  }
  const project = stitch.project(projectId);
  const screens = await project.screens();
  const rows = screens.map(screenSummary);
  console.log(JSON.stringify({ projectId, count: rows.length, screens: rows }, null, 2));
}

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) for ${destPath}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  return buf.length;
}

async function exportScreen() {
  const [, , , projectId, screenId, slug] = process.argv;
  if (!projectId || !screenId || !slug) {
    console.error("Usage: export <projectId> <screenId> <slug>");
    process.exit(1);
  }
  const project = stitch.project(projectId);
  const screen = await project.getScreen(screenId);
  const summary = screenSummary(screen);

  const outDir = path.resolve(
    "..", "..", "..", "docs", "frontend-redesign", "stitch-export", "selected", slug
  );
  await mkdir(outDir, { recursive: true });

  const imageUrl = await screen.getImage();
  const htmlUrl = await screen.getHtml();

  const imageBytes = await downloadTo(imageUrl, path.join(outDir, "preview.png"));
  const htmlBytes = await downloadTo(htmlUrl, path.join(outDir, "screen.html"));

  await writeFile(
    path.join(outDir, "metadata.json"),
    JSON.stringify({ ...summary, previewBytes: imageBytes, htmlBytes }, null, 2)
  );

  console.log(JSON.stringify({ slug, outDir, ...summary, previewBytes: imageBytes, htmlBytes }, null, 2));
}

switch (command) {
  case "list-projects":
    await listProjects();
    break;
  case "list-screens":
    await listScreens();
    break;
  case "export":
    await exportScreen();
    break;
  default:
    console.error("Usage: node fetch-stitch-designs.mjs <list-projects|list-screens|export> [...args]");
    process.exit(1);
}
