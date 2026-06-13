import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildAngelNotice,
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
    buildRevealCsv,
    buildRevealSvg,
    buildRevealTsv,
    buildSingleWishReminder,
    buildThemeAnnouncement,
    createSampleWorkbenchState,
    getCurrentAngel,
    getDefaultRoundDeadlines,
    getStageCounts,
    loadWorkbenchState,
    moveWish,
    moveWishToIndex,
    restoreArchivedRound,
    saveWorkbenchState,
    startNewRound,
    updateRoundField,
    wouldSelectionCauseConflict,
} from "../screens/god-workbench/model.js";

const fullAssignments = [["p2", "w3"], ["p3", "w4"], ["p4", "w5"], ["p5", "w2"]].map(([angelId, wishId]) => ({ angelId, wishId }));

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
const openStage = (root, target) => {
    const btn = root.querySelector(`[data-action="scroll-stage"][data-stage="${target}"]`);
    if (btn) { btn.click(); return; }
    const util = root.querySelector(`.god-workbench__utility-item[data-utility="${target}"]`);
    if (util) util.open = true;
};

const createThemedNewRound = () => {
    const newRound = startNewRound(createSampleWorkbenchState());
    return { ...newRound, round: { ...newRound.round, god: "白榆", theme: "毕业季" } };
};

const createConflictChoiceState = () => ({
    ...createInitialWorkbenchState(),
    round: { ...createInitialWorkbenchState().round, god: "上帝", theme: "测试" },
    participants: [{ id: "p1", name: "上帝" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }, { id: "p4", name: "林舟" }],
    wishes: [
        { id: "w2", ownerId: "p2", body: "北桥的愿望", status: "approved" },
        { id: "w3", ownerId: "p3", body: "小满的愿望", status: "approved" },
        { id: "w4", ownerId: "p4", body: "林舟的愿望", status: "approved" }
    ],
    selectionOrder: ["p2", "p3", "p4"],
    activeSelectionIndex: 1,
    assignments: [{ angelId: "p2", wishId: "w3" }],
    completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen", p4: "unseen" }
});

