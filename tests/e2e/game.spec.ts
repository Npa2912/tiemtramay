import { test, expect, type Page } from "@playwright/test";
const browserFaults = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const faults: string[] = [];
  browserFaults.set(page, faults);
  page.on("console", (m) => {
    if (m.type() === "error") faults.push(m.text());
  });
  page.on("pageerror", (e) => faults.push(String(e)));
});
test.afterEach(async ({ page }) => {
  expect(browserFaults.get(page) ?? []).toEqual([]);
});
async function start(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm" })).toBeVisible();
}
async function stock(page: Page) {
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
  ]) {
    const row = page
      .locator(".inventory article")
      .filter({ has: page.getByText(name, { exact: true }) });
    if (
      parseFloat(
        (await row.locator("small").first().innerText()).replace(",", "."),
      ) < 1
    )
      await row.getByRole("button").click();
  }
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
}
async function brew(page: Page) {
  const tea = (await page.locator(".order-heading b").innerText()).split(
    " · ",
  )[0];
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  await page.getByRole("button", { name: `Chọn ${tea}`, exact: true }).click();
  const nozzle = page.getByTestId("pour");
  await nozzle.scrollIntoViewIfNeeded();
  const box = (await nozzle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const began = Date.now();
  await page.mouse.down();
  await expect
    .poll(async () => parseInt(await page.getByTestId("fill").innerText()), {
      intervals: [35],
      timeout: 7000,
    })
    .toBeGreaterThanOrEqual(83);
  await page.mouse.up();
  expect(Date.now() - began).toBeGreaterThan(2000);
  const fill = await page.getByTestId("fill").innerText();
  expect(parseInt(fill)).toBeGreaterThanOrEqual(77);
  expect(parseInt(fill)).toBeLessThanOrEqual(94);
  await page.waitForTimeout(200);
  expect(await page.getByTestId("fill").innerText()).toBe(fill);
  await page.locator(".topping").filter({ hasText: "Trân châu" }).click();
  await page.getByRole("button", { name: "Nguyên vị", exact: true }).click();
  await page.getByRole("button", { name: "70%", exact: true }).click();
  await page.getByRole("button", { name: "Ít đá", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Giao cho khách" }),
  ).toBeDisabled();
  await page.locator(".seal-button").click();
  await expect(
    page.getByRole("button", { name: "Giao cho khách" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "screenshots/drink-sealed.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Giao cho khách" }).click();
}
test("real pointer gameplay, purchases, two customers, summary, upgrade, next day, IndexedDB reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await expect(page.locator(".order-heading")).toBeVisible();
  await brew(page);
  await brew(page);
  await page.getByRole("button", { name: "Đóng cửa sớm & tổng kết" }).click();
  await page.getByRole("button", { name: "Xem tổng kết", exact: true }).click();
  await expect(page.locator(".receipt")).toContainText("2 khách");
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.getByRole("button", { name: "Nâng cấp", exact: true }).click();
  await page
    .locator(".upgrade-card")
    .filter({ hasText: "Máy dán nắp" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.getByRole("button", { name: "Sang ngày 2" }).click();
  await page.waitForTimeout(800);
  const wallet = await page.locator(".wallet b").innerText();
  await page.reload();
  await expect(page.locator(".statusbar")).toContainText("NGÀY 02");
  await expect(page.locator(".wallet b")).toHaveText(wallet);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await expect(page.locator(".order-heading")).toBeVisible();
  await page.screenshot({
    path: "screenshots/gameplay-day2.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
for (const [width, height] of [
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1366, 768],
])
  test(`responsive ${width}x${height}, dialogs, assets, no overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await start(page);
    await expect(page.locator("canvas")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const text of [
      "Kho",
      "Nâng cấp",
      "Trang trí",
      "Nhân viên",
      "Sự kiện",
      "Thành tựu",
    ]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: text, exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const close = page.getByRole("button", { name: "Đóng cửa sổ" });
      await expect(close).toBeInViewport();
      await close.click();
    }
    await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Sổ công thức", exact: true }).click();
    await expect(page.locator(".recipe-card")).toHaveCount(36);
    await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
    await page.screenshot({
      path: `screenshots/${width}x${height}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("pause, save during drink, reload, resume and mobile repeated input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  const patience = await page
    .getByRole("progressbar")
    .getAttribute("aria-valuenow");
  await page.waitForTimeout(1000);
  expect(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
  ).toBe(patience);
  await page.getByRole("button", { name: "Lưu game", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tiếp tục", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Chọn ly M", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Bỏ ly", exact: true }).click();
  await page
    .getByRole("button", { name: "Chọn ly M", exact: true })
    .dblclick({ force: true });
  await expect(page.getByTestId("fill")).toContainText("0%");
});
test("decoration persists; JSON export/import validates data; reset is confirmed", async ({
  page,
}) => {
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Trang trí", exact: true }).click();
  await page
    .locator(".decor-row")
    .filter({ has: page.getByText("Mái hiên", { exact: true }) })
    .getByRole("button", { name: "Vườn trà", exact: true })
    .click();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await expect(page.locator(".game")).toHaveClass(/awning-1/);
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất save JSON" }).click();
  const download = await downloadPromise;
  const savePath = (await download.path())!;
  await page
    .getByRole("button", { name: "Bắt đầu tiệm mới", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xóa và bắt đầu lại", exact: true })
    .click();
  await expect(page.locator(".game")).toHaveClass(/awning-0/);
  await page.locator("input[type=file]").setInputFiles(savePath);
  await expect(page.locator(".modal-footer")).toContainText("Đã nhập bản lưu");
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await expect(page.locator(".game")).toHaveClass(/awning-1/);
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2,"money":999}'),
  });
  await expect(page.locator(".modal-footer")).toContainText("không hợp lệ");
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator(".game")).toHaveClass(/awning-1/);
});
test("keyboard pour releases immediately and hiding tab pauses gameplay", async ({
  page,
}) => {
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(800);
  await page.keyboard.up("Space");
  const fill = await page.getByTestId("fill").innerText();
  expect(parseInt(fill)).toBeGreaterThan(15);
  await page.waitForTimeout(300);
  expect(await page.getByTestId("fill").innerText()).toBe(fill);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Tiếp tục", exact: true }),
  ).toBeVisible();
});
test("complete all first-day orders and automatically close, then continue day 2", async ({
  page,
}) => {
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  for (let i = 0; i < 5; i++) await brew(page);
  await expect(page.getByRole("button", { name: "Sang ngày 2" })).toBeVisible();
  await page.getByRole("button", { name: "Xem tổng kết", exact: true }).click();
  await expect(page.locator(".receipt")).toContainText("5 khách");
  await page.screenshot({
    path: "screenshots/day1-summary.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.getByRole("button", { name: "Sang ngày 2" }).click();
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await expect(page.locator(".order-heading")).toBeVisible();
});
test("real touch hold, release and rapid multitouch do not duplicate a cup", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await start(page);
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).tap();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).tap();
  const nozzle = page.getByTestId("pour");
  await nozzle.scrollIntoViewIfNeeded();
  const b = (await nozzle.boundingBox())!,
    touch = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch],
  });
  await page.waitForTimeout(1500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const fill = await page.getByTestId("fill").innerText();
  expect(parseInt(fill)).toBeGreaterThan(30);
  await page.waitForTimeout(300);
  expect(await page.getByTestId("fill").innerText()).toBe(fill);
  await page.getByRole("button", { name: "Bỏ ly", exact: true }).tap();
  const cup = page.getByRole("button", { name: "Chọn ly M", exact: true });
  await cup.scrollIntoViewIfNeeded();
  const cb = (await cup.boundingBox())!;
  await cup.tap();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cb.x + 12, y: cb.y + 12, id: 1 },
      { x: cb.x + 30, y: cb.y + 12, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(cup).toBeDisabled();
  await expect(cup).toContainText("18");
  await expect(page.getByTestId("fill")).toContainText("0%");
  await context.close();
});
test("browser QA controller simulates 35 days with actual IndexedDB roundtrips and bounded heap", async ({
  page,
  context,
}) => {
  await page.goto("/?qa=1");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm" })).toBeVisible();
  await page.waitForFunction(() => !!window.mayQA);
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  await session.send("HeapProfiler.collectGarbage");
  const before = await session.send("Performance.getMetrics");
  const beforeHeap = before.metrics.find(
    (m: { name: string }) => m.name === "JSHeapUsedSize",
  )!.value;
  const samples = await page.evaluate(async () => {
    window.mayQA!.reset(1234);
    return window.mayQA!.simulateDays(35);
  });
  expect(samples).toHaveLength(35);
  expect(samples[34].served).toBe(20);
  await session.send("HeapProfiler.collectGarbage");
  const after = await session.send("Performance.getMetrics");
  const afterHeap = after.metrics.find(
    (m: { name: string }) => m.name === "JSHeapUsedSize",
  )!.value;
  console.log(
    "BROWSER_LONG_RUN",
    JSON.stringify({
      beforeHeap,
      afterHeap,
      delta: afterHeap - beforeHeap,
      samples: samples.filter((s) => [1, 5, 10, 20, 30, 35].includes(s.day)),
    }),
  );
  expect(afterHeap - beforeHeap).toBeLessThan(16 * 1024 * 1024);
  await page.reload();
  await expect(page.locator(".statusbar")).toContainText("NGÀY 36");
  await stock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm" }).click();
  await expect(page.locator(".order-heading")).toBeVisible();
  await page.screenshot({
    path: "screenshots/day36-after-longrun.png",
    fullPage: true,
  });
});

test("opening an empty shop explains missing supplies and opens inventory, then works after purchase", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "kho" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Để mở cửa, cần nhập");
  await expect(page.locator(".modal-footer")).toContainText("Chưa thể mở cửa");
  await expect(page.locator(".wallet b")).toHaveText("1.000.000đ");
  await page.screenshot({
    path: "screenshots/open-empty-shop-guidance.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await stock(page);
  await expect(page.locator(".closed-card")).toContainText(
    "Nguyên liệu đã sẵn sàng",
  );
  await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
  await expect(page.locator(".order-heading")).toBeVisible();
});
