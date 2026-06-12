import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";
import {
    createInitialWorkbenchState,
    saveWorkbenchState
} from "../screens/god-workbench/model.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

const createAlmostSelectedRound = () => ({
    ...createInitialWorkbenchState(),
    round: { ...createInitialWorkbenchState().round, theme: "夏日" },
    participants: [{ id: "p1", name: "白榆" }, { id: "p2", name: "北桥" }],
    wishes: [
        { id: "w1", ownerId: "p1", body: "想收到一份小惊喜", status: "approved" },
        { id: "w2", ownerId: "p2", body: "想让工作日不普通", status: "approved" }
    ],
    selectionOrder: ["p1", "p2"],
    activeSelectionIndex: 1,
    assignments: [{ angelId: "p1", wishId: "w2" }],
    completionByParticipantId: { p1: "unseen", p2: "unseen" }
});

describe("god workbench blind selection", () => {
    beforeEach(() => window.localStorage.clear());

    it("moves to completion after the final blind selection even when selection was focused manually", () => {
        saveWorkbenchState(createAlmostSelectedRound());
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('[data-section-target="select"]').click();
            root.querySelector('[data-action="select-wish"][data-wish-id="w1"]').click();

            expect(root.querySelector(".god-workbench__grid > .god-workbench__panel").classList.contains("god-workbench__panel--completion")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });
});
