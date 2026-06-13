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

const createRoundWithGod = () => {
    const newRound = startNewRound(createSampleWorkbenchState());
    return { ...newRound, round: { ...newRound.round, god: "白榆" } };
};

describe("god workbench theme setup", () => {
    beforeEach(() => window.localStorage.clear());

    it("stays on theme setup after entering a theme so the copy is visible", () => {
        saveWorkbenchState(createRoundWithGod());
        const root = mountWorkbench();
        const themeInput = root.querySelector('[data-field="theme"]');

        themeInput.value = "毕业季";
        themeInput.dispatchEvent(new Event("change", { bubbles: true }));

        const themePanel = root.querySelector(".god-workbench__panel--theme");
        expect(themePanel).not.toBeNull();
        expect(themePanel.textContent).toContain("本周主题：毕业季");
        expect([...themePanel.querySelectorAll(".god-workbench__preview-variable")].map((node) => node.textContent)).toEqual(["毕业季", "明天5点前"]);
        expect(themePanel.querySelector('[data-action="copy-theme-announcement"]')).not.toBeNull();
        expect(themePanel.querySelector('[data-action="copy-completion-reminder"]')).toBeNull();
        expect(themePanel.textContent).not.toContain("还没完成国王愿望");
    });

    it("does not render legacy next-step buttons between visible stage panels", () => {
        saveWorkbenchState(createRoundWithGod());
        const root = mountWorkbench();
        const godSelect = root.querySelector(".god-workbench__panel--god select");
        const themeInput = root.querySelector('[data-field="theme"]');

        godSelect.value = "白榆";
        godSelect.dispatchEvent(new Event("change", { bubbles: true }));
        themeInput.value = "毕业季";
        themeInput.dispatchEvent(new Event("change", { bubbles: true }));

        expect(root.querySelector(".god-workbench__stage-next")).toBeNull();
    });

    it("edits timeline copy from the theme setup panel", () => {
        saveWorkbenchState({
            ...createRoundWithGod(),
            round: {
                ...createRoundWithGod().round,
                theme: "夏日"
            }
        });
        const root = mountWorkbench();
        const themePanel = root.querySelector(".god-workbench__panel--theme");
        const wishDeadlineInput = themePanel.querySelector('[data-field="wishDeadline"]');

        wishDeadlineInput.value = "今晚8点前";
        wishDeadlineInput.dispatchEvent(new Event("change", { bubbles: true }));

        const updatedPanel = root.querySelector(".god-workbench__panel--theme");
        expect(updatedPanel).not.toBeNull();
        expect(updatedPanel.textContent).toContain("请各位国王今晚8点前将愿望发送给我哦");
    });

    it("starts a new round with default timeline values", () => {
        const nextRound = startNewRound(createSampleWorkbenchState());
        const defaults = getDefaultRoundDeadlines(nextRound.round.themeSetDate);

        expect(nextRound.round.god).toBe("");
        expect(nextRound.round.theme).toBe("");
        expect(nextRound.round.wishDeadline).toBe(defaults.wishDeadline);
        expect(nextRound.round.finishDeadline).toBe(defaults.finishDeadline);
        expect(nextRound.round.revealAt).toBe(defaults.revealAt);
    });

    it("keeps custom timeline values when renaming the theme", () => {
        const state = {
            ...createRoundWithGod(),
            round: {
                ...createRoundWithGod().round,
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
