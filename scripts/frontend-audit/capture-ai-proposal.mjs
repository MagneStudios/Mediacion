// Isolated, read-only validation script — drives the REAL running app
// through real interactions (case creation wizard, generate/accept/reject)
// to reach 5 real negotiation states, screenshotting each. Never touches
// app code; purely a capture tool for
// docs/frontend-redesign/implementation-validation/ai-proposal/.

import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:8081";
const label = process.argv[2];
if (!label) {
  console.error("Usage: node capture-ai-proposal.mjs <label>");
  process.exit(1);
}

const outDir = path.resolve(
  "..",
  "..",
  "docs",
  "frontend-redesign",
  "implementation-validation",
  "ai-proposal",
);
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, locale: "es-AR" });
  const page = await context.newPage();
  return { context, page };
}

async function shot(page, name) {
  await page.waitForTimeout(600);
  const file = path.join(outDir, `${label}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${file}`);
}

async function clickButtonByText(page, text) {
  // RN Web occasionally leaves a transient duplicate/hidden text node behind
  // during a route transition — retry the whole locate+click a few times
  // instead of failing on the first stale match.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const loc = page
        .getByText(text, { exact: true })
        .locator("visible=true")
        .first();
      await loc.waitFor({ state: "visible", timeout: 6000 });
      await loc.click({ timeout: 6000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(800);
    }
  }
  throw lastErr;
}

// Scenario 1 & 2 — propuesta disponible (case-2, round 1, pendiente, untouched)
try {
  const { context, page } = await newPage(viewports.desktop);
  await page.goto(`${BASE_URL}/case/case-2/negotiation`, {
    waitUntil: "networkidle",
  });
  await shot(page, "proposal-available-desktop");
  await context.close();
  const m = await newPage(viewports.mobile);
  await m.page.goto(`${BASE_URL}/case/case-2/negotiation`, {
    waitUntil: "networkidle",
  });
  await shot(m.page, "proposal-available-mobile");
  await m.context.close();
} catch (err) {
  console.error("SCENARIO 1&2 FAILED:", err.message);
}

