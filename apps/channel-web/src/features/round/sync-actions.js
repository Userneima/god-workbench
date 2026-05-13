import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";

export const createRoundSyncActions = ({ store, dataService, showToast }) => ({
    async refreshCurrentRound({ silent = false } = {}) {
        if (typeof dataService.loadCurrentRound !== "function") {
            return null;
        }

        try {
            if (typeof dataService.syncCurrentRoundWishDeadline === "function") {
                const nextChannel = await dataService.syncCurrentRoundWishDeadline();
                if (nextChannel) {
                    store.dispatch({
                        type: "runtime/update-channel",
                        payload: { channel: nextChannel }
                    });
                }
            }
            const round = await dataService.loadCurrentRound();
            if (round) {
                store.dispatch({
                    type: "round/set-current-round",
                    payload: { round }
                });
            }
            return round;
        } catch (error) {
            if (!silent) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("load_round_state", error)
                });
            }
            return null;
        }
    },
    async refreshRoundMemberStatuses({ silent = false } = {}) {
        const state = store.getState();
        if (
            state.membershipState.status !== "approved"
            || typeof dataService.listRoundMemberStatuses !== "function"
        ) {
            store.dispatch({
                type: "round/set-member-statuses",
                payload: { items: [] }
            });
            return [];
        }

        try {
            const items = await dataService.listRoundMemberStatuses();
            store.dispatch({
                type: "round/set-member-statuses",
                payload: { items }
            });
            return items;
        } catch (error) {
            if (!silent) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("load_round_state", error)
                });
            }
            return [];
        }
    },
    async refreshRoundArchives({ silent = false } = {}) {
        const listArchives = dataService.listArchivedRounds || dataService.listRoundArchives;
        if (typeof listArchives !== "function") {
            store.dispatch({
                type: "round/set-archives",
                payload: { items: [] }
            });
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: { selectedArchiveId: null }
            });
            return [];
        }

        try {
            const nextItems = await listArchives.call(dataService);
            const items = Array.isArray(nextItems) ? nextItems : [];
            const currentSelectedArchiveId = store.getState().overlayState.channelIntelligence.selectedArchiveId;
            const nextSelectedArchiveId = items.some((item) => item.id === currentSelectedArchiveId)
                ? currentSelectedArchiveId
                : null;
            store.dispatch({
                type: "round/set-archives",
                payload: { items }
            });
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: { selectedArchiveId: nextSelectedArchiveId }
            });
            return items;
        } catch (error) {
            if (!silent) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("load_round_state", error)
                });
            }
            return [];
        }
    }
});
