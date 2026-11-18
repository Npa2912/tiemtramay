import { test, expect, type Page } from "@playwright/test";
async function setup(
  page: Page,
  kind: "power" | "machine" | "theft",
  equipment?: "Camera an ninh" | "Máy dán nắp dự phòng",
) {
  await page.goto("/?qa=1");
  await page
    .getByRole("button", { name: "Tiếp tục chơi trên thiết bị", exact: true })
    .click();
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
  if (equipment) {
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Sự kiện", exact: true })
      .click();
    await page
      .locator(".upgrade-card")
      .filter({ has: page.getByText(equipment, { exact: true }) })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  }
  await page.getByRole("button", { name: "Mở cửa tiệm", exact: true }).click();
  await page.getByRole("button", { name: "Chọn ly M", exact: true }).click();
  await page.waitForFunction(() => !!window.mayQA);
  await page.evaluate(
    (kind) =>
      window.mayQA!.setIncidents({
        theftPlanned: kind === "theft",
        powerPlanned: kind === "power",
        machinePlanned: kind === "machine",
        theftChecked: false,
        powerChecked: false,
        machineChecked: false,
      }),
    kind,
  );
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(200);
  await page.keyboard.up("Space");
}
test("blackout really darkens the cafe, counts down and resumes unchanged drink after60 seconds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, "power");
  await expect(
    page.getByRole("dialog", { name: "Sự cố thiết bị" }),
  ).toContainText("Mất điện");
  await expect(page.locator(".power-countdown")).toContainText("giây");
  const first = parseInt(await page.locator(".power-countdown").innerText());
  await page.waitForTimeout(1200);
  expect(
    parseInt(await page.locator(".power-countdown").innerText()),
  ).toBeLessThan(first);
  await page.screenshot({ path: "screenshots/update-blackout-390x844.png" });
  await page.waitForFunction(() => !!window.mayQA);
  await page.evaluate(() => {
    for (let n = 0; n < 60; n++) window.mayQA!.act({ type: "tick", dt: 1 });
  });
  await expect(
    page.getByRole("dialog", { name: "Sự cố thiết bị" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("fill")).toContainText("0%");
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  expect(parseInt(await page.getByTestId("fill").innerText())).toBeGreaterThan(
    10,
  );
});
test("broken sealer offers 50k repair and preserves the cup", async ({
  page,
}) => {
  await setup(page, "machine");
  await expect(
    page.getByRole("dialog", { name: "Sự cố thiết bị" }),
  ).toContainText("Máy dán nắp bị hỏng");
  await expect(
    page.getByRole("button", { name: "Sửa máy · 50.000đ", exact: true }),
  ).toBeEnabled();
  const money = await page.locator(".wallet b").innerText();
  const before = Number(money.replace(/\D/g, ""));
  const dialog = page.getByRole("dialog", { name: "Sự cố thiết bị" });
  await expect(dialog.getByRole("button", { name: /máy dự phòng|kết sổ/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Sửa máy · 50.000đ", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Sự cố thiết bị" }),
  ).toHaveCount(0);
  await expect(page.locator(".wallet b")).toHaveText(
    (before - 50000).toLocaleString("vi-VN") + "đ",
  );
  await expect(page.getByTestId("fill")).toContainText("0%");
});
test("an owned backup can resume the shift without a new charge", async ({ page }) => {
  await setup(page, "machine", "Máy dán nắp dự phòng");
  const dialog = page.getByRole("dialog", { name: "Sự cố thiết bị" });
  const balance = await page.locator(".wallet b").innerText();
  await dialog.getByRole("button", { name: "Dùng máy dự phòng", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".wallet b")).toHaveText(balance);
  await expect(page.getByRole("button", { name: "Chọn ly M" })).toBeDisabled();
});
test("short on cash: advances the exact shortfall and continues the same shift", async ({
  page,
}) => {
  await setup(page, "machine");
  await page.evaluate(() => {
    const qa = window.mayQA!;
    qa.replace({ ...qa.inspect(), money: 30000 });
  });
  const dialog = page.getByRole("dialog", { name: "Sự cố thiết bị" });
  await expect(dialog.getByRole("button", { name: /Sửa máy · 50.000đ/ })).toBeDisabled();
  await dialog.getByRole("button", { name: "Ứng 20.000đ & sửa máy" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".wallet b")).toHaveText("0đ");
  const state = await page.evaluate(() => window.mayQA!.inspect());
  expect(state.debt).toBe(20000);
  expect(state.phase).toBe("open");
  expect(state.cup?.size).toBe("M");
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => parseInt(await page.getByTestId("fill").innerText())).toBeGreaterThan(0);
  await page.keyboard.up("Space");
});
test("lock bought in real inventory UI prevents daily theft and expires on next day", async ({
  page,
}) => {
  await page.goto("/?qa=1");
  await page
    .getByRole("button", { name: "Tiếp tục chơi trên thiết bị", exact: true })
    .click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Sự kiện", exact: true })
    .click();
  const lock = page
    .locator(".upgrade-card")
    .filter({ has: page.getByText("Khóa chống trộm", { exact: true }) });
  await lock.getByRole("button").click();
  await expect(lock).toContainText("Bảo vệ hết hôm nay");
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.waitForFunction(() => !!window.mayQA);
  await page.evaluate(() => {
    window.mayQA!.act({ type: "close" });
    window.mayQA!.act({ type: "next" });
  });
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Sự kiện", exact: true })
    .click();
  await expect(lock.getByRole("button")).toHaveText("20.000đ");
});

test("camera recovery remains accessible in events after dismissing the theft notification", async ({
  page,
}) => {
  await setup(page, "theft", "Camera an ninh");
  const stolen = await page.evaluate(
    () => window.mayQA!.inspect().incidents!.theft!.amount,
  );
  expect(stolen).toBeGreaterThan(0);
  const before = await page.locator(".wallet b").innerText();
  await page
    .getByRole("button", { name: "Đóng thông báo sự cố", exact: true })
    .click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Sự kiện", exact: true })
    .click();
  await page.locator(".camera-recovery").getByRole("button").click();
  await expect(page.locator(".camera-recovery")).toHaveCount(0);
  await expect(page.locator(".wallet b")).toHaveText(
    (Number(before.replace(/\D/g, "")) + stolen).toLocaleString("vi-VN") + "đ",
  );
});
