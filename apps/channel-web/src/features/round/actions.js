import { createRoundArchiveActions } from "./archive-actions.js";
import { createRoundManagementActions } from "./management-actions.js";
import { createRoundSyncActions } from "./sync-actions.js";

export const createRoundActions = ({ store, dataService, showToast, loadFeed }) => {
    const canManageRound = (state) => ["owner", "admin"].includes(state.runtimeState.realIdentity.role);
    const canEditRoundTheme = (state) => canManageRound(state)
        || state.runtimeState.realIdentity.name === state.roundState.godProfile?.name;

    const actions = {};

    Object.assign(actions, createRoundSyncActions({
        store,
        dataService,
        showToast
    }));

    Object.assign(actions, createRoundManagementActions({
        store,
        dataService,
        showToast,
        loadFeed,
        actions,
        canManageRound,
        canEditRoundTheme
    }));

    Object.assign(actions, createRoundArchiveActions({
        store,
        dataService,
        showToast,
        loadFeed,
        actions,
        canManageRound
    }));

    return actions;
};
