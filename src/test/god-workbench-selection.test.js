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
    round: { ...createInitialWorkbenchState().round, god: "白榆", theme: "夏日" },
    participants: [{ id: "p1", name: "白榆" }, { id: "p2", name: "北桥" }, { id: "p3", name: "小满" }],
    wishes: [
        { id: "w1", ownerId: "p1", body: "想收到一份小惊喜", status: "approved" },
        { id: "w2", ownerId: "p2", body: "想让工作日不普通", status: "approved" },
        { id: "w3", ownerId: "p3", body: "想完成一次散步", status: "approved" }
    ],
    selectionOrder: ["p2", "p3"],
    activeSelectionIndex: 1,
    assignments: [{ angelId: "p2", wishId: "w3" }],
    completionByParticipantId: { p1: "unseen", p2: "unseen", p3: "unseen" }
});

describe("god workbench blind selection", () => {
    beforeEach(() => window.localStorage.clear());

    it("moves to completion after the final blind selection even when selection was focused manually", () => {
        saveWorkbenchState(createAlmostSelectedRound());
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('[data-action="scroll-stage"][data-stage="wishes"]').click();
            root.querySelector('[data-action="select-wish"][data-wish-id="w2"]').click();

            expect(root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel").classList.contains("god-workbench__panel--completion")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });
});
