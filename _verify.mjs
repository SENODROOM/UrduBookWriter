import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.setViewport({ width: 1500, height: 1000 });
await page.goto("http://localhost:5173", { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForSelector(".sidebar h1", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll(".sidebar .nav-item"));
  items.find((b) => b.textContent === "Settings")?.click();
});
await page.waitForSelector(".cover-form", { timeout: 5000 });

const inputInfo = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll(".cover-form input"));
  return inputs.map((i) => ({ type: i.type, value: i.value, hasTypeAttr: i.hasAttribute("type") }));
});
console.log("Inputs found:", JSON.stringify(inputInfo, null, 2));

await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll(".cover-form input"));
  const headerInput = inputs.find((i) => i.type === "text");
  headerInput.value = "MERA DEADISM";
  headerInput.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 300));

const savedMeta = await fetch("http://localhost:5173/api/book").then((r) => r.json()).catch(() => null);
console.log("Waiting for save then checking...");
await new Promise((r) => setTimeout(r, 1200));

const check = await page.evaluate(async () => {
  const res = await fetch("/api/book");
  const data = await res.json();
  return data.meta;
});
console.log("meta after header text change:", JSON.stringify(check, null, 2));

await browser.close();
