/**
 * Capture Pulse screenshots for August Week 1 report.
 * Requires: OffCKB (:28114), fiber-pulse (:3060), playwright.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "screenshots");
const BASE = process.env.PULSE_URL ?? "http://127.0.0.1:3060";

fs.mkdirSync(outDir, { recursive: true });

async function waitForApp(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("PULSE", { exact: true }).first().waitFor({ timeout: 30_000 });
}

async function main() {
  const chromePath =
    process.env.PULSE_CHROME ??
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "ms-playwright",
      "chromium-1228",
      "chrome-win64",
      "chrome.exe",
    );
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  await waitForApp(page);

  // Home / create view
  await page.locator("#create").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(outDir, "pulse-home.png"),
    fullPage: true,
  });
  console.log("OK: pulse-home.png");

  // Set session cap so mock pay can succeed later if needed
  await page.getByLabel("Session cap CKB").fill("50");
  await page.getByRole("button", { name: "Set / reset cap" }).click();
  await page.waitForTimeout(300);

  // Mock Fiber invoice that still fits mock outbound capacity
  await page.locator('label:has-text("Label") input').fill("Weekend coffee");
  await page.locator('label:has-text("Amount (CKB)") input').fill("2.5");
  await page.getByRole("button", { name: "Generate pay link" }).click();
  await page.getByRole("button", { name: "Open as payer" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Open as payer" }).click();
  await page.waitForURL(/[?&](p|pay)=/, { timeout: 15_000 });
  await page.getByText("Preflight").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, "pulse-payer.png"),
    fullPage: true,
  });
  console.log("OK: pulse-payer.png");

  // Fresh L1 request at a real hash-lock size (≥110 CKB occupied floor)
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("#create").scrollIntoViewIfNeeded();
  await page.locator('label:has-text("Label") input').fill("L1 backup invoice");
  await page.locator('label:has-text("Amount (CKB)") input').fill("200");
  await page.getByRole("button", { name: "Generate pay link" }).click();
  await page.getByRole("button", { name: "Open as payer" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Open as payer" }).click();
  await page.waitForURL(/[?&](p|pay)=/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Switch to L1 rail" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Switch to L1 rail" }).click();
  await page.getByText("L1 hash-lock rail", { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByText("Fund check").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(outDir, "pulse-l1-rail.png"),
    fullPage: true,
  });
  console.log("OK: pulse-l1-rail.png");

  await browser.close();
  console.log("ALL PASS: screenshots in", outDir);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
