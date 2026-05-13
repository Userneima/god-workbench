import { getChannelActionErrorMessage, readBlobAsDataUrl } from "../../shared/lib/helpers.js";

export const createComposerIdentityActions = ({ store, dataService, showToast, ensureMemberAccess }) => ({
    openIdentityDialog() {
        if (!ensureMemberAccess({
            unapprovedMessage: "只有已加入频道的成员才能编辑频道身份。"
        })) {
            return;
        }
        store.dispatch({ type: "identity/open" });
    },
    closeIdentityDialog() {
        store.dispatch({ type: "identity/close" });
    },
    setIdentityDraft(partial) {
        store.dispatch({
            type: "identity/set-field",
            payload: partial
        });
    },
    async setIdentityAvatar(file) {
        if (!file) {
            return;
        }

        try {
            const draftAvatar = await readBlobAsDataUrl(file);
            this.setIdentityDraft({ draftAvatar });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("read_avatar", error)
            });
        }
    },
    async saveIdentity() {
        const state = store.getState();
        const draftName = state.overlayState.identity.draftName.trim();
        if (!draftName) {
            return;
        }

        store.dispatch({ type: "identity/save-start" });

        try {
            const nextIdentity = await dataService.updateIdentity({
                displayName: draftName,
                avatarUrl: state.overlayState.identity.draftAvatar,
                meta: state.runtimeState.realIdentity.meta
            });
            store.dispatch({
                type: "runtime/update-identity",
                payload: { identity: nextIdentity }
            });
            store.dispatch({ type: "identity/save-finish" });
            showToast({
                tone: "success",
                message: "频道身份已更新。"
            });
        } catch (error) {
            store.dispatch({
                type: "identity/save-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_identity", error)
            });
        }
    }
});
