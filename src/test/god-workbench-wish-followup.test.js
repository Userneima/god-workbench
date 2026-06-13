import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";
import {
    addWish,
    buildSingleWishReminder,
    buildWishCollectionFollowup,
    createInitialWorkbenchState,
    createSampleWorkbenchState,
    saveWorkbenchState,
    startNewRound
} from "../screens/god-workbench/model.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

describe("god workbench wish followup", () => {
    beforeEach(() => window.localStorage.clear());

    it("builds a wish collection followup from missing members", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        const state = addWish(newRound, {
            ownerId: "p1",
            body: "想要一张毕业照"
        });

        expect(buildWishCollectionFollowup(state)).toBe("还差 北桥、小满、林舟、青柚 的愿望。");
        expect(buildWishCollectionFollowup(createSampleWorkbenchState())).toBe("本轮愿望已收齐。");
    });

    it("copies a single wish reminder from the missing member row", async () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: {
                ...newRound.round,
                god: "白榆",
                theme: "毕业季",
                wishReminderTemplate: "某某，这周主题是：XX，你还没许愿哦。"
            }
        });
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true
        });

        const root = mountWorkbench();
        const northBridgeRow = [...root.querySelectorAll(".god-workbench__wish-row")]
            .find((row) => row.textContent.includes("北桥"));
        northBridgeRow.querySelector('[data-action="copy-single-wish-reminder"]').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writeText).toHaveBeenCalledWith("北桥，这周主题是：毕业季，你还没许愿哦。");
        expect(root.textContent).toContain("已复制催愿望");
    });

    it("keeps the single reminder template editable in the wish panel", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, god: "白榆", theme: "毕业季" }
        });

        const root = mountWorkbench();
        const templateInput = root.querySelector('[data-field="wishReminderTemplate"]');
        expect(templateInput).not.toBeNull();

        templateInput.value = "某某，主题 XX，快许愿。";
        templateInput.dispatchEvent(new Event("change", { bubbles: true }));

        expect(buildSingleWishReminder(JSON.parse(window.localStorage.getItem("soulmap.god-workbench.v2")), "p2")).toBe("北桥，主题 毕业季，快许愿。");
    });

    it("keeps missing members ready in the wish table", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, god: "白榆", theme: "毕业季" }
        });

        const root = mountWorkbench();
        const northBridgeRow = [...root.querySelectorAll(".god-workbench__wish-row")]
            .find((row) => row.textContent.includes("北桥"));
        const missingForm = northBridgeRow.querySelector('form[data-form="wish"]');

        expect(missingForm.querySelector('input[name="ownerId"]').value).toBe("p2");
        expect(missingForm.querySelector('textarea[name="body"]').value).toBe("");
        expect(northBridgeRow.querySelector(".god-workbench__wish-status").textContent).toContain("复制催愿望");
    });

    it("keeps partial wish entry in collection mode before selection can start", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, god: "白榆", theme: "毕业季" }
        });

        expect(mountWorkbench().querySelector(".god-workbench__wish-progress").textContent).toContain("未收");
    });

    it("continues from completed wish entry into blind selection", () => {
        saveWorkbenchState(createSampleWorkbenchState());
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('[data-action="scroll-stage"][data-stage="wishes"]').click();

            const panel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
            expect(panel.classList.contains("god-workbench__panel--wishes")).toBe(true);
            expect(panel.querySelector(".god-workbench__selection-bar")).not.toBeNull();
            expect(panel.textContent).toContain("截图给 北桥");
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("does not start blind selection for a one-person round", () => {
        saveWorkbenchState({
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, god: "山川", theme: "毕业季" },
            participants: [{ id: "p1", name: "山川" }],
            wishes: [{ id: "w1", ownerId: "p1", body: "想收到一张毕业合照", status: "approved" }],
            selectionOrder: ["p1"],
            completionByParticipantId: { p1: "unseen" }
        });
        const root = mountWorkbench();

        const firstPanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--members")).toBe(true);
    });
});