// Scenario 3 — esperando contraparte: create a brand-new case live through
// the real wizard (estado: 'nuevo' before any counterparty joins).
try {
  const { context, page } = await newPage(viewports.desktop);
  const caseName = `Captura QA ${Date.now()}`;
  await page.goto(`${BASE_URL}/case/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page
    .getByPlaceholder("Por ejemplo, organización familiar")
    .waitFor({ state: "visible", timeout: 15000 });
  await page
    .getByPlaceholder("Por ejemplo, organización familiar")
    .fill(caseName);
  await page.waitForTimeout(500);
  await clickButtonByText(page, "Continuar");

  await page.waitForTimeout(800);
  await page
    .getByRole("radio", { name: "Mediación" })
    .waitFor({ state: "visible", timeout: 15000 });
  await page
    .getByRole("radio", { name: "Mediación" })
    .click({ timeout: 15000 });
  await page.waitForTimeout(500);
  await clickButtonByText(page, "Continuar");

  await page.waitForTimeout(800);
  await page
    .getByText("Revisá la información")
    .waitFor({ state: "visible", timeout: 15000 });
  await clickButtonByText(page, "Crear caso");
  await page.waitForTimeout(1800);

  // IMPORTANT: this mock backend is entirely client-side, in-memory, and
  // "cleared on app restart" per this codebase's own convention — and a
  // full page navigation (page.goto) IS an app restart from the browser's
  // perspective. So every step from here on must be in-app (client-side)
  // navigation only, never page.goto(), or the case just created would be
  // wiped before we can view it.
  await clickButtonByText(page, "Casos"); // sidebar/tab link — client-side nav
  await page.waitForTimeout(800);
  // The case card itself is non-interactive by design (this redesign's own
  // accessibility fix — a Card must never double as a nested Pressable);
  // the real, only way to open a case is its own CTA button, whose
  // accessibilityLabel embeds the case title so it's unique even when
  // other cards share the same CTA wording (e.g. two "Ver caso" buttons).
  const ctaLocator = page.getByRole("button", { name: new RegExp(caseName) });
  await ctaLocator.waitFor({ state: "visible", timeout: 15000 });
  await ctaLocator.click();
  await page.waitForTimeout(800);
  const url = page.url();
  console.log(`URL_AFTER_CARD_CLICK=${url}`);
  const match = url.match(/\/case\/([^/?]+)/);
  const newCaseId = match ? decodeURIComponent(match[1]) : null;
  console.log(`NEW_CASE_ID=${newCaseId}`);

  // The product exposes no in-app link into /negotiation for a case still
  // in 'nuevo' (negotiation/positions/mediator sections are hidden until
  // the counterparty joins) — so we simulate the same history-API
  // transition a browser back/forward press would trigger, which Expo
  // Router's own web linking listener already has to handle. This is a
  // real in-app route change, not a mock: no data is injected, only the
  // URL/history entry changes, same as a user typing... except without the
  // full reload that would otherwise wipe the in-memory case we just made.
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, `/case/${newCaseId}/negotiation`);
  await page.waitForTimeout(1000);
  await shot(page, "waiting-counterparty-desktop");
  await context.close();
} catch (err) {
  console.error("SCENARIO 3 FAILED:", err.message);
}

// Scenario 5 then 4 — case-1: round 2 (reject -> resolved, no agreement),
// then round 3 (accept -> default counterparty fallback also accepts ->
// bothAccepted). Both are real, deterministic outcomes of
// mocks/negotiation.ts's COUNTERPARTY_DECISION_MATRIX.
try {
  const { context, page } = await newPage(viewports.desktop);
  // A fresh session always starts with zero private positions loaded (own
  // positions are also client-side, in-memory, reset on reload) — real
  // eligibility requires at least one own position before "ready", so we
  // add one for real through the actual positions form first. This is the
  // same requirement any real first-time user would hit.
  await page.goto(`${BASE_URL}/case/case-1/positions/create`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);
  await page
    .getByRole("radio", { name: "Otro tema", exact: true })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("radio", { name: "Otro tema", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .getByPlaceholder("Por ejemplo, días de cuidado durante la semana")
    .fill("Calendario compartido (QA)");
  await page
    .getByLabel("Límite mínimo que considerarías")
    .fill("Alternancia semanal");
  await page
    .getByLabel("Límite máximo que considerarías")
    .fill("Alternancia quincenal");
  await page
    .getByRole("radio", { name: "Podría ceder en este tema", exact: true })
    .click();
  await page.waitForTimeout(300);
  await clickButtonByText(page, "Continuar");
  await page.waitForTimeout(800);
  await clickButtonByText(page, "Guardar posición");
  await page.waitForTimeout(1200);

  // Back to negotiation, in-app (history API), not a reload.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/case/case-1/negotiation");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(1000);
  await clickButtonByText(page, "Generar propuesta");
  await page.waitForTimeout(2800);
  await clickButtonByText(page, "No aceptar");
  await page.waitForTimeout(400);
  await clickButtonByText(page, "Confirmar rechazo");
  await page.waitForTimeout(1400);
  await shot(page, "round-resolved-no-agreement-desktop");

  await clickButtonByText(page, "Iniciar nueva ronda");
  await page.waitForTimeout(1400);
  await clickButtonByText(page, "Generar propuesta");
  await page.waitForTimeout(2800);
  await clickButtonByText(page, "Aceptar propuesta");
  await page.waitForTimeout(400);
  await clickButtonByText(page, "Confirmar aceptación");
  await page.waitForTimeout(1400);
  await shot(page, "both-accepted-desktop");

  // CRITICAL: the mock store is client-side, in-memory JS module state
  // scoped to THIS page's running bundle — a new browser context/tab would
  // load a fresh bundle instance and lose everything just mutated above. So
  // the mobile/320 shots of this same reached state MUST resize the same
  // page, never open a new context.
  await page.setViewportSize(viewports.mobile);
  await shot(page, "both-accepted-mobile");

  await page.setViewportSize({ width: 320, height: 568 });
  await shot(page, "both-accepted-mobile-320");

  await context.close();
} catch (err) {
  console.error("SCENARIO 4&5 FAILED:", err.message);
}

await browser.close();
