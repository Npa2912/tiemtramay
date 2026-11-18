import { test, expect, type BrowserContext } from "@playwright/test";
import { initial, reduce, type State } from "../../src/engine";
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  state: State;
  revision: number;
}
function service(options: { startingState?: State; brewingDelayMs?: number; advanceSupported?: () => boolean } = {}) {
  const users = new Map<string, User>();
  const tokens = new Map<string, User>();
  async function install(context: BrowserContext) {
    await context.route("https://may-test.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        body = req.postDataJSON() || {},
        token = req.headers().authorization?.replace("Bearer ", "");
      let user = token ? tokens.get(token) : undefined;
      const reply = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (
        url.pathname === "/auth/v1/signup" ||
        url.pathname === "/auth/v1/token"
      ) {
        if (url.pathname.endsWith("signup")) {
          if (users.has(body.email))
            return reply({ error_code: "user_already_exists" }, 400);
          user = {
            id: `user-${users.size}`,
            email: body.email,
            password: body.password,
            name: body.data.owner_name,
            state: options.startingState ? structuredClone(options.startingState) : initial(),
            revision: 1,
          };
          users.set(user.email, user);
        } else {
          user = users.get(body.email);
          if (!user || user.password !== body.password)
            return reply({ error_code: "invalid_credentials" }, 400);
        }
        const access = `token-${user!.id}`;
        tokens.set(access, user!);
        return reply({
          access_token: access,
          refresh_token: `refresh-${user!.id}`,
          expires_in: 3600,
          user: { id: user!.id, email: user!.email },
        });
      }
      if (!user) return reply({ error: "unauthorized" }, 401);
      if (url.pathname === "/auth/v1/user")
        return reply({ id: user.id, email: user.email });
      if (url.pathname === "/auth/v1/logout") return reply({});
      if (url.pathname === "/rest/v1/profiles") {
        if (req.method() === "PATCH") user.name = body.owner_name;
        return reply([
          {
            owner_name: user.name,
            shop_name: "Tiệm Trà Mây",
            created_at: "2026-11-16T00:00:00Z",
          },
        ]);
      }
      if (url.pathname === "/functions/v1/game") {
        if (body.action) {
          if (body.action.type === "advanceRepair" && options.advanceSupported?.() === false)
            return reply({ error: "action" }, 400);
          if (options.brewingDelayMs && ["cup", "pour", "top", "seal"].includes(body.action.type)) {
            await new Promise((resolve) => setTimeout(resolve, options.brewingDelayMs));
          }
          if (body.revision !== user.revision)
            return reply({ error: "revision_conflict" }, 409);
          user.state = reduce(user.state, body.action);
          user.revision++;
        }
        return reply({ state: user.state, revision: user.revision });
      }
      return reply({ error: "unknown path" }, 404);
    });
  }
  return { install, users };
}
test("account contract: same account on two devices loads same progress; another account remains independent", async ({
  browser,
}) => {
  const backend = service();
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  await backend.install(c1);
  await backend.install(c2);
  const p1 = await c1.newPage(),
    p2 = await c2.newPage();
  await p1.goto("/");
  await p1.getByRole("button", { name: "Đăng ký ngay", exact: true }).click();
  await p1.getByLabel("Tên chủ quán", { exact: false }).fill("Chủ Tiệm Linh");
  await p1.getByLabel("Email", { exact: false }).fill("linh@example.test");
  await p1.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await p1
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("TiemTraMay123!");
  await p1.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(p1.locator(".wallet b")).toHaveText("1.000.000đ");
  await p1
    .locator(".bottom-nav")
    .getByRole("button", { name: "Kho", exact: true })
    .click();
  await p1
    .locator(".inventory article")
    .filter({ has: p1.getByText("Trà sữa", { exact: true }) })
    .getByRole("button")
    .click();
  await expect(p1.locator(".wallet b")).toHaveText("952.000đ");
  await p1.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await p2.goto("/");
  await p2.getByLabel("Email", { exact: false }).fill("linh@example.test");
  await p2.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await p2.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(p2.locator(".wallet b")).toHaveText("952.000đ");
  await c2.setOffline(true);
  await expect(p2.locator(".message")).toContainText("Mất kết nối");
  await c2.setOffline(false);
  await p2.reload();
  await expect(p2.locator(".wallet b")).toHaveText("952.000đ");
  const c3 = await browser.newContext();
  await backend.install(c3);
  const p3 = await c3.newPage();
  await p3.goto("/");
  await p3.getByRole("button", { name: "Đăng ký ngay", exact: true }).click();
  await p3.getByLabel("Tên chủ quán", { exact: false }).fill("Chủ Tiệm Bình");
  await p3.getByLabel("Email", { exact: false }).fill("binh@example.test");
  await p3.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay456!");
  await p3
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("TiemTraMay456!");
  await p3.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(p3.locator(".wallet b")).toHaveText("1.000.000đ");
  expect(backend.users.get("linh@example.test")!.state.money).toBe(952000);
  await c1.close();
  await c2.close();
  await c3.close();
});
test("online controls react before a slow save confirms the brew", async ({ page, context }) => {
  let startingState = initial(4271);
  for (const id of ["milk", "black", "milkPowder", "sugar", "ice", "pearl", "cupM", "lid"])
    startingState = reduce(startingState, { type: "buy", id });
  startingState = reduce(startingState, { type: "open" });
  startingState.incidents = {
    ...startingState.incidents!,
    machinePlanned: false,
    powerPlanned: false,
    theftPlanned: false,
  };
  const backend = service({ startingState, brewingDelayMs: 350 });
  await backend.install(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Đăng ký ngay", exact: true }).click();
  await page.getByLabel("Tên chủ quán").fill("Chủ Tiệm Test");
  await page.getByLabel("Email").fill("quay@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  const cupButton = page.getByRole("button", { name: "Chọn ly M", exact: true });
  await cupButton.click();
  expect(await cupButton.isDisabled()).toBe(true);
  const saved = backend.users.get("quay@example.test")!;
  expect(saved.state.cup).toBeNull();
  await page.getByTestId("pour").focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => parseInt(await page.getByTestId("fill").innerText()), { intervals: [30] }).toBeGreaterThanOrEqual(82);
  await page.keyboard.up("Space");
  const fill = await page.getByTestId("fill").innerText();
  const pearls = page.locator(".topping").filter({ hasText: "Trân châu" });
  await pearls.click();
  expect(await pearls.getAttribute("class")).toContain("chosen");
  for (const name of ["Nguyên vị", "70%", "Ít đá"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.locator(".seal-button").click();
  expect(await page.locator(".seal-button").innerText()).toContain("Đã dán nắp");
  expect(saved.state.cup?.sealed).not.toBe(true);
  await expect.poll(() => saved.state.cup?.sealed).toBe(true);
  expect(await page.getByTestId("fill").innerText()).toBe(fill);
  expect(await page.getByRole("button", { name: "Giao cho khách" }).isEnabled()).toBe(true);
});
test("repair dialog reports an outdated server and can recover without charging twice", async ({ page, context }) => {
  const startingState = initial(4271);
  startingState.money = 30000;
  startingState.incidents!.machineBroken = true;
  let deployed = false;
  const backend = service({ startingState, advanceSupported: () => deployed });
  await backend.install(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Đăng ký ngay", exact: true }).click();
  await page.getByLabel("Tên chủ quán").fill("Chủ Tiệm Test");
  await page.getByLabel("Email").fill("repair@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Sự cố thiết bị" });
  const advance = dialog.getByRole("button", { name: "Ứng 20.000đ & sửa máy" });
  await advance.click();
  await expect(dialog.getByRole("alert")).toContainText("Cần cập nhật Edge Function game");
  expect(backend.users.get("repair@example.test")!.state.debt).toBe(0);

  deployed = true;
  await dialog.getByRole("button", { name: "Tải lại tiến trình online" }).click();
  await advance.click();
  await expect(dialog).toHaveCount(0);
  const { state } = backend.users.get("repair@example.test")!;
  expect(state.money).toBe(0);
  expect(state.debt).toBe(20000);
  expect(state.incidents?.machineBroken).toBe(false);
});
test("account contract: failed cloud load never enters a guest game, and wrong login reports failure", async ({
  page,
  context,
}) => {
  const backend = service();
  await backend.install(context);
  await page.goto("/");
  await page.getByLabel("Email", { exact: false }).fill("missing@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email hoặc mật khẩu chưa đúng",
  );
  await expect(page.locator(".game")).toHaveCount(0);
  await page.getByRole("button", { name: "Đăng ký ngay", exact: true }).click();
  await page.getByLabel("Tên chủ quán", { exact: false }).fill("Chủ Tiệm An");
  await page.getByLabel("Email", { exact: false }).fill("an@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await page
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("KhongTrung123");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("chưa trùng khớp");
  await expect(page.locator(".game")).toHaveCount(0);
  await page
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("TiemTraMay123!");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("TiemTraMay123!");
  await context.route(
    "https://may-test.supabase.co/functions/v1/game",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
  );
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.locator(".game")).toHaveCount(0);
  await expect(page.locator(".account-full")).toBeVisible();
});
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [1440, 900],
])
  test(`login and register real UI screenshots ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Đăng ký ngay", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `screenshots/accounts-login-${width}x${height}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Đăng ký ngay", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Tạo tài khoản", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `screenshots/accounts-register-${width}x${height}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test('registration requiring email confirmation gives clear next steps and does not pretend the user is signed in',async({page,context})=>{
 const backend=service();await backend.install(context);
 await context.route('https://may-test.supabase.co/auth/v1/signup',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'pending-confirmation'}})}));
 await page.goto('/');await page.getByRole('button',{name:'Đăng ký ngay',exact:true}).click();await page.getByLabel('Tên chủ quán',{exact:false}).fill('Chủ Tiệm An');await page.getByLabel('Email',{exact:false}).fill('an@example.test');await page.getByLabel('Mật khẩu',{exact:true}).fill('TiemTraMay123!');await page.getByLabel('Xác nhận mật khẩu',{exact:true}).fill('TiemTraMay123!');await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu đăng ký');await expect(page.getByRole('status')).toContainText('email xác nhận');await expect(page.locator('.game')).toHaveCount(0);
});
