import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({page}) => { await page.addInitScript(() => {sessionStorage.setItem('may.guest','1');sessionStorage.setItem('may.qa.seed','4271');}); });


async function buyOpeningStock(page: Page) {
  await page.getByRole("button", { name: "Nhập nguyên liệu", exact: true }).click();
  for (const name of ["Trà sữa", "Hồng trà", "Sữa", "Đường", "Đá", "Trân châu", "Ly M", "Nắp"])
    await page.locator(".inventory article").filter({ has: page.getByText(name, { exact: true }) }).getByRole("button").click();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
}

for (const [width, height] of [[360, 800], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
  test(`2.0 viewport ${width}x${height}: no page scroll, usable navigation and real game screenshot`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const faults: string[] = [];
    page.on("pageerror", (error) => faults.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") faults.push(message.text()); });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
    await expect(page.locator(".wallet b")).toHaveText("1.000.000đ");
    await buyOpeningStock(page);
    await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
    await expect(page.locator(".order-heading")).toBeVisible();
    await expect(page.locator(".bottom-nav button")).toHaveCount(7);
    for (const name of ["Tiệm", "Kho", "Nâng cấp", "Trang trí", "Nhân viên", "Sự kiện", "Thành tựu"])
      await expect(page.locator(".bottom-nav").getByRole("button", { name, exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    const nav = await page.locator(".bottom-nav").boundingBox();
    expect(nav).not.toBeNull();
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(height + 1);
    expect(nav!.x + nav!.width).toBeLessThanOrEqual(width + 1);
    for (const selector of [".bottom-nav button", ".tea", ".pour-button", ".seal-button", ".serve", ".trash"]) {
      for (const control of await page.locator(selector).all()) {
        const bounds = await control.boundingBox();
        expect(bounds, selector).not.toBeNull();
        expect(bounds!.x, selector).toBeGreaterThanOrEqual(-1);
        expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(width + 1);
        expect(bounds!.y + bounds!.height, selector).toBeLessThanOrEqual(height + 1);
      }
    }
    await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
    const tea = (await page.locator(".order-heading b").innerText()).split(" · ")[0];
    await page.getByRole("button", { name: `Chọn ${tea}`, exact: true }).click();
    await page.getByTestId("pour").focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(2650);
    await page.keyboard.up("Space");
    expect(parseInt(await page.getByTestId("fill").innerText())).toBeGreaterThanOrEqual(77);
    await page.screenshot({ path: `screenshots/v2-${width}x${height}.png`, fullPage: true });
    expect(faults).toEqual([]);
  });
}

test("2.0 selecting a queued order uses the actual order and never swaps a cup", async ({ page }) => {
  await page.goto("/?qa=1");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
  await buyOpeningStock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
  await page.waitForFunction(() => !!window.mayQA);
  const selected = await page.evaluate(() => {
    const before = window.mayQA!.inspect();
    const id = before.orders[1].id;
    window.mayQA!.act({ type: "selectOrder", id });
    return { id, first: window.mayQA!.inspect().orders[0].id };
  });
  expect(selected.first).toBe(selected.id);
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  const unchanged = await page.evaluate(() => {
    const before = window.mayQA!.inspect();
    window.mayQA!.act({ type: "selectOrder", id: before.orders[1].id });
    return { before: before.orders[0].id, after: window.mayQA!.inspect().orders[0].id };
  });
  expect(unchanged.after).toBe(unchanged.before);
});

test("2.0 quest rewards and staff training change state once and survive reload", async ({ page }) => {
  await page.goto("/?qa=1");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
  await page.waitForFunction(() => !!window.mayQA);
  await buyOpeningStock(page);
  await page.getByRole("button", { name: /Nhiệm vụ hôm nay/ }).click();
  const quest = page.locator(".quest-card").filter({ has: page.getByText("Kho sẵn sàng", { exact: true }) });
  const before = await page.evaluate(() => window.mayQA!.inspect().money);
  await quest.getByRole("button").click();
  await expect(quest.getByRole("button")).toBeDisabled();
  const after = await page.evaluate(() => window.mayQA!.inspect().money);
  expect(after).toBe(before + 3000);
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) {
      window.mayQA!.act({ type: "close" });
      window.mayQA!.act({ type: "next" });
    }
  });
  await page.locator(".bottom-nav").getByRole("button", { name: "Nhân viên", exact: true }).click();
  const member = page.locator(".staff-card").filter({ has: page.getByText("Miu · Pha chế", { exact: true }) });
  await member.getByRole("button", { name: /Tuyển/ }).click();
  await expect(member).toContainText("Cấp 1");
  await member.getByRole("button", { name: /Đào tạo/ }).click();
  await expect(member).toContainText("Cấp 2");
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.waitForTimeout(750);
  await page.reload();
  await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
  await page.waitForFunction(() => !!window.mayQA);
  const restored = await page.evaluate(() => window.mayQA!.inspect());
  expect(restored.progression?.claimed).toContain("main-2");
  expect(restored.progression?.staff.barista.level).toBe(2);
});

test("2.0 a naturally generated event resolves through its real UI and is recorded", async ({ page }) => {
  await page.goto("/?qa=1");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
  await page.waitForFunction(() => !!window.mayQA);
  const event = await page.evaluate(() => {
    window.mayQA!.reset(1234);
    for (let i = 0; i < 20 && !window.mayQA!.inspect().progression?.event; i++) {
      window.mayQA!.act({ type: "close" });
      window.mayQA!.act({ type: "next" });
    }
    return window.mayQA!.inspect().progression?.event;
  });
  expect(event).toBeTruthy();
  await page.locator(".bottom-nav").getByRole("button", { name: "Sự kiện", exact: true }).click();
  const choices = page.locator(".event-story button:enabled");
  expect(await choices.count()).toBeGreaterThan(0);
  await choices.last().click();
  await expect(page.locator(".event-story")).toHaveCount(0);
  const progress = await page.evaluate(() => window.mayQA!.inspect().progression);
  expect(progress?.event).toBeNull();
  expect(progress?.eventHistory).toHaveLength(1);
  expect(progress?.eventHistory[0].id).toBe(event!.id);
});

test("2.0 enlarged brewing controls are usable on mobile and preserve the cup", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?qa=1");
  await expect(page.getByRole("button", { name: "Mở cửa tiệm", exact: true })).toBeVisible();
  await page.waitForFunction(() => !!window.mayQA);
  await buyOpeningStock(page);
  await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  await page.getByRole("button", { name: /Phóng to lựa chọn/ }).click();
  const dialog = page.getByRole("dialog", { name: "brew" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nguyên vị", exact: true }).click();
  await dialog.getByRole("button", { name: "70%", exact: true }).click();
  await dialog.getByRole("button", { name: "50%", exact: true }).last().click();
  const sugar = await dialog.getByRole("button", { name: "70%", exact: true }).boundingBox();
  expect(sugar!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  const cup = await page.evaluate(() => window.mayQA!.inspect().cup);
  expect(cup).toMatchObject({ size: "M", flavor: "plain", sugar: 70, ice: 50 });
  await expect(page.getByTestId("pour")).toBeEnabled();
});
