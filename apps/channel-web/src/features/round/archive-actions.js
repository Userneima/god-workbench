import { downloadJsonFile, getChannelActionErrorMessage } from "../../shared/lib/helpers.js";

const resetArchiveUi = (store) => {
    store.dispatch({
        type: "round/set-archive-viewer",
        payload: {
            roundId: null,
            detail: null
        }
    });
    store.dispatch({
        type: "channel-intelligence/set-field",
        payload: {
            archiveDetailOpen: false,
            selectedArchiveId: null
        }
    });
};

export const createRoundArchiveActions = ({
    store,
    dataService,
    showToast,
    loadFeed,
    actions,
    canManageRound
}) => ({
    async selectRoundArchive(archiveId) {
        const normalizedArchiveId = String(archiveId || "").trim() || null;
        if (!normalizedArchiveId) {
            resetArchiveUi(store);
            return;
        }

        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: {
                selectedArchiveId: normalizedArchiveId,
                archiveDetailOpen: true
            }
        });

        if (typeof dataService.getArchivedRoundDetail !== "function") {
            return;
        }

        try {
            const detail = await dataService.getArchivedRoundDetail(normalizedArchiveId);
            store.dispatch({
                type: "round/set-archive-viewer",
                payload: {
                    roundId: null,
                    detail
                }
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("load_round_state", error)
            });
        }
    },
    closeArchiveDetail() {
        store.dispatch({
            type: "channel-intelligence/set-field",
            payload: { archiveDetailOpen: false }
        });
    },
    async viewSelectedArchiveInBoard(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
        const normalizedRoundId = String(roundId || "").trim();
        if (!normalizedRoundId || typeof dataService.getArchivedRoundDetail !== "function") {
            return;
        }

        try {
            const detail = await dataService.getArchivedRoundDetail(normalizedRoundId);
            store.dispatch({
                type: "round/set-archive-viewer",
                payload: {
                    roundId: normalizedRoundId,
                    detail
                }
            });
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: {
                    selectedArchiveId: normalizedRoundId,
                    archiveDetailOpen: false
                }
            });
            await loadFeed(store.getState().feedState.activeBoard);
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("load_round_state", error)
            });
        }
    },
    async exitArchiveViewer() {
        resetArchiveUi(store);
        await loadFeed(store.getState().feedState.activeBoard);
    },
    async restoreArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
        const normalizedRoundId = String(roundId || "").trim();
        if (!normalizedRoundId) {
            return;
        }

        try {
            const nextChannel = await dataService.restoreArchivedRound(normalizedRoundId);
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            resetArchiveUi(store);
            await actions.refreshCurrentRound({ silent: true });
            await actions.refreshRoundMemberStatuses({ silent: true });
            await actions.refreshRoundArchives({ silent: true });
            await loadFeed(store.getState().feedState.activeBoard);
            showToast({
                tone: "success",
                message: "归档内容已恢复为当前回合。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_round_state", error)
            });
        }
    },
    async renameArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
        const normalizedRoundId = String(roundId || "").trim();
        if (!normalizedRoundId) {
            return;
        }

        const archive = (store.getState().roundState.archives || []).find((item) => item.id === normalizedRoundId) || null;
        const nextTitle = window.prompt("请输入归档标题", archive?.title || archive?.defaultTitle || "");
        if (nextTitle === null) {
            return;
        }

        try {
            const detail = await dataService.renameArchivedRound(normalizedRoundId, nextTitle);
            store.dispatch({
                type: "round/set-archive-viewer",
                payload: {
                    roundId: normalizedRoundId,
                    detail
                }
            });
            await actions.refreshRoundArchives({ silent: true });
            showToast({
                tone: "success",
                message: "归档标题已更新。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("rename_round_archive", error)
            });
        }
    },
    async exportArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
        const normalizedRoundId = String(roundId || "").trim();
        if (!normalizedRoundId || typeof dataService.getArchivedRoundDetail !== "function") {
            return;
        }

        try {
            const state = store.getState();
            const currentDetail = state.roundState.archiveViewerDetail?.id === normalizedRoundId
                ? state.roundState.archiveViewerDetail
                : null;
            const detail = currentDetail || await dataService.getArchivedRoundDetail(normalizedRoundId);
            if (!detail) {
                throw new Error("当前归档详情还没有加载完成。");
            }

            const channel = state.runtimeState.channel || {};
            const archiveTitle = String(detail.title || detail.theme || detail.defaultTitle || "archive").trim() || "archive";
            const safeTitle = archiveTitle
                .replace(/[\\/:*?"<>|]+/g, "-")
                .replace(/\s+/g, "-")
                .slice(0, 48)
                .replace(/^-+|-+$/g, "") || "archive";
            const completedDate = String(detail.completedAt || detail.createdAt || "").slice(0, 10) || "unknown-date";

            downloadJsonFile(
                `${String(channel.slug || "channel").trim() || "channel"}-${completedDate}-${safeTitle}.json`,
                {
                    exportedAt: new Date().toISOString(),
                    channel: {
                        id: channel.id || null,
                        slug: channel.slug || "",
                        name: channel.name || ""
                    },
                    archive: detail
                }
            );
            showToast({
                tone: "success",
                message: "往期回合备份已导出。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("export_round_archive", error)
            });
        }
    },
    async deleteArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
        const normalizedRoundId = String(roundId || "").trim();
        if (!normalizedRoundId || typeof dataService.deleteArchivedRound !== "function") {
            return;
        }

        const archive = (store.getState().roundState.archives || []).find((item) => item.id === normalizedRoundId) || null;
        const confirmed = window.confirm(
            `删除“${archive?.title || archive?.theme || archive?.defaultTitle || "这条往期回合"}”后，记录不能恢复。确认删除吗？`
        );
        if (!confirmed) {
            return;
        }

        try {
            await dataService.deleteArchivedRound(normalizedRoundId);
            if (store.getState().roundState.archiveViewerRoundId === normalizedRoundId) {
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: null,
                        detail: null
                    }
                });
                await loadFeed(store.getState().feedState.activeBoard);
            }
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: {
                    archiveDetailOpen: false,
                    selectedArchiveId: null
                }
            });
            await actions.refreshRoundArchives({ silent: true });
            showToast({
                tone: "success",
                message: "往期回合记录已删除。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("delete_round_archive", error)
            });
        }
    },
    async startRoundCycle() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能开始新一轮。"
            });
            return;
        }

        if (typeof dataService.archiveCurrentRound !== "function") {
            showToast({
                tone: "error",
                message: "当前环境还没接上真正的新回合创建能力。"
            });
            return;
        }

        try {
            const nextChannel = await dataService.archiveCurrentRound({ mode: "normal" });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await actions.refreshCurrentRound({ silent: true });
            store.dispatch({ type: "round/reset-transient-progress" });
            await actions.refreshRoundMemberStatuses({ silent: true });
            await actions.refreshRoundArchives({ silent: true });
            await loadFeed("wish");
            showToast({
                tone: "success",
                message: "上一轮已归档，当前已切到新一轮。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("archive_round", error)
            });
        }
    },
    async completeRoundCycle() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能结束本轮。"
            });
            return;
        }

        try {
            const nextChannel = typeof dataService.archiveCurrentRound === "function"
                ? await dataService.archiveCurrentRound({ mode: "normal" })
                : await dataService.updateChannelRoundState({
                    stage: "reveal",
                    status: "archived",
                    completedAt: new Date().toISOString()
                });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await actions.refreshCurrentRound({ silent: true });
            store.dispatch({ type: "round/reset-transient-progress" });
            await actions.refreshRoundMemberStatuses({ silent: true });
            await actions.refreshRoundArchives({ silent: true });
            await loadFeed("wish");
            showToast({
                tone: "success",
                message: "本轮已归档，新一轮已开始。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("archive_round", error)
            });
        }
    },
    async forceArchiveCurrentRound() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能强制归档。"
            });
            return;
        }

        const reason = window.prompt("请输入强制归档原因");
        if (reason === null) {
            return;
        }

        try {
            const nextChannel = await dataService.archiveCurrentRound({
                mode: "forced",
                reason
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await actions.refreshCurrentRound({ silent: true });
            store.dispatch({ type: "round/reset-transient-progress" });
            await actions.refreshRoundMemberStatuses({ silent: true });
            await actions.refreshRoundArchives({ silent: true });
            await loadFeed("wish");
            showToast({
                tone: "success",
                message: "当前回合已强制归档，新一轮已开始。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("archive_round", error)
            });
        }
    }
});
