export const selectJoinRequestPanelVM = (state) => {
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;
    const isUpgrade = authStatus === "upgrading_legacy_anonymous";
    const isApprovedMember = authStatus === "authenticated" && membershipStatus === "approved";
    const joinRequest = state.membershipState.joinRequest;
    const reviewNote = typeof joinRequest?.reviewNote === "string" ? joinRequest.reviewNote.trim() : "";

    if (isUpgrade) {
        return {
            visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: typeof state.membershipState.error === "string"
                ? state.membershipState.error
                : state.membershipState.error?.message || "",
            joinRequest,
            title: "继续升级账号",
            description: "完成正式账号升级后，你会直接回到当前频道。",
            primaryLabel: "继续升级",
            primaryAction: "upgrade",
            canSubmit: false
        };
    }

    if (isApprovedMember) {
        return {
            visible: false,
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: "",
            joinRequest
        };
    }

    if (authStatus === "guest") {
        return {
            visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: typeof state.membershipState.error === "string"
                ? state.membershipState.error
                : state.membershipState.error?.message || "",
            joinRequest: null,
            title: "登录后即可参与",
            description: "注册或登录后可以直接进入当前频道。",
            primaryLabel: "邮箱登录",
            primaryAction: "login",
            canSubmit: false
        };
    }

    return {
        visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
        authStatus,
        membershipStatus,
        draftMessage: state.membershipState.draftMessage,
        submitStatus: state.membershipState.submitStatus,
        error: typeof state.membershipState.error === "string"
            ? state.membershipState.error
            : state.membershipState.error?.message || "",
        joinRequest,
        title: membershipStatus === "cancelled" ? "重新进入当前频道" : "进入当前频道",
        description: membershipStatus === "cancelled"
            ? "重新进入后即可继续发帖、评论和使用匿名马甲。"
            : (reviewNote || "进入后即可发帖、评论和使用匿名马甲。"),
        primaryLabel: "进入频道",
        primaryAction: "submit",
        canSubmit: true
    };
};
