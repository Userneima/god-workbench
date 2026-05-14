import { channelShellConfig } from "../../entities/channel/config.js";
import { defaultRealIdentity } from "../../entities/identity/config.js";
import { isPlatformOperatorEmail } from "../../shared/lib/helpers.js";

const DESKTOP_BREAKPOINT = 720;
const CHANNEL_MENU_WIDTH = 314;
const CHANNEL_MENU_HEIGHT = 338;
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 14;

const getChannelMenuPanelStyle = (overlayState) => {
    if (typeof window === "undefined" || window.innerWidth <= DESKTOP_BREAKPOINT) {
        return "";
    }

    const { anchorX, anchorY } = overlayState;
    if (typeof anchorX !== "number" || typeof anchorY !== "number") {
        return "";
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - CHANNEL_MENU_WIDTH - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - CHANNEL_MENU_HEIGHT - VIEWPORT_MARGIN);
    const left = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, anchorX - CHANNEL_MENU_WIDTH));
    const top = Math.min(maxTop, Math.max(VIEWPORT_MARGIN, anchorY + TRIGGER_GAP));

    return `top:${top}px;left:${left}px;right:auto;`;
};

export const selectChannelMenuDialogVM = (state) => ({
    open: state.overlayState.channelMenu.open,
    panelStyle: getChannelMenuPanelStyle(state.overlayState.channelMenu),
    channelName: state.runtimeState.channel?.name || "频道",
    channelSlug: state.runtimeState.channel?.slug || "",
    logoUrl: state.runtimeState.channel?.logoUrl || channelShellConfig.channelLogo,
    identityMode: state.membershipState.status === "approved" ? "channel" : "account",
    identityLabel: state.membershipState.status === "approved" ? "本频道昵称和头像" : "账号昵称和头像",
    identityName: state.membershipState.status === "approved"
        ? state.runtimeState.realIdentity.name
        : String(
            state.authState.profileName
            || state.authState.user?.email?.split("@")[0]
            || defaultRealIdentity.name
        ).trim() || defaultRealIdentity.name,
    identityAvatar: state.membershipState.status === "approved"
        ? state.runtimeState.realIdentity.avatar
        : String(state.authState.profileAvatar || "").trim() || defaultRealIdentity.avatar,
    canManageAnonymous: state.membershipState.status === "approved"
        && ["owner", "admin"].includes(state.runtimeState.realIdentity.role),
    canManageChannel: state.membershipState.status === "approved"
        && ["owner", "admin"].includes(state.runtimeState.realIdentity.role),
    canViewRegisteredUsers: Boolean(state.authState.user?.id) && !state.authState.isAnonymous
        && isPlatformOperatorEmail(state.authState.user?.email),
    adminRevealAnonymous: state.uiState.adminRevealAnonymous,
    themeMode: state.uiState.themeMode || "light"
});
