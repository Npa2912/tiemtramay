import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  try {
    let path = resolve(
      root,
      "." + decodeURIComponent((req.url || "/").split("?")[0]),
    );
    if (!path.startsWith(root + "/") && path !== root) throw Error("Path");
    if ((await stat(path)).isDirectory()) path += "/index.html";
    const data = await readFile(path);
    res.setHeader(
      "Content-Type",
      mime[extname(path)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/?qa=1`);
  await page.getByRole("button", {name:"Tiếp tục chơi trên thiết bị",exact:true}).click();
  await page.getByRole("button", { name: "Mở cửa tiệm" }).waitFor();
  if ((await page.evaluate(() => typeof window.mayQA)) !== "undefined")
    throw Error("QA bridge leaked into production");
  await page
    .getByRole("button", { name: "Nhập nguyên liệu", exact: true })
    .click();
  for (const name of [
    "Trà sữa",
    "Hồng trà",
    "Sữa",
    "Đường",
    "Đá",
    "Trân châu",
    "Ly M",
    "Nắp",
  ])
    await page
      .locator(".inventory article")
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole("button")
      .click();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.locator(".bottom-nav").getByRole("button", {name:"Sự kiện",exact:true}).click();
  for (const name of ["Khóa chống trộm","Máy phát điện","Máy dán nắp dự phòng"]) await page.locator(".upgrade-card").filter({has:page.getByText(name,{exact:true})}).getByRole("button").click();
  await page.getByRole("button", {name:"Đóng cửa sổ"}).click();
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await page.locator(".order-heading").waitFor();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  const tea = (await page.locator(".order-heading b").innerText()).split(
    " · ",
  )[0];
  await page.getByRole("button", { name: `Chọn ${tea}`, exact: true }).click();
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(2650);
  await page.keyboard.up("Space");
  const fill = parseInt(await page.getByTestId("fill").innerText());
  if (fill < 77 || fill > 94) throw Error(`Pour ${fill}%`);
  await page.locator(".topping").filter({ hasText: "Trân châu" }).click();
  for (const name of ["Nguyên vị", "70%", "Ít đá"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.locator(".seal-button").click();
  await page.getByRole("button", { name: "Giao cho khách" }).waitFor();
  await page.waitForFunction(() => !document.querySelector(".serve")?.disabled);
  await page.getByRole("button", { name: "Giao cho khách" }).click();
  const money = await page.locator(".wallet b").innerText();
  await page.waitForTimeout(800);
  await page.reload();
  await page.locator(".order-heading").waitFor();
  if ((await page.locator(".wallet b").innerText()) !== money)
    throw Error("Reload lost money");
  // Prove assets work without runtime CDN requests after the first local load.
  await page.route("**/*", (route) =>
    route.request().url().startsWith(`http://127.0.0.1:${port}`)
      ? route.continue()
      : route.abort(),
  );
  await page.reload();
  await page.locator("canvas").waitFor();
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PRODUCTION SMOKE PASS: assets, purchase, hold/release, seal, serve, IndexedDB reload, no external runtime fetch, QA bridge excluded",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
