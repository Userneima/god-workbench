import { describe, expect, it } from "vitest";
import { mountChannelIntelligenceBlock } from "../blocks/channel-intelligence/index.js";
import { createStore } from "../shared/state/store.js";
import {
    createChannelIntelligenceActions,
    setApprovedOwnerContext
} from "./support/channel-intelligence-fixtures.js";

describe("channel intelligence sidebar", () => {
    it("preserves theme input focus across rerenders", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                themeEditorOpen: true,
                draftTheme: "A"
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        const themeInput = root.querySelector("[data-channel-intelligence-ref='theme-input']");
        themeInput.focus();
        themeInput.value = "AI";
        themeInput.setSelectionRange(2, 2);

        store.dispatch({
            type: "round-management/set-field",
            payload: { draftTheme: "AI" }
        });
        block.render();

        const nextThemeInput = root.querySelector("[data-channel-intelligence-ref='theme-input']");
        expect(document.activeElement).toBe(nextThemeInput);
        expect(nextThemeInput.value).toBe("AI");
        expect(nextThemeInput.selectionStart).toBe(2);
        expect(nextThemeInput.selectionEnd).toBe(2);

        root.remove();
        dialogRoot.remove();
    });

    it("renders the richer round panel content in the sidebar", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("当前回合");
        expect(root.textContent).not.toContain("国王与天使");
        expect(root.textContent).toContain("本周上帝");
        expect(root.textContent).toContain("当前阶段");
        expect(root.textContent).toContain("我的待办");
        expect(root.textContent).not.toContain("进入回合管理");
        expect(root.textContent).not.toContain("改轮次名");
        expect(root.textContent).not.toContain("指定上帝");
        expect(root.textContent).not.toContain("设定主题");

        root.remove();
        dialogRoot.remove();
    });

    it("shows round management controls only for approved admins", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("改轮次名");
        expect(root.textContent).toContain("指定上帝");
        expect(root.textContent).toContain("设定主题");

        root.remove();
        dialogRoot.remove();
    });

    it("wires the current round rename action", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);
        store.dispatch({
            type: "round/set-current-round",
            payload: {
                round: {
                    id: "round-1",
                    lifecycleStatus: "active",
                    title: "2026.05.13 · 解压",
                    defaultTitle: "2026.05.13 · 解压",
                    theme: "解压",
                    currentStage: "wish",
                    deadlines: {},
                    revealMap: {}
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        root.querySelector("[data-channel-intelligence-action='rename-current-round']")?.click();
        expect(actions.renameCurrentRound).toHaveBeenCalledTimes(1);

        root.remove();
        dialogRoot.remove();
    });

    it("shows reveal summary inline when reveal results exist", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        store.dispatch({
            type: "runtime/update-channel",
            payload: {
                channel: {
                    currentRoundStage: "reveal",
                    currentRevealMap: {
                        章鱼烧: {
                            member: { name: "章鱼烧", avatar: "octopus-avatar" },
                            angel: { name: "海屿", avatar: "haiyu-avatar" },
                            guessedAngelName: "海屿"
                        }
                    }
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("揭晓结果");
        expect(root.textContent).toContain("已生成 1 对揭晓结果");

        root.remove();
        dialogRoot.remove();
    });

    it("shows proxy wish task copy when the current user was recorded by the god", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "member@example.com" }
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                directoryItems: [],
                directoryStatus: "idle",
                directoryError: null,
                mutationStatus: "idle",
                activeMemberId: null,
                reviewStatus: "idle",
                submitStatus: "idle",
                error: null
            }
        });
        store.dispatch({
            type: "runtime/update-identity",
            payload: {
                identity: {
                    id: "identity-1",
                    name: "章鱼烧",
                    role: "member"
                }
            }
        });
        store.dispatch({
            type: "round/set-current-round",
            payload: {
                round: {
                    id: "round-1",
                    lifecycleStatus: "active",
                    title: "解压",
                    defaultTitle: "2026.05.13 · 解压",
                    theme: "解压",
                    currentStage: "wish",
                    deadlines: {},
                    revealMap: {},
                    godProfile: {
                        userId: "user-god",
                        name: "海屿",
                        avatar: "god-avatar"
                    }
                }
            }
        });
        store.dispatch({
            type: "round/set-member-statuses",
            payload: {
                items: [{
                    identityId: "identity-1",
                    userId: "user-1",
                    name: "章鱼烧",
                    wishSubmitted: true,
                    wishSubmissionSource: "proxy",
                    wishRecordedByName: "海屿"
                }]
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).toContain("上帝已代你记录本轮愿望");
        expect(root.textContent).toContain("海屿 已帮你补录愿望");

        root.remove();
        dialogRoot.remove();
    });

    it("opens the wish deadline editor when clicking the deadline action", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        root.querySelector("[data-channel-intelligence-action='toggle-deadline-editor']")?.click();
        expect(actions.toggleRoundDeadlineEditor).toHaveBeenCalledTimes(1);

        store.dispatch({
            type: "round-management/set-field",
            payload: {
                deadlineEditorOpen: true,
                draftDeadlines: {
                    wish: {
                        deadlineAt: "2026-05-13T14:00:00.000Z"
                    }
                }
            }
        });
        block.render();

        expect(root.querySelector("[data-channel-intelligence-ref='wish-deadline-input']")).toBeTruthy();

        root.remove();
        dialogRoot.remove();
    });
});
