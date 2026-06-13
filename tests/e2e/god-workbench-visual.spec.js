import { expect, test } from "@playwright/test";

const seedState = {
    version: 2,
    round: {
        code: "01",
        theme: "毕业季",
        god: "章鱼烧",
        themeSetDate: "2026-06-13",
        wishDeadline: "明天5点前",
        finishDeadline: "6月19日 20:00",
        revealAt: "6月19日 21:00",
        wishReminderTemplate: "某某，这周主题是：XX，你还没许愿哦。"
    },
    participants: [
        "雯子",
        "瓜子",
        "阿豹",
        "饼干",
        "章鱼烧",
        "KK",
        "剑",
        "想想",
        "咪咪",
        "苹果",
        "小乌龟",
        "鱼"
    ].map((name, index) => ({ id: `p${index + 1}`, name })),
    wishes: [
        { id: "w1", ownerId: "p1", body: "想听到毕业季你最难忘的那个人和你的故事", status: "approved" },
        { id: "w2", ownerId: "p2", body: "希望天使分享一组最满意的毕业照，可以是单人或者群像，可以先把自己的脸用贴纸贴住，后面再揭晓", status: "approved" },
        { id: "w3", ownerId: "p3", body: "想让天使推荐一份适合毕业季的礼物", status: "approved" },
        { id: "w4", ownerId: "p4", body: "听天使在之前的毕业季中最遗憾的事", status: "approved" },
        { id: "w6", ownerId: "p6", body: "想知道上一次毕业最难忘的故事", status: "approved" },
        { id: "w7", ownerId: "p7", body: "看看天使毕业照的神图", status: "approved" }
    ],
    selectionOrder: ["p1", "p2", "p3", "p4", "p6", "p7"],
    activeSelectionIndex: 2,
    assignments: [
        { angelId: "p1", wishId: "w2" },
        { angelId: "p2", wishId: "w3" }
    ],
    completionByParticipantId: {},
    archives: [],
    toast: ""
};

const storageKey = "soulmap.god-workbench.v2";
const rosterKey = "soulmap.god-workbench.member-roster.v1";

const openSeededWorkbench = async (page, viewport) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(({ state, key, membersKey }) => {
        window.localStorage.setItem(key, JSON.stringify(state));
        window.localStorage.setItem(membersKey, JSON.stringify(state.participants));
    }, { state: seedState, key: storageKey, membersKey: rosterKey });
    await page.goto("/?view=god-workbench");
};

const maxFontSize = async (page, selector) => (
    page.locator(selector).evaluateAll((nodes) => Math.max(...nodes.map((node) => (
        Number.parseFloat(window.getComputedStyle(node).fontSize) || 0
    ))))
);

const bodyHorizontalOverflow = async (page) => (
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
);

test("desktop layout keeps tool typography, sticky topbar, and table headers stable", async ({ page }) => {
    await openSeededWorkbench(page, { width: 1440, height: 900 });

    await expect(page.locator(".god-workbench")).toBeVisible();
    expect(await maxFontSize(page, ".god-workbench input, .god-workbench select, .god-workbench textarea, .god-workbench button, .god-workbench table, .god-workbench__panel h2")).toBeLessThanOrEqual(24);
    expect(await maxFontSize(page, ".god-workbench__message-card p, .god-workbench__preview-lines p")).toBeLessThanOrEqual(20);

    const themeInputs = await page.locator(".god-workbench__theme-inputs").boundingBox();
    const themePreview = await page.locator(".god-workbench__theme-preview").boundingBox();
    expect(themeInputs).not.toBeNull();
    expect(themePreview).not.toBeNull();
    expect(themeInputs.x + themeInputs.width).toBeLessThanOrEqual(themePreview.x);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const topbarBox = await page.locator(".god-workbench__topbar").boundingBox();
    expect(topbarBox.y).toBeLessThanOrEqual(1);

    await expect(page.locator(".god-workbench__reveal-table thead th")).toHaveCount(5);
    const headerStyles = await page.locator(".god-workbench__reveal-table thead th").evaluateAll((nodes) => (
        nodes.map((node) => ({
            text: node.textContent.trim(),
            whiteSpace: window.getComputedStyle(node).whiteSpace,
            height: node.getBoundingClientRect().height
        }))
    ));
    expect(headerStyles.map((item) => item.text)).toEqual(["序号", "国王", "愿望", "天使", "愿望完成状态"]);
    expect(headerStyles.every((item) => item.whiteSpace === "nowrap")).toBe(true);
    expect(headerStyles.every((item) => item.height < 44)).toBe(true);
});

test("narrow viewport keeps primary controls usable without page-level horizontal overflow", async ({ page }) => {
    await openSeededWorkbench(page, { width: 390, height: 844 });

    await expect(page.locator(".god-workbench__topbar")).toBeVisible();
    await expect(page.getByRole("button", { name: /成员 12人/ })).toBeVisible();
    expect(await bodyHorizontalOverflow(page)).toBeLessThanOrEqual(2);
    expect(await maxFontSize(page, ".god-workbench input, .god-workbench select, .god-workbench textarea, .god-workbench button, .god-workbench table, .god-workbench__panel h2")).toBeLessThanOrEqual(24);

    await page.getByRole("button", { name: /成员 12人/ }).click();
    await expect(page.locator(".god-workbench__members-overlay-panel")).toBeVisible();
    const overlayBox = await page.locator(".god-workbench__members-overlay-panel").boundingBox();
    const viewport = page.viewportSize();
    expect(overlayBox.width).toBeLessThanOrEqual(viewport.width);
    expect(overlayBox.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole("button", { name: "关闭" }).click();

    await page.locator("[data-section='wishes']").scrollIntoViewIfNeeded();
    const firstWishTextarea = page.locator(".god-workbench__wish-row-form textarea[name='body']").first();
    await firstWishTextarea.fill("一段比较长的新愿望，用来检查愿望输入框是否会被文字挤坏，同时也要保持表格短列居中。");
    const textareaBox = await firstWishTextarea.boundingBox();
    expect(textareaBox.height).toBeGreaterThanOrEqual(32);
    expect(textareaBox.height).toBeLessThanOrEqual(120);
    expect(await bodyHorizontalOverflow(page)).toBeLessThanOrEqual(2);
});
