import { gameBoardStages, getNextRoundStage } from "../../entities/channel/config.js";
import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";
import {
    attachGuessToRevealMap,
    attachWishPreviewToRevealMap,
    buildGuessByMemberName,
    buildRevealMapFromDeliveryPosts,
    buildRoundCompletionSummary,
    buildWishPreviewByMemberName,
    getRoundDeadlinesForSave,
    getRoundStage
} from "./model.js";

export const createRoundManagementActions = ({
    store,
    dataService,
    showToast,
    loadFeed,
    actions,
    canManageRound,
    canEditRoundTheme
}) => ({
    toggleRoundGodPicker() {
        const current = store.getState().overlayState.roundManagement.godPickerOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                godPickerOpen: !current,
                themeEditorOpen: false,
                deadlineEditorOpen: false
            }
        });
    },
    async assignRoundGod(godProfile) {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能指定本周上帝。"
            });
            return;
        }

        try {
            const nextChannel = await dataService.updateChannelRoundState({ godProfile });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    godPickerOpen: false,
                    themeEditorOpen: false,
                    deadlineEditorOpen: false
                }
            });
            showToast({
                tone: "success",
                message: "本周上帝已更新。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("archive_round", error)
            });
        }
    },
    toggleRoundThemeEditor() {
        const state = store.getState();
        const current = state.overlayState.roundManagement.themeEditorOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                godPickerOpen: false,
                themeEditorOpen: !current,
                deadlineEditorOpen: false,
                draftTheme: state.roundState.theme || ""
            }
        });
    },
    cancelRoundThemeEditing() {
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                themeEditorOpen: false,
                draftTheme: store.getState().roundState.theme || ""
            }
        });
    },
    setRoundThemeDraft(value) {
        store.dispatch({
            type: "round-management/set-field",
            payload: { draftTheme: value }
        });
    },
    async saveRoundTheme() {
        const state = store.getState();
        if (!canEditRoundTheme(state)) {
            showToast({
                tone: "info",
                message: "只有本周上帝或频道管理员才能设定主题。"
            });
            return;
        }

        const draftTheme = state.overlayState.roundManagement.draftTheme.trim();
        if (!draftTheme) {
            showToast({
                tone: "info",
                message: "先输入本周主题。"
            });
            return;
        }

        try {
            const nextChannel = await dataService.updateChannelRoundState({ theme: draftTheme });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await actions.refreshCurrentRound({ silent: true });
            store.dispatch({
                type: "round-management/set-field",
                payload: { themeEditorOpen: false }
            });
            showToast({
                tone: "success",
                message: "本周主题已更新。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_round_state", error)
            });
        }
    },
    async renameCurrentRound() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能修改轮次名称。"
            });
            return;
        }

        const nextTitle = window.prompt(
            "请输入当前轮次名称",
            state.roundState.title || state.roundState.defaultTitle || ""
        );
        if (nextTitle === null) {
            return;
        }

        try {
            const nextChannel = await dataService.updateChannelRoundState({
                title: nextTitle
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await actions.refreshCurrentRound({ silent: true });
            showToast({
                tone: "success",
                message: "当前轮次名称已更新。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("rename_current_round", error)
            });
        }
    },
    toggleRoundDeadlineEditor() {
        const state = store.getState();
        const current = state.overlayState.roundManagement.deadlineEditorOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                godPickerOpen: false,
                themeEditorOpen: false,
                deadlineEditorOpen: !current,
                draftDeadlines: {
                    ...(state.roundState.deadlines || {})
                }
            }
        });
    },
    cancelRoundDeadlineEditing() {
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                deadlineEditorOpen: false,
                draftDeadlines: {
                    ...(store.getState().roundState.deadlines || {})
                }
            }
        });
    },
    setRoundDeadlineDraft(stage, value) {
        const normalizedStage = String(stage || "").trim();
        if (!gameBoardStages.some((item) => item.value === normalizedStage)) {
            return;
        }

        const currentDrafts = store.getState().overlayState.roundManagement.draftDeadlines || {};
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                draftDeadlines: {
                    ...currentDrafts,
                    [normalizedStage]: {
                        ...(currentDrafts[normalizedStage] || store.getState().roundState.deadlines?.[normalizedStage] || {}),
                        deadlineAt: String(value || "").trim() || null
                    }
                }
            }
        });
    },
    async saveRoundDeadlines() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能更新回合截止时间。"
            });
            return;
        }

        try {
            const nextChannel = await dataService.updateChannelRoundState({
                deadlines: getRoundDeadlinesForSave(state)
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            store.dispatch({
                type: "round-management/set-field",
                payload: { deadlineEditorOpen: false }
            });
            showToast({
                tone: "success",
                message: "回合截止时间已更新。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("archive_round", error)
            });
        }
    },
    toggleRoundRevealEditor() {
        const state = store.getState();
        const current = state.overlayState.roundManagement.revealEditorOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                godPickerOpen: false,
                themeEditorOpen: false,
                deadlineEditorOpen: false,
                revealEditorOpen: !current,
                revealMemberPickerOpen: false,
                revealAngelPickerOpen: false,
                draftRevealMember: current ? null : state.overlayState.roundManagement.draftRevealMember,
                draftRevealAngel: current ? null : state.overlayState.roundManagement.draftRevealAngel
            }
        });
    },
    toggleRoundRevealMemberPicker() {
        const current = store.getState().overlayState.roundManagement.revealMemberPickerOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                revealMemberPickerOpen: !current,
                revealAngelPickerOpen: false
            }
        });
    },
    toggleRoundRevealAngelPicker() {
        const current = store.getState().overlayState.roundManagement.revealAngelPickerOpen;
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                revealAngelPickerOpen: !current,
                revealMemberPickerOpen: false
            }
        });
    },
    chooseRoundRevealMember(member) {
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                draftRevealMember: member ? { ...member } : null,
                revealMemberPickerOpen: false
            }
        });
    },
    chooseRoundRevealAngel(member) {
        store.dispatch({
            type: "round-management/set-field",
            payload: {
                draftRevealAngel: member ? { ...member } : null,
                revealAngelPickerOpen: false
            }
        });
    },
    async saveRoundRevealPair() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能配置揭晓结果。"
            });
            return;
        }

        const draftMember = state.overlayState.roundManagement.draftRevealMember;
        const draftAngel = state.overlayState.roundManagement.draftRevealAngel;
        if (!draftMember?.name || !draftAngel?.name) {
            showToast({
                tone: "info",
                message: "先选要揭晓的成员，再选他对应的天使。"
            });
            return;
        }

        if (draftMember.name === draftAngel.name) {
            showToast({
                tone: "info",
                message: "揭晓对象和天使不能是同一个人。"
            });
            return;
        }

        const currentEntry = state.roundState.revealMap?.[draftMember.name] || null;
        let wishPreviewByMemberName = new Map();
        let guessByMemberName = new Map();

        try {
            const [wishPosts, guessSelections] = await Promise.all([
                dataService.listPosts("wish"),
                dataService.listChannelGuessSelections?.() || []
            ]);
            wishPreviewByMemberName = buildWishPreviewByMemberName(wishPosts);
            guessByMemberName = buildGuessByMemberName(guessSelections);
        } catch {
            showToast({
                tone: "info",
                message: "已继续保存揭晓配对，但当前没拿到这位国王的愿望或猜测摘要。"
            });
        }

        const nextRevealMap = attachGuessToRevealMap(attachWishPreviewToRevealMap({
            ...(state.roundState.revealMap || {}),
            [draftMember.name]: {
                member: {
                    name: draftMember.name,
                    avatar: draftMember.avatar || ""
                },
                angel: {
                    name: draftAngel.name,
                    avatar: draftAngel.avatar || ""
                },
                wishPostId: currentEntry?.wishPostId || null,
                wishPreview: currentEntry?.wishPreview || "",
                guessedAngelName: currentEntry?.guessedAngelName || "",
                guessedAngelAvatar: currentEntry?.guessedAngelAvatar || "",
                updatedAt: new Date().toISOString()
            }
        }, wishPreviewByMemberName), guessByMemberName);

        try {
            const nextChannel = await dataService.updateChannelRoundState({
                revealMap: nextRevealMap
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    revealEditorOpen: false,
                    revealMemberPickerOpen: false,
                    revealAngelPickerOpen: false,
                    draftRevealMember: null,
                    draftRevealAngel: null
                }
            });
            showToast({
                tone: "success",
                message: "揭晓配对已保存。"
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("restore_round_archive", error)
            });
        }
    },
    async generateRoundRevealResults() {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能生成揭晓结果。"
            });
            return;
        }

        try {
            const [deliveryPosts, wishPosts, guessSelections] = await Promise.all([
                dataService.listPosts("delivery"),
                dataService.listPosts("wish"),
                dataService.listChannelGuessSelections?.() || []
            ]);
            const revealMap = buildRevealMapFromDeliveryPosts(deliveryPosts, {
                realIdentity: state.runtimeState.realIdentity
            });
            const withWishPreview = attachWishPreviewToRevealMap(revealMap, buildWishPreviewByMemberName(wishPosts));
            const nextRevealMap = attachGuessToRevealMap(withWishPreview, buildGuessByMemberName(guessSelections));
            const pairCount = Object.keys(nextRevealMap).length;

            if (!pairCount) {
                showToast({
                    tone: "info",
                    message: "还没有足够的交付数据可用于生成揭晓结果。"
                });
                return;
            }

            const nextChannel = await dataService.updateChannelRoundState({
                revealMap: nextRevealMap
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    revealEditorOpen: false,
                    revealMemberPickerOpen: false,
                    revealAngelPickerOpen: false,
                    draftRevealMember: null,
                    draftRevealAngel: null
                }
            });
            showToast({
                tone: "success",
                message: `已根据交付内容生成 ${pairCount} 对揭晓结果。`
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_round_state", error)
            });
        }
    },
    async setRoundStage(stage, { allowIncomplete = true } = {}) {
        const state = store.getState();
        if (!canManageRound(state)) {
            showToast({
                tone: "info",
                message: "只有频道管理员才能切换阶段。"
            });
            return;
        }

        const normalizedStage = getRoundStage(stage).value;
        const summary = buildRoundCompletionSummary(state.roundState.memberStatuses);
        if (!allowIncomplete && normalizedStage === "claim" && !summary.readyForClaim) {
            showToast({
                tone: "info",
                message: "还有成员没完成许愿，暂时不能进入选愿望。"
            });
            return;
        }
        if (!allowIncomplete && normalizedStage === "delivery" && !summary.readyForDelivery) {
            showToast({
                tone: "info",
                message: "还有成员没完成选愿望，暂时不能进入交付。"
            });
            return;
        }
        if (!allowIncomplete && normalizedStage === "guess" && !summary.readyForGuess) {
            showToast({
                tone: "info",
                message: "还有成员没完成交付，暂时不能进入猜测。"
            });
            return;
        }
        if (!allowIncomplete && normalizedStage === "reveal" && !summary.readyForReveal) {
            showToast({
                tone: "info",
                message: "还有成员没完成猜测，暂时不能进入揭晓。"
            });
            return;
        }

        try {
            const nextChannel = await dataService.updateChannelRoundState({
                stage: normalizedStage,
                status: normalizedStage === "reveal" ? state.roundState.status : "active",
                completedAt: normalizedStage === "reveal" && state.roundState.status === "archived"
                    ? state.roundState.completedAt
                    : null
            });
            store.dispatch({
                type: "runtime/update-channel",
                payload: { channel: nextChannel }
            });
            await loadFeed(normalizedStage);
            showToast({
                tone: "success",
                message: `当前阶段已切换到${getRoundStage(normalizedStage).label}。`
            });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_round_state", error)
            });
        }
    },
    async advanceRoundStage() {
        const state = store.getState();
        const nextStage = getNextRoundStage(state.roundState.activeStage);
        if (!nextStage) {
            showToast({
                tone: "info",
                message: "当前已经是最后一个阶段。"
            });
            return;
        }

        await actions.setRoundStage(nextStage, { allowIncomplete: false });
    }
});
