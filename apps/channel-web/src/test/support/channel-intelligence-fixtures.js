import { vi } from "vitest";

export const createChannelIntelligenceActions = () => ({
    openOverlay: vi.fn(),
    closeOverlay: vi.fn(),
    toggleRoundGodPicker: vi.fn(),
    assignRoundGod: vi.fn(),
    toggleRoundThemeEditor: vi.fn(),
    cancelRoundThemeEditing: vi.fn(),
    setRoundThemeDraft: vi.fn(),
    saveRoundTheme: vi.fn(),
    toggleRoundDeadlineEditor: vi.fn(),
    cancelRoundDeadlineEditing: vi.fn(),
    setRoundDeadlineDraft: vi.fn(),
    saveRoundDeadlines: vi.fn(),
    renameCurrentRound: vi.fn(),
    toggleRoundRevealEditor: vi.fn(),
    generateRoundRevealResults: vi.fn(),
    toggleRoundRevealMemberPicker: vi.fn(),
    toggleRoundRevealAngelPicker: vi.fn(),
    chooseRoundRevealMember: vi.fn(),
    chooseRoundRevealAngel: vi.fn(),
    saveRoundRevealPair: vi.fn(),
    selectRoundArchive: vi.fn(),
    closeArchiveDetail: vi.fn(),
    viewSelectedArchiveInBoard: vi.fn(),
    restoreArchivedRound: vi.fn(),
    renameArchivedRound: vi.fn(),
    exportArchivedRound: vi.fn(),
    deleteArchivedRound: vi.fn(),
    exitArchiveViewer: vi.fn()
});

export const setApprovedOwnerContext = (store) => {
    store.dispatch({
        type: "auth/set-state",
        payload: {
            status: "authenticated",
            user: { id: "user-1", email: "owner@example.com" }
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
                role: "owner"
            }
        }
    });
};
