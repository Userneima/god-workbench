import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

describe("god workbench member setup", () => {
    beforeEach(() => window.localStorage.clear());

    it("keeps member setup focused while adding the first members", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] textarea[name="name"]').value = "山川";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        const firstPanel = root.querySelector(".god-workbench__grid > .god-workbench__panel");
        expect(firstPanel.classList.contains("god-workbench__panel--members")).toBe(true);
        expect(firstPanel.querySelector(".god-workbench__compact-panel").open).toBe(true);
        expect(firstPanel.textContent).toContain("山川");
        expect(root.querySelector('[data-section-target="members"]').textContent).toContain("1");
    });

    it("adds multiple members from a pasted list", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] textarea[name="name"]').value = "白榆\n北桥、 小满";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(root.textContent).toContain("白榆");
        expect(root.textContent).toContain("北桥");
        expect(root.textContent).toContain("小满");
        expect(root.querySelector('[data-section-target="members"]').textContent).toContain("3");
    });

    it("can continue from member setup into theme setup", () => {
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('form[data-form="participant"] textarea[name="name"]').value = "山川";
            root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

            root.querySelector(".god-workbench__stage-next").click();

            expect(root.querySelector(".god-workbench__grid > .god-workbench__panel").classList.contains("god-workbench__panel--theme")).toBe(true);
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });
});
