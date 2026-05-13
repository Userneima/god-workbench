export const ensureApprovedMember = (store, onGuest, onUnapproved) => {
    const state = store.getState();
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;

    if (authStatus === "guest") {
        onGuest?.();
        return false;
    }

    if (authStatus === "upgrading_legacy_anonymous") {
        onGuest?.("upgrade");
        return false;
    }

    if (membershipStatus !== "approved") {
        onUnapproved?.(membershipStatus);
        return false;
    }

    return true;
};

export const resolveAnonymousComposerMode = (state) => {
    if (state.feedState.activeBoard === "all") {
        return state.composerState.anonymousMode;
    }

    return ["wish", "delivery"].includes(state.roundState.activeStage)
        ? true
        : state.composerState.anonymousMode;
};
