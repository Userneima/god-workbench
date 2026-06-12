import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";
import {
    createSampleWorkbenchState,
    saveWorkbenchState
} from "../screens/god-workbench/model.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};
const openStage = (root, target) => root.querySelector(`[data-section-target="${target}"]`).click();

const createCompletedRound = () => {
    const state = createSampleWorkbenchState();
    return {
        ...state,
        activeSelectionIndex: state.participants.length,
        assignments: [
            { angelId: "p1", wishId: "w2" },
            { angelId: "p2", wishId: "w3" },
            { angelId: "p3", wishId: "w4" },
            { angelId: "p4", wishId: "w5" },
            { angelId: "p5", wishId: "w1" }
        ],
        completionByParticipantId: Object.fromEntries(state.participants.map((participant) => [participant.id, "done"]))
    };
};

describe("god workbench archive", () => {
    beforeEach(() => window.localStorage.clear());

    it("archives the completed round from the reveal panel", () => {
        saveWorkbenchState(createCompletedRound());
        const root = mountWorkbench();
        const revealPanel = root.querySelector(".god-workbench__panel--reveal");

        expect(revealPanel.textContent).toContain("归档本轮");
        revealPanel.querySelector('[data-action="archive-round"]').click();

        expect(root.textContent).toContain("已归档");
        expect(root.querySelector('.god-workbench__panel--reveal [data-action="archive-round"]').textContent).toBe("更新归档");
        openStage(root, "archives");
        expect(root.querySelector(".god-workbench__panel--archives").textContent).toContain("1 轮");
    });

    it("updates the same round archive instead of creating duplicates", () => {
        saveWorkbenchState(createCompletedRound());
        const root = mountWorkbench();
        const archiveButton = root.querySelector('.god-workbench__panel--reveal [data-action="archive-round"]');

        archiveButton.click();
        archiveButton.click();

        openStage(root, "archives");
        expect(root.querySelector(".god-workbench__panel--archives").textContent).toContain("1 轮");
    });

    it("starts the next round from the reveal panel after archiving the current round", () => {
        saveWorkbenchState(createCompletedRound());
        const root = mountWorkbench();

        root.querySelector('.god-workbench__panel--reveal [data-action="new-round"]').click();

        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--theme")).toBe(true);
        expect(root.textContent).toContain("新一轮");
        openStage(root, "archives");
        expect(root.querySelector(".god-workbench__panel--archives").textContent).toContain("1 轮");
    });

    it("returns to theme setup when starting a new round from a focused reveal stage", () => {
        saveWorkbenchState(createCompletedRound());
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('[data-section-target="reveal"]').click();
            root.querySelector('.god-workbench__panel--reveal [data-action="new-round"]').click();

            expect(root.querySelector(".god-workbench__grid > .god-workbench__panel").classList.contains("god-workbench__panel--theme")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });
});
