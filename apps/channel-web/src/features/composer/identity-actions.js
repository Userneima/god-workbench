import { getChannelActionErrorMessage, readBlobAsDataUrl } from "../../shared/lib/helpers.js";

const resolveAccountDraft = (state) => ({
    name: String(
        state.authState.profileName
        || state.authState.user?.email?.split("@")[0]
        || "当前账号"
    ).trim() || "当前账号",
    avatar: String(state.authState.profileAvatar || "").trim() || state.runtimeState.realIdentity.avatar
});

export const createComposerIdentityActions = ({ store, dataService, showToast, ensureMemberAccess }) => ({
    openIdentityDialog(options = {}) {
        const mode = options.mode === "account" ? "account" : "channel";
        const state = store.getState();

        if (mode === "channel" && !ensureMemberAccess({
            unapprovedMessage: "只有已加入频道的成员才能编辑频道身份。"
        })) {
            return;
        }

        const draft = mode === "account"
            ? resolveAccountDraft(state)
            : {
                name: state.runtimeState.realIdentity.name,
                avatar: state.runtimeState.realIdentity.avatar
            };

        store.dispatch({
            type: "identity/open",
            payload: {
                mode,
                title: mode === "account" ? "编辑账号资料" : "编辑频道身份",
                draftName: draft.name,
                draftAvatar: draft.avatar
            }
        });
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
        const mode = state.overlayState.identity.mode === "account" ? "account" : "channel";
        const draftName = state.overlayState.identity.draftName.trim();
        if (!draftName) {
            return;
        }

        store.dispatch({ type: "identity/save-start" });

        try {
            if (mode === "account") {
                const nextProfile = await dataService.updateAccountProfile({
                    displayName: draftName,
                    avatarUrl: state.overlayState.identity.draftAvatar
                });
                store.dispatch({
                    type: "auth/set-state",
                    payload: {
                        profileName: nextProfile.name,
                        profileAvatar: nextProfile.avatar
                    }
                });
            } else {
                const nextIdentity = await dataService.updateIdentity({
                    displayName: draftName,
                    avatarUrl: state.overlayState.identity.draftAvatar,
                    meta: state.runtimeState.realIdentity.meta
                });
                store.dispatch({
                    type: "runtime/update-identity",
                    payload: { identity: nextIdentity }
                });
            }
            store.dispatch({ type: "identity/save-finish" });
            showToast({
                tone: "success",
                message: mode === "account" ? "账号资料已更新。" : "频道身份已更新。"
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
