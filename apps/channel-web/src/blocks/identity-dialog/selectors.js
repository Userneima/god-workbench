export const selectIdentityDialogVM = (state) => {
    const overlay = state.overlayState.identity;
    const trimmedName = overlay.draftName.trim();
    const hasChanged = trimmedName !== overlay.sourceName || overlay.draftAvatar !== overlay.sourceAvatar;

    return {
        open: overlay.open,
        title: overlay.title,
        mode: overlay.mode,
        draftName: overlay.draftName,
        draftAvatar: overlay.draftAvatar,
        saveStatus: overlay.saveStatus,
        error: typeof overlay.error === "string"
            ? overlay.error
            : overlay.error?.message || "",
        canSave: Boolean(trimmedName) && trimmedName.length <= 12 && hasChanged && overlay.saveStatus !== "saving",
        nameCount: `${trimmedName.length}/12`
    };
};
