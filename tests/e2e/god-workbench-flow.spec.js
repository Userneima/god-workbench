import { expect, test } from "@playwright/test";

const storageKey = "soulmap.god-workbench.v2";

const clearWorkbenchStorage = async (page) => {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
};

const addMembers = async (page, names) => {
    await page.getByRole("button", { name: /成员 \d+人/ }).click();
    const input = page.getByLabel("花名");
    await input.fill(names.join("、"));
    await input.press("Enter");
    await expect(page.getByRole("button", { name: new RegExp(`成员 ${names.length}人`) })).toBeVisible();
    await page.getByRole("button", { name: "关闭" }).click();
};

const setGod = async (page, name) => {
    await page.getByLabel("本轮上帝").first().selectOption(name);
    await expect(page.locator(".god-workbench__round-context")).toContainText(`上帝 ${name}`);
};

const setTheme = async (page, theme) => {
    const themeInput = page.locator("[data-input='round'][data-field='theme']");
    await themeInput.fill(theme);
    await themeInput.blur();
    await expect(page.locator(".god-workbench__message-card--theme")).toContainText(`本周主题：${theme}`);
};

const wishRow = (page, name) => (
    page.locator(".god-workbench__wish-row").filter({
        has: page.locator(".god-workbench__wish-name", { hasText: name })
    }).first()
);

const enterWish = async (page, name, body) => {
    const row = wishRow(page, name);
    await row.locator("textarea[name='body']").fill(body);
    await row.locator("textarea[name='body']").press("Enter");
    await expect(wishRow(page, name)).toContainText(body);
};

const chooseWishOwnedBy = async (page, name) => {
    const beforeY = await page.evaluate(() => window.scrollY);
    await wishRow(page, name).getByRole("button", { name: /记录 .+ 选择这个愿望/ }).click();
    await expect(wishRow(page, name).locator(".god-workbench__status-pill")).toContainText("天使");
    const afterY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterY - beforeY)).toBeLessThanOrEqual(2);
};

const storedState = async (page) => (
    page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), storageKey)
);

test.beforeEach(async ({ page }) => {
    await clearWorkbenchStorage(page);
    await page.goto("/?view=god-workbench");
});

test("host can complete one full round through the real UI", async ({ page }) => {
    await addMembers(page, ["上帝", "瓜子", "雯子", "阿豹"]);
    await setGod(page, "上帝");
    await setTheme(page, "毕业季");

    await enterWish(page, "瓜子", "想收到一张毕业合照");
    await enterWish(page, "雯子", "想听到毕业季最难忘的故事");
    await enterWish(page, "阿豹", "想让天使推荐一份毕业礼物");

    await chooseWishOwnedBy(page, "雯子");
    await page.getByRole("button", { name: "撤回" }).click();
    await expect(wishRow(page, "雯子").getByRole("button", { name: /记录 .+ 选择这个愿望/ })).toBeVisible();

    await chooseWishOwnedBy(page, "雯子");
    await chooseWishOwnedBy(page, "阿豹");
    await chooseWishOwnedBy(page, "瓜子");

    await expect(page.locator(".god-workbench__selection-bar")).toContainText("选择完成");
    await expect(page.locator(".god-workbench__selection-actions").getByRole("button", { name: "撤回" })).toBeEnabled();
    await expect(page.locator(".god-workbench__selection-actions").getByRole("button", { name: "重置" })).toBeEnabled();

    const completionRows = page.locator(".god-workbench__completion-row");
    await expect(completionRows).toHaveCount(3);
    await completionRows.filter({ hasText: "瓜子" }).getByRole("button", { name: "已完成" }).click();
    await completionRows.filter({ hasText: "阿豹" }).getByRole("button", { name: "已完成" }).click();
    await expect(page.locator(".god-workbench__panel--completion .god-workbench__actions")).toContainText("2/3 已完成");

    await expect(page.locator(".god-workbench__reveal-table thead")).toContainText("序号");
    await expect(page.locator(".god-workbench__reveal-table thead")).toContainText("国王");
    await expect(page.locator(".god-workbench__reveal-table thead")).toContainText("愿望完成状态");
    await expect(page.locator(".god-workbench__reveal-table tbody tr")).toHaveCount(3);
    await expect(page.locator(".god-workbench__reveal-table tbody")).toContainText("天使");

    await page.getByRole("button", { name: "归档本轮" }).click();
    await expect(page.getByText("归档 1轮")).toBeVisible();

    const state = await storedState(page);
    expect(state.round.god).toBe("上帝");
    expect(state.round.theme).toBe("毕业季");
    expect(state.wishes).toHaveLength(3);
    expect(state.assignments).toHaveLength(3);
    expect(state.archives).toHaveLength(1);
});

test("accidental god changes after selection do not destroy wishes or assignments", async ({ page }) => {
    await addMembers(page, ["上帝", "瓜子", "雯子", "阿豹"]);
    await setGod(page, "上帝");
    await setTheme(page, "毕业季");
    await enterWish(page, "瓜子", "想收到一张毕业合照");
    await enterWish(page, "雯子", "想听到毕业季最难忘的故事");
    await enterWish(page, "阿豹", "想让天使推荐一份毕业礼物");
    await chooseWishOwnedBy(page, "雯子");
    await chooseWishOwnedBy(page, "阿豹");
    await chooseWishOwnedBy(page, "瓜子");

    await setGod(page, "瓜子");
    await expect(page.locator(".god-workbench__reveal-table tbody tr")).toHaveCount(2);
    await setGod(page, "上帝");

    await expect(page.locator(".god-workbench__reveal-table tbody tr")).toHaveCount(3);
    await expect(wishRow(page, "雯子").locator(".god-workbench__status-pill")).toContainText("天使 瓜子");
    await expect(wishRow(page, "阿豹").locator(".god-workbench__status-pill")).toContainText("天使 雯子");
    await expect(wishRow(page, "瓜子").locator(".god-workbench__status-pill")).toContainText("天使 阿豹");

    const state = await storedState(page);
    expect(state.wishes).toHaveLength(3);
    expect(state.assignments).toHaveLength(3);
});

test("selection can start before every player submits and late wishes append safely", async ({ page }) => {
    await addMembers(page, ["上帝", "瓜子", "雯子", "阿豹", "饼干"]);
    await setGod(page, "上帝");
    await setTheme(page, "毕业季");
    await enterWish(page, "瓜子", "想收到一张毕业合照");
    await enterWish(page, "雯子", "想听到毕业季最难忘的故事");

    await chooseWishOwnedBy(page, "雯子");
    let state = await storedState(page);
    expect(state.selectionOrder.map((id) => state.participants.find((participant) => participant.id === id)?.name)).toEqual(["瓜子", "雯子"]);
    expect(state.assignments).toHaveLength(1);

    await enterWish(page, "阿豹", "想让天使推荐一份毕业礼物");
    state = await storedState(page);
    expect(state.selectionOrder.map((id) => state.participants.find((participant) => participant.id === id)?.name)).toEqual(["瓜子", "雯子", "阿豹"]);
    expect(state.assignments).toHaveLength(1);
    await expect(page.locator(".god-workbench__queue-dot")).toContainText(["瓜子", "雯子", "阿豹"]);
});
