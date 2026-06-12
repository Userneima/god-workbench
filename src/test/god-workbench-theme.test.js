import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";
import {
    createSampleWorkbenchState,
    getDefaultRoundDeadlines,
    saveWorkbenchState,
    startNewRound,
    updateRoundField
} from "../screens/god-workbench/model.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

describe("god workbench theme setup", () => {
    beforeEach(() => window.localStorage.clear());

    it("stays on theme setup after entering a theme so the copy is visible", () => {
        saveWorkbenchState(startNewRound(createSampleWorkbenchState()));
        const root = mountWorkbench();
        const themeInput = root.querySelector('[data-field="theme"]');

        themeInput.value = "毕业季";
        themeInput.dispatchEvent(new Event("change", { bubbles: true }));

        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--theme")).toBe(true);
        expect(firstPanel.textContent).toContain("本周主题：毕业季");
        expect(firstPanel.querySelector('[data-action="copy-theme-announcement"]')).not.toBeNull();
        expect(firstPanel.querySelector('[data-action="copy-completion-reminder"]')).toBeNull();
        expect(firstPanel.textContent).not.toContain("还没完成国王愿望");
    });

    it("continues from theme setup into wish entry", () => {
        saveWorkbenchState(startNewRound(createSampleWorkbenchState()));
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            const themeInput = root.querySelector('[data-field="theme"]');
            themeInput.value = "毕业季";
            themeInput.dispatchEvent(new Event("change", { bubbles: true }));

            root.querySelector(".god-workbench__stage-next").click();

            const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
            expect(firstPanel.classList.contains("god-workbench__panel--wishes")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("edits timeline copy from the theme setup panel", () => {
        saveWorkbenchState({
            ...startNewRound(createSampleWorkbenchState()),
            round: {
                ...startNewRound(createSampleWorkbenchState()).round,
                theme: "夏日"
            }
        });
        const root = mountWorkbench();
        root.querySelector('[data-section-target="theme"]').click();
        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        const wishDeadlineInput = firstPanel.querySelector('[data-field="wishDeadline"]');

        wishDeadlineInput.value = "今晚8点前";
        wishDeadlineInput.dispatchEvent(new Event("change", { bubbles: true }));

        const updatedPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(updatedPanel.classList.contains("god-workbench__panel--theme")).toBe(true);
        expect(updatedPanel.textContent).toContain("请各位国王今晚8点前将愿望发送给我哦");
    });

    it("starts a new round with default timeline values", () => {
        const nextRound = startNewRound(createSampleWorkbenchState());
        const defaults = getDefaultRoundDeadlines(nextRound.round.themeSetDate);

        expect(nextRound.round.theme).toBe("");
        expect(nextRound.round.wishDeadline).toBe(defaults.wishDeadline);
        expect(nextRound.round.finishDeadline).toBe(defaults.finishDeadline);
        expect(nextRound.round.revealAt).toBe(defaults.revealAt);
    });

    it("keeps custom timeline values when renaming the theme", () => {
        const state = {
            ...startNewRound(createSampleWorkbenchState()),
            round: {
                ...startNewRound(createSampleWorkbenchState()).round,
                wishDeadline: "今晚8点前",
                finishDeadline: "周日 20:00",
                revealAt: "周日 21:00"
            }
        };
        const renamed = updateRoundField(state, "theme", "毕业季");

        expect(renamed.round.wishDeadline).toBe("今晚8点前");
        expect(renamed.round.finishDeadline).toBe("周日 20:00");
        expect(renamed.round.revealAt).toBe("周日 21:00");
    });
});
