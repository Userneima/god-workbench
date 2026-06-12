import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildRevealMarkdown,
    createInitialWorkbenchState,
    getAvailableWishes,
    mountGodWorkbenchPage,
    selectWishForCurrentAngel
} from "../screens/god-workbench/index.js";
import {
    addParticipant,
    addWish,
    archiveCurrentRound,
    buildBlindChoiceText,
    buildCompletionFollowup,
    buildCompletionReminder,
    buildRevealAnnouncement,
    buildRevealSvg,
    buildRevealTsv,
    buildThemeAnnouncement,
    createSampleWorkbenchState,
    getDefaultRoundDeadlines,
    getStageCounts,
    loadWorkbenchState,
    moveWish,
    restoreArchivedRound,
    saveWorkbenchState,
    setManualAssignment,
    startNewRound,
    updateRoundField,
} from "../screens/god-workbench/model.js";

const fullAssignments = [["p1", "w2"], ["p2", "w3"], ["p3", "w4"], ["p4", "w5"], ["p5", "w1"]].map(([angelId, wishId]) => ({ angelId, wishId }));

const saveAssignedRound = (status) => {
    const state = createSampleWorkbenchState();
    saveWorkbenchState({
        ...state,
        activeSelectionIndex: state.selectionOrder.length,
        assignments: fullAssignments,
        completionByParticipantId: Object.fromEntries(state.participants.map((participant) => [participant.id, status]))
    });
};

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

const mountSampleWorkbench = () => {
    saveWorkbenchState(createSampleWorkbenchState());
    return mountWorkbench();
};
const openStage = (root, target) => root.querySelector(`[data-section-target="${target}"]`).click();

const createThemedNewRound = () => {
    const newRound = startNewRound(createSampleWorkbenchState());
    return { ...newRound, round: { ...newRound.round, theme: "毕业季" } };
};

