import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";
import {
    addWish,
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

    it("copies the wish collection followup from the wish panel", async () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, theme: "毕业季" }
        });
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true
        });

        const root = mountWorkbench();
        root.querySelector('[data-action="copy-wish-followup"]').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writeText).toHaveBeenCalledWith("还差 北桥、小满、林舟、青柚 的愿望。");
        expect(root.textContent).toContain("已复制催愿望");
    });

    it("keeps missing members ready in the wish ledger", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, theme: "毕业季" }
        });

        const root = mountWorkbench();
        const missingForm = [...root.querySelectorAll('form[data-form="wish"]')]
            .find((form) => form.textContent.includes("北桥"));

        expect(missingForm.querySelector('input[name="ownerId"]').value).toBe("p2");
        expect(missingForm.querySelector('textarea[name="body"]').value).toBe("");
    });

    it("does not show manual selection adjustment before wishes are complete", () => {
        const newRound = startNewRound(createSampleWorkbenchState());
        saveWorkbenchState({
            ...addWish(newRound, { ownerId: "p1", body: "想要一张毕业照" }),
            round: { ...newRound.round, theme: "毕业季" }
        });

        expect(mountWorkbench().querySelector(".god-workbench__panel--manual")).toBeNull();
    });

    it("continues from completed wish entry into blind selection", () => {
        saveWorkbenchState(createSampleWorkbenchState());
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('[data-section-target="wishes"]').click();
            root.querySelector(".god-workbench__stage-next").click();

            const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
            expect(firstPanel.classList.contains("god-workbench__panel--select")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("does not start blind selection for a one-person round", () => {
        saveWorkbenchState({
            ...createInitialWorkbenchState(),
            round: { ...createInitialWorkbenchState().round, theme: "毕业季" },
            participants: [{ id: "p1", name: "山川" }],
            wishes: [{ id: "w1", ownerId: "p1", body: "想收到一张毕业合照", status: "approved" }],
            selectionOrder: ["p1"],
            completionByParticipantId: { p1: "unseen" }
        });
        const root = mountWorkbench();

        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        expect(firstPanel.querySelector(".god-workbench__stage-next")).toBeNull();
        expect(root.querySelector(".god-workbench__panel--manual")).toBeNull();
    });
});
