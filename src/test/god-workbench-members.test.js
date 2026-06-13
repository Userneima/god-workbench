import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountGodWorkbenchPage } from "../screens/god-workbench/index.js";

const mountWorkbench = () => {
    const root = document.createElement("div");
    mountGodWorkbenchPage({ root });
    return root;
};

const openMembers = (root) => {
    root.querySelector('[data-action="toggle-members"]').click();
};

describe("god workbench member setup", () => {
    beforeEach(() => window.localStorage.clear());

    it("keeps member setup focused while adding the first members", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] input[name="name"]').value = "山川";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        openMembers(root);
        expect(root.querySelector(".god-workbench__members-overlay-panel").textContent).toContain("山川");
        expect(root.querySelector(".god-workbench__members-toggle").textContent).toContain("1人");
    });

    it("adds multiple members from a pasted list", () => {
        const root = mountWorkbench();

        root.querySelector('form[data-form="participant"] input[name="name"]').value = "白榆、北桥、 小满";
        root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(root.textContent).toContain("白榆");
        expect(root.textContent).toContain("北桥");
        expect(root.textContent).toContain("小满");
        expect(root.querySelector(".god-workbench__members-toggle").textContent).toContain("3人");
    });

    it("adds multiple members from a multi-line paste", () => {
        const root = mountWorkbench();
        const input = root.querySelector('form[data-form="participant"] input[name="name"]');
        const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(pasteEvent, "clipboardData", {
            value: {
                getData: () => "白榆\n北桥、 小满"
            }
        });

        input.dispatchEvent(pasteEvent);

        expect(root.textContent).toContain("白榆");
        expect(root.textContent).toContain("北桥");
        expect(root.textContent).toContain("小满");
        expect(root.querySelector(".god-workbench__members-toggle").textContent).toContain("3人");
    });

    it("continues from member setup into round god selection", () => {
        const root = mountWorkbench();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = vi.fn();
        try {
            root.querySelector('form[data-form="participant"] input[name="name"]').value = "山川";
            root.querySelector('form[data-form="participant"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

            const activePanel = root.querySelector(".god-workbench__stage-row.is-active .god-workbench__panel");
            expect(activePanel.classList.contains("god-workbench__panel--god")).toBe(true);
            expect(activePanel.textContent).toContain("本轮的上帝，你是谁？");
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });
});