describe("god workbench", () => {
    beforeEach(() => window.localStorage.clear());

    it("renders the host flow sections", () => {
        const root = mountSampleWorkbench();
        [
            "上帝工作台", "名单", "本轮", "发主题", "截图盲选",
            "成员名单", "录愿望", "截图给 白榆", "看完成", "生成揭晓", "复制给 白榆"
        ].forEach((text) => expect(root.textContent).toContain(text));
        ["复制 JSON", "导入 JSON", "实物", "线下", "太难"]
            .forEach((text) => expect(root.textContent).not.toContain(text));
    });

    it("starts first-time use at member setup instead of fake roster data", () => {
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--members")).toBe(true);
        expect(firstPanel.classList.contains("god-workbench__panel--focus-support")).toBe(true);
        expect(firstPanel.textContent).toContain("成员名单");
        expect(firstPanel.textContent).not.toContain("白榆");
        expect(root.querySelector('[data-section-target="wishes"]').textContent).toContain("0/0");
    });

    it("puts theme setup first when a new round has no theme", () => {
        saveWorkbenchState(startNewRound(createSampleWorkbenchState()));
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--theme")).toBe(true);
        expect(firstPanel.textContent).toContain("发主题");
    });

    it("puts wish entry first after the theme is set", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        expect(firstPanel.textContent).toContain("录愿望");
    });

    it("puts completion first after blind selection is finished", () => {
        saveAssignedRound("unseen");
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--completion")).toBe(true);
        expect(firstPanel.textContent).toContain("看完成");
    });

    it("puts reveal first after every wish is marked complete", () => {
        saveAssignedRound("done");
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--reveal")).toBe(true);
        expect(firstPanel.textContent).toContain("生成揭晓");
    });

    it("keeps destructive round actions behind the more menu", () => {
        const root = mountWorkbench();
        const moreMenu = root.querySelector(".god-workbench__more");
        expect(moreMenu.textContent).toContain("归档");
        expect(moreMenu.textContent).toContain("新一轮");
        expect(moreMenu.textContent).toContain("清空");
        expect(root.querySelector(".god-workbench__rail-actions").textContent.trim()).toBe("");
    });

    it("opens low-frequency panels from the more menu", () => {
        const root = mountSampleWorkbench();
        expect(root.querySelector(".god-workbench__panel--round")).toBeNull();
        openStage(root, "round");
        expect(root.querySelector(".god-workbench__panel--round .god-workbench__compact-panel").open).toBe(true);
        openStage(root, "archives");
        expect(root.querySelector(".god-workbench__panel--archives .god-workbench__compact-panel").open).toBe(true);
    });

    it("hides manual adjustment until selection needs intervention", () => {
        const root = mountSampleWorkbench();

        const exceptionPanel = root.querySelector(".god-workbench__exception-panel");
        expect(exceptionPanel).toBeNull();
    });

    it("offers a forced swap when the current angel only has their own wish left", () => {
        const state = {
            ...createInitialWorkbenchState(),
            participants: [{ id: "p1", name: "白榆" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }],
            wishes: [
                { id: "w1", ownerId: "p1", body: "想收到一份小惊喜", status: "approved" },
                { id: "w2", ownerId: "p2", body: "想有人陪我散步", status: "approved" },
                { id: "w3", ownerId: "p3", body: "想收到一段歌单", status: "approved" }
            ],
            selectionOrder: ["p1", "p2", "p3"],
            activeSelectionIndex: 2,
            assignments: [{ angelId: "p1", wishId: "w2" }, { angelId: "p2", wishId: "w1" }],
            completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen" }
        };
        saveWorkbenchState(state);
        const root = mountWorkbench();
        openStage(root, "select");
        expect(root.querySelector(".god-workbench__blind-list").textContent).toContain("强制交换");
        root.querySelector('[data-action="apply-forced-swap"]').click();
        openStage(root, "wishes");
        expect(root.querySelector(".god-workbench__wish-ledger").textContent).toContain("已被 北桥 选");
        expect(root.querySelector(".god-workbench__wish-ledger").textContent).toContain("已被 小满 选");
    });

    it("still supports manual assignment from the collapsed exception panel", () => {
        const root = mountSampleWorkbench(); root.querySelector('[data-action="select-wish"][data-wish-id="w2"]').click();
        openStage(root, "manual");
        const exceptionPanel = root.querySelector(".god-workbench__exception-panel");
        exceptionPanel.open = true;
        const selector = exceptionPanel.querySelector('[data-action="manual-assignment"][data-angel-id="p2"]');
        selector.value = "w1";
        selector.dispatchEvent(new Event("change", { bubbles: true }));
        openStage(root, "wishes");
        expect(root.querySelector(".god-workbench__wish-ledger-item").textContent).toContain("已被 北桥 选");
    });

    it("uses the left rail as clickable phase navigation", () => {
        const root = document.createElement("div");
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = scrollIntoView;

        try {
            mountGodWorkbenchPage({ root });
            root.querySelector('[data-action="scroll-section"][data-section-target="wishes"]').click();
            const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
            expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
            expect(root.querySelector('[data-section-target="wishes"]').classList.contains("is-active")).toBe(true);
            expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" });
            expect(scrollIntoView).not.toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("renders wishes as an ordered host ledger instead of a data table", () => {
        const root = mountSampleWorkbench();
        openStage(root, "wishes");

        const wishesPanel = root.querySelector(".god-workbench__panel--wishes");
        const firstWish = wishesPanel.querySelector(".god-workbench__wish-ledger-item");
        expect(wishesPanel.querySelector("table")).toBeNull();
        expect(wishesPanel.textContent).toContain("录愿望");
        expect(firstWish.textContent).toContain("第 01 个");
        expect(firstWish.textContent).toContain("白榆");
        expect(firstWish.textContent).toContain("待选");
    });

    it("counts wish collection by submitted members", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();

        expect(root.querySelector('[data-section-target="wishes"]').textContent).toContain("0/5");
        expect(root.querySelector(".god-workbench__wish-progress").textContent).toContain("未收 白榆、北桥、小满、林舟、青柚");
    });

    it("keeps wish entry first until every member has submitted", () => {
        const newRound = createThemedNewRound();
        saveWorkbenchState(addWish({
            ...newRound,
        }, {
            ownerId: "p1",
            body: "想要一张毕业照"
        }));
        const root = mountWorkbench();

        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        expect(root.querySelector('[data-section-target="wishes"]').textContent).toContain("1/5");
    });

    it("updates an existing member wish instead of adding a duplicate", () => {
        const state = createSampleWorkbenchState();
        const nextState = addWish(state, {
            ownerId: "p1",
            body: "想要一张新的明信片"
        });

        expect(nextState.wishes).toHaveLength(5);
        expect(nextState.wishes.find((wish) => wish.ownerId === "p1").body).toBe("想要一张新的明信片");
        expect(getStageCounts(nextState).wish).toBe(5);
        expect(nextState.toast).toBe("已更新");
    });

    it("hides the current angel's own wish from the blind selection list", () => {
        const root = mountSampleWorkbench();

        const blindListText = root.querySelector(".god-workbench__blind-list").textContent;
        expect(blindListText).not.toContain("想收到一份和夏天有关的小惊喜");
    });

    it("renders a screenshot-safe blind choice card without king names", () => {
        const root = mountSampleWorkbench();

        const cardText = root.querySelector(".god-workbench__screenshot-card").textContent;
        expect(root.querySelector(".god-workbench__panel--select").textContent).toContain("截图给 白榆");
        expect(cardText).toContain("请选择一个愿望");
        expect(cardText).toContain("A");
        expect(cardText).toContain("想让一个普通工作日变得没那么普通");
        expect(cardText).not.toContain("白榆");
        expect(cardText).not.toContain("北桥");
        const blindChoiceText = buildBlindChoiceText(createSampleWorkbenchState());
        expect(root.querySelector('[data-action="copy-blind-choice"]')).not.toBeNull();
        expect(blindChoiceText).toContain("A. 想让一个普通工作日变得没那么普通");
        expect(blindChoiceText).not.toContain("北桥");
    });

    it("records a blind selection and advances the queue", () => {
        const state = createSampleWorkbenchState();
        const [firstChoice] = getAvailableWishes(state);
        const nextState = selectWishForCurrentAngel(state, firstChoice.id);

        expect(nextState.assignments).toEqual([{
            angelId: "p1",
            wishId: firstChoice.id
        }]);
        expect(nextState.activeSelectionIndex).toBe(1);
    });

    it("moves wish order and updates the blind selection queue", () => {
        const state = createSampleWorkbenchState();
        const movedState = moveWish(state, "w2", "up");

        expect(movedState.wishes.map((wish) => wish.id).slice(0, 2)).toEqual(["w2", "w1"]);
        expect(movedState.selectionOrder.slice(0, 2)).toEqual(["p2", "p1"]);
    });

    it("updates the visible queue when god reorders wishes in the ledger", () => {
        const root = mountSampleWorkbench();
        openStage(root, "wishes");
        root.querySelector('[data-action="move-wish-up"][data-wish-id="w2"]').click();
        openStage(root, "select");

        expect(root.querySelector(".god-workbench__panel--select").textContent).toContain("截图给 北桥");
        expect(root.querySelector(".god-workbench__blind-list").textContent).not.toContain("想让一个普通工作日变得没那么普通");
        expect(root.querySelector(".god-workbench__blind-list").textContent).toContain("想收到一份和夏天有关的小惊喜");
    });

    it("returns the previous angel's own wish on the next screenshot card", () => {
        const root = mountSampleWorkbench();
        root.querySelector('[data-action="select-wish"][data-wish-id="w2"]').click();

        const blindListText = root.querySelector(".god-workbench__blind-list").textContent;
        expect(root.querySelector(".god-workbench__panel--select").textContent).toContain("截图给 北桥");
        expect(blindListText).toContain("想收到一份和夏天有关的小惊喜");
        expect(blindListText).not.toContain("想让一个普通工作日变得没那么普通");
        root.querySelector('[data-action="undo-selection"]').click();
        expect(root.querySelector(".god-workbench__panel--select").textContent).toContain("截图给 白榆");
        expect(root.querySelector(".god-workbench__blind-list").textContent).toContain("想让一个普通工作日变得没那么普通");
    });

    it("shows the latest blind selection result for the host", () => {
        const root = mountSampleWorkbench();
        root.querySelector('[data-action="select-wish"][data-wish-id="w2"]').click();

        const latestAssignment = root.querySelector(".god-workbench__latest-assignment");
        expect(latestAssignment.textContent).toContain("刚选中");
        expect(latestAssignment.textContent).toContain("白榆 -> 北桥");
        expect(latestAssignment.textContent).toContain("想让一个普通工作日变得没那么普通");
        expect(root.querySelector(".god-workbench__screenshot-card").textContent).not.toContain("北桥");
    });

    it("copies the latest angel notice", async () => {
        const root = document.createElement("div");
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true
        });

        saveWorkbenchState(createSampleWorkbenchState());
        mountGodWorkbenchPage({ root });
        root.querySelector('[data-action="select-wish"][data-wish-id="w2"]').click();
        root.querySelector('[data-action="copy-angel-notice"]').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writeText).toHaveBeenCalledWith("你选到的是：北桥\n愿望：想让一个普通工作日变得没那么普通");
        expect(root.textContent).toContain("已复制通知");
    });

    it("exports reveal rows as markdown", () => {
        const state = createSampleWorkbenchState();
        const nextState = selectWishForCurrentAngel(state, "w2");
        const markdown = buildRevealMarkdown(nextState);

        expect(markdown).toContain("| 序号 | 愿望 | 国王 | 天使 | 完成 |");
        expect(markdown).toContain("| 1 | 想让一个普通工作日变得没那么普通 | 北桥 | 白榆 |");
        expect(buildRevealAnnouncement(nextState)).toBe("第 04 轮「夏日」国王与天使揭晓");
    });

    it("renders completion as an endgame observation board", () => {
        const root = mountSampleWorkbench();
        openStage(root, "completion");

        const completionPanel = root.querySelector(".god-workbench__panel--completion");
        expect(completionPanel.textContent).toContain("看完成");
        expect(completionPanel.textContent).toContain("提醒名单");
        expect(completionPanel.textContent).toContain("待确认");
        expect(completionPanel.textContent).toContain("已完成");
        expect(completionPanel.textContent).toContain("复制提醒");
        expect(completionPanel.textContent).toContain("白榆");
        completionPanel.querySelector('[data-action="cycle-completion"][data-participant-id="p1"]').click();
        expect(root.querySelector(".god-workbench__panel--completion").textContent).toContain("可能完成");
    });

    it("generates and copies a completion followup with the reminder list", async () => {
        const root = mountSampleWorkbench();
        openStage(root, "completion");
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true
        });

        root.querySelector('[data-action="copy-completion-followup"]').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(buildCompletionFollowup(createSampleWorkbenchState())).toContain("待确认：白榆、北桥、小满、青柚");
        expect(writeText).toHaveBeenCalledWith("还没完成国王愿望的抓紧了哦，我们快要开始猜人了。\n待确认：白榆、北桥、小满、青柚");
        expect(root.textContent).toContain("已复制提醒");
    });

    it("renders reveal as a publishable table while keeping export actions", () => {
        const root = mountSampleWorkbench();
        openStage(root, "reveal");

        const revealPanel = root.querySelector(".god-workbench__panel--reveal");
        expect(revealPanel.querySelector(".god-workbench__reveal-table")).not.toBeNull();
        expect(revealPanel.querySelector(".god-workbench__reveal-table").textContent).toContain("想收到一份和夏天有关的小惊喜");
        expect(revealPanel.textContent).toContain("复制文案");
        expect(revealPanel.textContent).toContain("复制 Markdown");
        expect(revealPanel.textContent).toContain("复制 Excel");
        expect(revealPanel.textContent).toContain("导出图片");
    });

    it("exports reveal rows as spreadsheet-friendly tsv", () => {
        const state = createSampleWorkbenchState();
        const nextState = selectWishForCurrentAngel(state, "w2");
        const tsv = buildRevealTsv(nextState);

        expect(tsv.split("\n")[0]).toBe("序号\t愿望\t国王\t天使\t完成");
        expect(tsv).toContain("1\t想让一个普通工作日变得没那么普通\t北桥\t白榆");
    });

    it("exports reveal rows as a downloadable image svg", () => {
        const svg = buildRevealSvg(selectWishForCurrentAngel(createSampleWorkbenchState(), "w2"));

        expect(svg).toContain("<svg");
        expect(svg).toContain("国王与天使揭晓");
        expect(svg).toContain("北桥");
        expect(svg).toContain("白榆");
    });

    it("persists and restores local workbench state", () => {
        const state = addParticipant(createInitialWorkbenchState(), "山川");

        saveWorkbenchState(state);
        const restored = loadWorkbenchState();

        expect(restored.participants.some((participant) => participant.name === "山川")).toBe(true);
    });

    it("keeps the shared member roster when clearing the round", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] textarea[name="name"]').value = "山川";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        expect(root.textContent).toContain("山川");
        root.querySelector('[data-action="clear-local"]').click();
        openStage(root, "members");
        expect(root.textContent).toContain("山川");
        openStage(root, "wishes");
        expect(root.querySelector(".god-workbench__wish-ledger").textContent).toContain("山川");
    });

    it("generates reusable god messages from the theme", () => {
        const state = {
            ...createInitialWorkbenchState(),
            round: {
                ...createInitialWorkbenchState().round,
                theme: "毕业季",
                wishDeadline: "明天5点前"
            }
        };

        expect(buildThemeAnnouncement(state)).toBe("本周主题：毕业季\n请各位国王明天5点前将愿望发送给我哦");
        expect(buildCompletionReminder()).toBe("还没完成国王愿望的抓紧了哦，我们快要开始猜人了。");
    });

    it("resets round deadlines from the theme date", () => {
        const state = updateRoundField(createInitialWorkbenchState(), "themeSetDate", "2026-06-11");
        const defaults = getDefaultRoundDeadlines("2026-06-11");

        expect(state.round.wishDeadline).toBe("明天5点前");
        expect(state.round.finishDeadline).toBe(defaults.finishDeadline);
        expect(state.round.revealAt).toBe(defaults.revealAt);
    });

    it("adds a wish and supports manual assignment without self-pairing", () => {
        const baseState = addParticipant(createSampleWorkbenchState(), "山川");
        const ownerId = baseState.participants.at(-1).id;
        const angelId = baseState.participants[1].id;
        const withWish = addWish(baseState, {
            ownerId,
            body: "想要一张手写明信片"
        });
        const addedWish = withWish.wishes.at(-1);
        const assigned = setManualAssignment(withWish, angelId, addedWish.id);
        const selfAssigned = setManualAssignment(withWish, ownerId, addedWish.id);

        expect(addedWish.status).toBe("approved");
        expect(assigned.assignments).toContainEqual({ angelId, wishId: addedWish.id });
        expect(selfAssigned.toast).toBe("不可配对");
    });

    it("archives and restores rounds", () => {
        const archived = archiveCurrentRound(selectWishForCurrentAngel(createSampleWorkbenchState(), "w2"));
        const restored = restoreArchivedRound(archived, archived.archives[0].id);

        expect(archived.archives).toHaveLength(1);
        expect(restored.assignments).toHaveLength(1);
        expect(restored.toast).toBe("已恢复");
    });

    it("records wishes from the visible wish form", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();
        const northBridgeForm = [...root.querySelectorAll('form[data-form="wish"]')]
            .find((form) => form.textContent.includes("北桥"));

        northBridgeForm.querySelector('textarea[name="body"]').value = "想收到一张拍立得";
        northBridgeForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(root.textContent).toContain("北桥");
        expect(root.textContent).toContain("想收到一张拍立得");
    });

});