describe("god workbench", () => {
    beforeEach(() => window.localStorage.clear());

    it("renders the host flow sections", () => {
        const root = mountSampleWorkbench();
        [
            "G", "名单", "本轮", "发主题",
            "愿望表", "看完成", "生成揭晓"
        ].forEach((text) => expect(root.textContent).toContain(text));
        expect(root.querySelector(".god-workbench__brand").getAttribute("aria-label")).toBe("上帝工作台");
        expect(root.querySelector(".god-workbench__members-toggle").textContent).toContain("成员");
        ["复制 JSON", "导入 JSON", "实物", "线下", "太难"]
            .forEach((text) => expect(root.textContent).not.toContain(text));
    });

    it("starts first-time use at member setup instead of fake roster data", () => {
        const root = mountWorkbench();
        const activeRow = root.querySelector(".god-workbench__stage-row.is-active");
        expect(activeRow.dataset.stage).toBe("members");
        expect(activeRow.textContent).toContain("成员名单");
        expect(activeRow.textContent).not.toContain("白榆");
    });

    it("keeps the workbench usable without cloud login", async () => {
        const root = mountWorkbench();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const activeRow = root.querySelector(".god-workbench__stage-row.is-active");
        expect(activeRow.dataset.stage).toBe("members");
        expect(root.textContent).not.toContain("请先登录");
        const dataItem = root.querySelector('.god-workbench__utility-item[data-utility="data"]');
        dataItem.open = true;
        expect(dataItem.textContent).toContain("本地保存");
    });

    it("asks for the round god before theme setup when members already exist", () => {
        saveWorkbenchState(startNewRound(createSampleWorkbenchState()));
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--god")).toBe(true);
        expect(firstPanel.textContent).toContain("本轮的上帝，你是谁？");
        expect(firstPanel.querySelector(".god-workbench__setting-field--inline [data-field='god']")).not.toBeNull();
        expect(firstPanel.querySelector('[data-field="god"]').tagName).toBe("SELECT");
    });

    it("continues to theme setup after choosing the round god", () => {
        saveWorkbenchState(startNewRound(createSampleWorkbenchState()));
        const root = mountWorkbench();
        const godSelect = root.querySelector('.god-workbench__panel--god [data-field="god"]');

        godSelect.value = "白榆";
        godSelect.dispatchEvent(new Event("change", { bubbles: true }));

        const activeRow = root.querySelector(".god-workbench__stage-row.is-active");
        expect(activeRow.dataset.stage).toBe("theme");
        expect(activeRow.textContent).toContain("发主题");
    });

    it("puts theme setup first after the round god is selected", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({ ...newRound, round: { ...newRound.round, god: "白榆" } });
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--theme")).toBe(true);
        expect(firstPanel.textContent).toContain("发主题");
    });

    it("puts wish entry first after the theme is set", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        expect(firstPanel.textContent).toContain("愿望表");
    });

    it("puts completion first after blind selection is finished", () => {
        saveAssignedRound("pending");
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--completion")).toBe(true);
        expect(firstPanel.textContent).toContain("完成状况记录");
    });

    it("puts reveal first after every wish is marked complete", () => {
        saveAssignedRound("done");
        const root = mountWorkbench();
        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--reveal")).toBe(true);
        expect(firstPanel.textContent).toContain("生成揭晓");
    });

    it("keeps destructive round actions behind the more menu", () => {
        const root = mountWorkbench();
        const moreMenu = root.querySelector(".god-workbench__more");
        expect(moreMenu.textContent).toContain("归档本轮");
        expect(moreMenu.textContent).toContain("开新一轮");
        expect(moreMenu.textContent).toContain("清空本地");
        expect(moreMenu.open).toBe(false);
    });

    it("opens low-frequency panels from the utility bar", () => {
        const root = mountSampleWorkbench();
        const archiveItem = root.querySelector('.god-workbench__utility-item[data-utility="archives"]');
        expect(archiveItem.open).toBe(false);
        archiveItem.open = true;
        expect(archiveItem.querySelector(".god-workbench__archive-list")).not.toBeNull();
        const dataItem = root.querySelector('.god-workbench__utility-item[data-utility="data"]');
        expect(dataItem.open).toBe(false);
        dataItem.open = true;
        expect(dataItem.textContent).toContain("本地保存");
    });

    it("offers a forced swap when the current angel only has their own wish left", () => {
        const state = {
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, theme: "测试" },
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
        expect(root.querySelector(".god-workbench__swap-card").textContent).toContain("强制交换");
        root.querySelector('[data-action="apply-forced-swap"]').click();
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("北桥");
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("小满");
    });

    it("uses the stepper as clickable phase navigation", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = document.createElement("div");
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = scrollIntoView;

        try {
            mountGodWorkbenchPage({ root });
            const stepBtn = root.querySelector('[data-action="scroll-stage"][data-stage="wishes"]');
            expect(stepBtn).not.toBeNull();
            stepBtn.click();
            expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("renders wishes as a unified table", () => {
        const state = createSampleWorkbenchState();
        saveWorkbenchState({ ...state, wishes: [state.wishes[1]] });
        const root = mountWorkbench();
        openStage(root, "wishes");

        const wishesPanel = root.querySelector(".god-workbench__panel--wishes");
        const rows = [...wishesPanel.querySelectorAll(".god-workbench__wish-row")];
        expect(wishesPanel.querySelector(".god-workbench__wish-table")).not.toBeNull();
        expect(wishesPanel.textContent).toContain("愿望表");
        expect(wishesPanel.querySelector("thead").textContent).toContain("许愿顺序");
        expect(rows[0].textContent).toContain("小满");
        expect(rows[0].querySelector(".god-workbench__wish-num").textContent.trim()).toBe("");
        expect(rows[0].querySelector('textarea[name="body"]').getAttribute("placeholder")).toBe("输入他的愿望，按回车录入");
        expect(rows[0].querySelector('textarea[name="body"]').getAttribute("rows")).toBe("1");
        const submittedRow = rows.find((row) => row.textContent.includes("北桥"));
        expect(submittedRow.querySelector(".god-workbench__wish-num").textContent).toContain("01");
        expect(submittedRow.querySelector(".god-workbench__wish-status").textContent).toContain("待选择");
    });

    it("counts wish collection by submitted members", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();

        expect(root.querySelector('[data-action="scroll-stage"][data-stage="wishes"]').textContent).toContain("0/4");
        expect(root.querySelector(".god-workbench__wish-progress").textContent).toContain("未收 北桥、小满、林舟、青柚");
    });

    it("allows blind selection before every member has submitted once two wishes exist", () => {
        const newRound = createThemedNewRound();
        const oneWishState = addWish(newRound, { ownerId: "p2", body: "想要一张毕业照" });
        saveWorkbenchState(addWish(oneWishState, { ownerId: "p3", body: "想要一首歌" }));
        const root = mountWorkbench();

        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        expect(firstPanel.textContent).toContain("截图给 北桥");
        expect(firstPanel.querySelector('[data-action="select-wish"]')).not.toBeNull();
        expect(firstPanel.textContent).toContain("未收 林舟、青柚");
    });

    it("updates an existing member wish instead of adding a duplicate", () => {
        const state = createSampleWorkbenchState();
        const nextState = addWish(state, {
            ownerId: "p2",
            body: "想要一张新的明信片"
        });

        expect(nextState.wishes).toHaveLength(5);
        expect(nextState.wishes.find((wish) => wish.ownerId === "p2").body).toBe("想要一张新的明信片");
        expect(getStageCounts(nextState).wish).toBe(4);
        expect(nextState.toast).toBe("已更新");
    });

    it("hides the current angel's own wish from the blind selection list", () => {
        const root = mountSampleWorkbench();

        const ownRow = root.querySelector(".god-workbench__wish-row.is-own");
        expect(ownRow).not.toBeNull();
        expect(ownRow.querySelector(".god-workbench__wish-name").textContent).toContain("北桥");
        expect(ownRow.querySelector(".god-workbench__wish-body").textContent).not.toContain("选");
        expect(ownRow.querySelector(".god-workbench__wish-status").textContent).toContain("本人愿望");
    });

    it("renders a screenshot-safe wish table with selection controls", () => {
        const root = mountSampleWorkbench();

        const panel = root.querySelector(".god-workbench__panel--wishes");
        expect(panel.textContent).toContain("截图给 北桥");
        expect(panel.querySelector(".god-workbench__wish-table")).not.toBeNull();
        expect(panel.querySelector(".god-workbench__wish-table thead").textContent).toContain("给北桥选择");
        expect(panel.querySelector('[data-action="select-wish"]').textContent).toContain("记录选择");
        expect(panel.querySelector('[data-action="select-wish"]').getAttribute("aria-label")).toBe("记录 北桥 选择这个愿望");
        expect(panel.querySelector(".god-workbench__selection-bar")).not.toBeNull();
        expect(panel.querySelector('[data-action="copy-blind-choice"]')).not.toBeNull();
        const blindChoiceText = buildBlindChoiceText(createSampleWorkbenchState());
        expect(blindChoiceText).toContain("A. 想有人陪我完成一次城市散步");
        expect(blindChoiceText).not.toContain("想让一个普通工作日变得没那么普通");
    });

    it("records a blind selection and advances the queue", () => {
        const state = createSampleWorkbenchState();
        const [firstChoice] = getAvailableWishes(state);
        const nextState = selectWishForCurrentAngel(state, firstChoice.id);

        expect(nextState.assignments).toEqual([{
            angelId: "p2",
            wishId: firstChoice.id
        }]);
        expect(nextState.activeSelectionIndex).toBe(1);
    });

    it("does not auto-scroll after recording a blind selection", () => {
        saveWorkbenchState(createSampleWorkbenchState());
        const root = mountWorkbench();
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = scrollIntoView;

        try {
            root.querySelector('[data-action="select-wish"]').click();
            expect(scrollIntoView).not.toHaveBeenCalled();
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("appends late wishes to the remaining blind selection queue", () => {
        const baseState = {
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, god: "上帝", theme: "测试" },
            participants: [{ id: "p1", name: "上帝" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }, { id: "p4", name: "林舟" }],
            wishes: [
                { id: "w2", ownerId: "p2", body: "北桥的愿望", status: "approved" },
                { id: "w3", ownerId: "p3", body: "小满的愿望", status: "approved" }
            ],
            selectionOrder: ["p2", "p3"],
            activeSelectionIndex: 2,
            assignments: [{ angelId: "p2", wishId: "w3" }, { angelId: "p3", wishId: "w2" }],
            completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen", p4: "unseen" }
        };

        const nextState = addWish(baseState, { ownerId: "p4", body: "林舟的愿望" });

        expect(nextState.selectionOrder).toEqual(["p2", "p3", "p4"]);
        expect(nextState.activeSelectionIndex).toBe(2);
        expect(getCurrentAngel(nextState).name).toBe("林舟");
    });

    it("blocks blind choices that would make later assignment impossible", () => {
        const state = createConflictChoiceState();

        expect(getAvailableWishes(state).map((wish) => wish.id)).toEqual(["w4"]);
        expect(wouldSelectionCauseConflict(state, "w2")).toBe(true);

        const blockedState = selectWishForCurrentAngel(state, "w2");
        expect(blockedState.assignments).toEqual([{ angelId: "p2", wishId: "w3" }]);
        expect(blockedState.toast).toBe("会导致冲突");
    });

    it("blocks the last angel from leaving an unassigned wish behind", () => {
        const state = {
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, god: "上帝", theme: "测试" },
            participants: [{ id: "p1", name: "上帝" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }, { id: "p4", name: "林舟" }],
            wishes: [
                { id: "w2", ownerId: "p2", body: "北桥的愿望", status: "approved" },
                { id: "w3", ownerId: "p3", body: "小满的愿望", status: "approved" },
                { id: "w4", ownerId: "p4", body: "林舟的愿望", status: "approved" }
            ],
            selectionOrder: ["p2", "p3", "p4"],
            activeSelectionIndex: 2,
            assignments: [{ angelId: "p2", wishId: "w3" }],
            completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen", p4: "unseen" }
        };

        expect(getAvailableWishes(state)).toEqual([]);
        expect(wouldSelectionCauseConflict(state, "w2")).toBe(true);

        const blockedState = selectWishForCurrentAngel(state, "w2");
        expect(blockedState.assignments).toEqual([{ angelId: "p2", wishId: "w3" }]);
        expect(blockedState.toast).toBe("会导致冲突");
    });

    it("keeps recovery controls visible when completed selection still has unassigned wishes", () => {
        saveWorkbenchState({
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, god: "上帝", theme: "测试" },
            participants: [{ id: "p1", name: "上帝" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }, { id: "p4", name: "林舟" }],
            wishes: [
                { id: "w2", ownerId: "p2", body: "北桥的愿望", status: "approved" },
                { id: "w3", ownerId: "p3", body: "小满的愿望", status: "approved" },
                { id: "w4", ownerId: "p4", body: "林舟的愿望", status: "approved" }
            ],
            selectionOrder: ["p2", "p3", "p4"],
            activeSelectionIndex: 3,
            assignments: [{ angelId: "p2", wishId: "w3" }],
            completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen", p4: "unseen" }
        });
        const root = mountWorkbench();

        expect(root.querySelector(".god-workbench__selection-bar").textContent).toContain("选择完成");
        expect(root.querySelector('[data-action="undo-selection"]').disabled).toBe(false);
        expect(root.querySelector('[data-action="reset-selection"]').disabled).toBe(false);
    });

    it("renders conflict-prone blind choices as disabled status buttons", () => {
        saveWorkbenchState(createConflictChoiceState());
        const root = mountWorkbench();

        const conflictRow = root.querySelector('[data-wish-row-id="w2"]');
        const safeRow = root.querySelector('[data-wish-row-id="w4"]');

        expect(conflictRow.querySelector("button:disabled").textContent).toContain("会冲突");
        expect(conflictRow.querySelector('[data-action="select-wish"]')).toBeNull();
        expect(safeRow.querySelector('[data-action="select-wish"]').textContent).toContain("记录选择");
    });

    it("moves wish order and updates the blind selection queue", () => {
        const state = createSampleWorkbenchState();
        const movedState = moveWishToIndex(state, "w2", 0);

        expect(movedState.wishes.map((wish) => wish.id).slice(0, 2)).toEqual(["w2", "w1"]);
        expect(movedState.selectionOrder.slice(0, 2)).toEqual(["p2", "p3"]);
    });

    it("updates the visible queue when god drags wishes in the table", () => {
        const state = createSampleWorkbenchState();
        saveWorkbenchState({ ...state, wishes: state.wishes.slice(0, 3) });
        const root = mountWorkbench();
        openStage(root, "wishes");

        const handle = root.querySelector('.god-workbench__wish-drag[data-wish-id="w2"]');
        const targetRow = root.querySelector('[data-wish-row-id="w3"]');
        const dataTransfer = {
            value: "",
            setData(_type, value) {
                this.value = value;
            },
            getData() {
                return this.value;
            },
            setDragImage() {}
        };
        handle.dispatchEvent(new Event("dragstart", { bubbles: true }));
        targetRow.dispatchEvent(Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer }));

        expect(root.querySelector(".god-workbench__panel--wishes").textContent).toContain("截图给 小满");
        const northBridgeRow = root.querySelector('[data-wish-row-id="w2"]');
        const littleFullRow = root.querySelector('[data-wish-row-id="w3"]');
        expect(northBridgeRow.querySelector(".god-workbench__wish-num").textContent).toContain("02");
        expect(littleFullRow.querySelector(".god-workbench__wish-num").textContent).toContain("01");
    });

    it("builds a single wish reminder from the editable template", () => {
        const state = {
            ...createSampleWorkbenchState(),
            round: {
                ...createSampleWorkbenchState().round,
                theme: "毕业季",
                wishReminderTemplate: "某某，这周主题是：XX，你还没许愿哦。"
            }
        };

        expect(buildSingleWishReminder(state, "p2")).toBe("北桥，这周主题是：毕业季，你还没许愿哦。");
    });

    it("returns the previous angel's own wish after undoing a selection", () => {
        const root = mountSampleWorkbench();
        root.querySelector('[data-action="select-wish"][data-wish-id="w3"]').click();

        expect(root.querySelector(".god-workbench__panel--wishes").textContent).toContain("截图给 小满");
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("想让一个普通工作日变得没那么普通");
        root.querySelector('[data-action="undo-selection"]').click();
        expect(root.querySelector(".god-workbench__panel--wishes").textContent).toContain("截图给 北桥");
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("想有人陪我完成一次城市散步");
    });

    it("shows the angel assignment in the table after a blind selection", () => {
        const root = mountSampleWorkbench();
        root.querySelector('[data-action="select-wish"][data-wish-id="w3"]').click();

        const statusCell = root.querySelector(".god-workbench__wish-table tbody .god-workbench__wish-status");
        expect(statusCell).not.toBeNull();
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("天使 北桥");
    });

    it("moves already selected wishes to the bottom during blind selection", () => {
        const root = mountSampleWorkbench();
        root.querySelector('[data-action="select-wish"][data-wish-id="w3"]').click();

        const rows = [...root.querySelectorAll(".god-workbench__wish-table tbody .god-workbench__wish-row")];
        const lastRow = rows.at(-1);
        expect(lastRow.getAttribute("data-wish-row-id")).toBe("w3");
        expect(lastRow.querySelector(".god-workbench__wish-status").textContent).toContain("天使 北桥");
        expect(rows[0].querySelector('[data-action="select-wish"]').textContent).toContain("记录选择");
    });

    it("builds the angel notice text for the last selection", () => {
        const state = selectWishForCurrentAngel(createSampleWorkbenchState(), "w3");
        const notice = buildAngelNotice(state);

        expect(notice).toBe("你选到的是：小满\n愿望：想有人陪我完成一次城市散步");
    });

    it("exports reveal rows as markdown", () => {
        const state = createSampleWorkbenchState();
        const nextState = selectWishForCurrentAngel(state, "w3");
        const markdown = buildRevealMarkdown(nextState);

        expect(markdown).toContain("| 序号 | 国王 | 愿望 | 天使 | 愿望完成状态 |");
        expect(markdown).toContain("| 1 | 小满 | 想有人陪我完成一次城市散步 | 北桥 |");
        expect(buildRevealAnnouncement(nextState)).toBe("第 04 轮「夏日」国王与天使揭晓");
    });

    it("folds legacy completion statuses into unfinished", () => {
        const state = createSampleWorkbenchState();
        saveWorkbenchState({
            ...state,
            completionByParticipantId: {
                p1: "unseen",
                p2: "possible",
                p3: "remind",
                p4: "done",
                p5: "pending"
            }
        });

        const restoredState = loadWorkbenchState();
        expect(restoredState.completionByParticipantId.p1).toBe("pending");
        expect(restoredState.completionByParticipantId.p2).toBe("pending");
        expect(restoredState.completionByParticipantId.p3).toBe("pending");
        expect(restoredState.completionByParticipantId.p4).toBe("done");
    });

    it("renders completion as a compact done-or-not board", () => {
        const root = mountSampleWorkbench();
        openStage(root, "completion");

        const completionPanel = root.querySelector(".god-workbench__panel--completion");
        expect(completionPanel.textContent).toContain("完成状况记录");
        expect(completionPanel.textContent).toContain("未完成");
        expect(completionPanel.textContent).toContain("已完成");
        expect(completionPanel.textContent).not.toContain("未观察到");
        expect(completionPanel.textContent).not.toContain("可能完成");
        expect(completionPanel.textContent).not.toContain("需提醒");
        expect(completionPanel.textContent).toContain("复制待确认提醒");
        expect(completionPanel.textContent).toContain("北桥");
        expect(completionPanel.textContent).not.toContain("白榆");
        expect(completionPanel.querySelectorAll('[data-action="set-completion"][data-participant-id="p2"]')).toHaveLength(2);
        completionPanel.querySelector('[data-action="set-completion"][data-participant-id="p2"][data-status="done"]').click();
        expect(root.querySelector('[data-action="set-completion"][data-participant-id="p2"][data-status="done"]').getAttribute("aria-pressed")).toBe("true");
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

        expect(buildCompletionFollowup(createSampleWorkbenchState())).toBe("还没完成国王愿望的抓紧了哦，我们快要开始猜人了。");
        expect(writeText).toHaveBeenCalledWith("还没完成国王愿望的抓紧了哦，我们快要开始猜人了。");
        expect(root.textContent).toContain("已复制提醒");
    });

    it("renders reveal as a publishable table while keeping export actions", () => {
        const root = mountSampleWorkbench();
        openStage(root, "reveal");

        const revealPanel = root.querySelector(".god-workbench__panel--reveal");
        expect(revealPanel.querySelector(".god-workbench__reveal-table")).not.toBeNull();
        expect([...revealPanel.querySelectorAll(".god-workbench__reveal-table th")].map((th) => th.textContent)).toEqual([
            "序号",
            "国王",
            "愿望",
            "天使",
            "愿望完成状态"
        ]);
        expect(revealPanel.querySelector(".god-workbench__reveal-table thead").textContent).toContain("愿望完成状态");
        expect(revealPanel.querySelector(".god-workbench__reveal-table").textContent).toContain("想让一个普通工作日变得没那么普通");
        expect(revealPanel.textContent).toContain("复制文案");
        expect(revealPanel.textContent).toContain("复制 Markdown");
        expect(revealPanel.textContent).toContain("复制 Excel");
        expect(revealPanel.textContent).toContain("导出图片");
    });

    it("exports reveal rows as spreadsheet-friendly tsv", () => {
        const state = createSampleWorkbenchState();
        const nextState = selectWishForCurrentAngel(state, "w3");
        const tsv = buildRevealTsv(nextState);

        expect(tsv.split("\n")[0]).toBe("序号\t国王\t愿望\t天使\t愿望完成状态");
        expect(tsv).toContain("1\t小满\t想有人陪我完成一次城市散步\t北桥");
        expect(buildRevealCsv(nextState).split("\n")[0]).toBe("\"序号\",\"国王\",\"愿望\",\"天使\",\"愿望完成状态\"");
    });

    it("exports reveal rows as a downloadable image svg", () => {
        const svg = buildRevealSvg(selectWishForCurrentAngel(createSampleWorkbenchState(), "w3"));

        expect(svg).toContain("<svg");
        expect(svg).toContain("国王与天使揭晓");
        expect(svg).toContain("北桥");
        expect(svg).toContain("小满");
    });

    it("persists and restores local workbench state", () => {
        const state = addParticipant(createInitialWorkbenchState(), "山川");

        saveWorkbenchState(state);
        const restored = loadWorkbenchState();

        expect(restored.participants.some((participant) => participant.name === "山川")).toBe(true);
    });

    it("keeps the shared member roster when clearing the round", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] input[name="name"]').value = "山川";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        expect(root.textContent).toContain("山川");
        root.querySelector('[data-action="clear-local"]').click();
        root.querySelector('[data-action="toggle-members"]').click();
        expect(root.querySelector(".god-workbench__members-overlay-panel").textContent).toContain("山川");
        openStage(root, "wishes");
        expect(root.querySelector(".god-workbench__wish-table").textContent).toContain("山川");
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

    it("adds a wish to a newly added round player", () => {
        const baseState = addParticipant(createSampleWorkbenchState(), "山川");
        const ownerId = baseState.participants.at(-1).id;
        const withWish = addWish(baseState, {
            ownerId,
            body: "想要一张手写明信片"
        });
        const addedWish = withWish.wishes.at(-1);

        expect(addedWish.status).toBe("approved");
        expect(addedWish.ownerId).toBe(ownerId);
    });

    it("archives and restores rounds", () => {
        const archived = archiveCurrentRound(selectWishForCurrentAngel(createSampleWorkbenchState(), "w3"));
        const restored = restoreArchivedRound(archived, archived.archives[0].id);

        expect(archived.archives).toHaveLength(1);
        expect(restored.assignments).toHaveLength(1);
        expect(restored.toast).toBe("已恢复");
    });

    it("records wishes from the visible wish form", () => {
        saveWorkbenchState(createThemedNewRound());
        const root = mountWorkbench();
        const northBridgeRow = [...root.querySelectorAll(".god-workbench__wish-row")]
            .find((row) => row.textContent.includes("北桥"));
        const form = northBridgeRow.querySelector('form[data-form="wish"]');

        form.querySelector('textarea[name="body"]').value = "想收到一张拍立得";
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(root.textContent).toContain("北桥");
        expect(root.textContent).toContain("想收到一张拍立得");
    });

});
