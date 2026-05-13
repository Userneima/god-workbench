import { describe, expect, it } from "vitest";
import { mountChannelIntelligenceBlock } from "../blocks/channel-intelligence/index.js";
import { createStore } from "../shared/state/store.js";
import {
    createChannelIntelligenceActions,
    setApprovedOwnerContext
} from "./support/channel-intelligence-fixtures.js";

describe("channel intelligence archive detail", () => {
    it("removes the archive list from the sidebar block but still renders archive detail dialogs", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);
        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-1",
                    title: "玄学测试",
                    theme: "玄学测试",
                    summaryLine: "玄学测试 · 1 对揭晓 · 2026-04-23",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    godProfile: { name: "海屿", avatar: "haiyu-avatar" },
                    stats: {
                        totalMembers: 3,
                        guessDone: 3,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }]
                }]
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-1"
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(root.textContent).not.toContain("往期回合");
        expect(root.textContent).not.toContain("玄学测试");
        expect(root.textContent).not.toContain("1 对揭晓");

        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: { archiveDetailOpen: true }
        });
        block.render();

        expect(dialogRoot.querySelector("[data-channel-intelligence-dialog='archive-detail']")).not.toBeNull();
        expect(dialogRoot.textContent).toContain("希望有人帮我整理玄学学习目录");
        expect(dialogRoot.textContent).toContain("删除记录");
        expect(dialogRoot.textContent).toContain("导出备份");

        root.remove();
        dialogRoot.remove();
    });

    it("uses the same primary archive title style as the left round navigation", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-2",
                    title: "2026.04.23 · 解压",
                    defaultTitle: "2026.04.23 · 解压",
                    theme: "解压",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: { pairCount: 0 },
                    revealPairs: []
                }]
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-2",
                archiveDetailOpen: true
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        expect(dialogRoot.textContent).toContain("解压");
        expect(dialogRoot.textContent).not.toContain("2026.04.23 · 解压");

        root.remove();
        dialogRoot.remove();
    });

    it("wires archive detail actions through the dialog root", () => {
        const root = document.createElement("div");
        const dialogRoot = document.createElement("div");
        document.body.append(root);
        document.body.append(dialogRoot);
        const store = createStore();
        const actions = createChannelIntelligenceActions();

        setApprovedOwnerContext(store);
        store.dispatch({
            type: "round/set-archives",
            payload: {
                items: [{
                    id: "archive-1",
                    title: "玄学测试",
                    theme: "玄学测试",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: {
                        totalMembers: 3,
                        guessDone: 2,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }]
                }]
            }
        });
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: "archive-1",
                archiveDetailOpen: true
            }
        });
        store.dispatch({
            type: "round/set-archive-viewer",
            payload: {
                roundId: null,
                detail: {
                    id: "archive-1",
                    title: "玄学测试",
                    completedAt: "2026-04-23T12:00:00.000Z",
                    stats: {
                        totalMembers: 3,
                        guessDone: 2,
                        pairCount: 1
                    },
                    revealPairs: [{
                        member: { name: "章鱼烧", avatar: "octopus-avatar" },
                        angel: { name: "海屿", avatar: "haiyu-avatar" },
                        wishPreview: "希望有人帮我整理玄学学习目录",
                        guessedAngelName: "海屿"
                    }],
                    posts: []
                }
            }
        });

        const block = mountChannelIntelligenceBlock({ root, dialogRoot, store, actions });
        block.render();

        dialogRoot.querySelector("[data-channel-intelligence-action='delete-archive']").click();
        expect(actions.deleteArchivedRound).toHaveBeenCalled();
        dialogRoot.querySelector("[data-channel-intelligence-action='export-archive']").click();
        expect(actions.exportArchivedRound).toHaveBeenCalled();

        root.remove();
        dialogRoot.remove();
    });
});
