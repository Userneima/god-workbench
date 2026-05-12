import { buildChannelMemberOptions } from "../../features/round/model.js";
import { getChannelRolePriority, resolveHighestChannelRole } from "../../shared/lib/helpers.js";

const roleLabelByValue = {
    owner: "创建者",
    admin: "管理员",
    member: "成员"
};

const getRoleLabel = (role) => roleLabelByValue[String(role || "member").trim()] || "成员";

const getDistinctRoleLabels = (roles = []) => {
    const normalizedRoles = [...new Set(roles
        .map((role) => String(role || "member").trim() || "member")
        .filter(Boolean))]
        .sort((left, right) => getChannelRolePriority(left) - getChannelRolePriority(right));

    return normalizedRoles.map(getRoleLabel);
};

const shouldReplaceRepresentative = (candidate, current) => {
    const candidatePriority = getChannelRolePriority(candidate?.role);
    const currentPriority = getChannelRolePriority(current?.primaryRole);
    if (candidatePriority !== currentPriority) {
        return candidatePriority < currentPriority;
    }

    const candidateCreatedAt = Date.parse(candidate?.createdAt || 0);
    const currentCreatedAt = Date.parse(current?.createdAt || 0);
    if (candidateCreatedAt !== currentCreatedAt) {
        return candidateCreatedAt > currentCreatedAt;
    }

    return String(candidate?.name || "").trim().length > String(current?.name || "").trim().length;
};

const aggregateDirectoryMembers = (members = []) => {
    const memberByKey = new Map();

    members.forEach((member, index) => {
        const userId = String(member?.userId || "").trim();
        const identityId = String(member?.identityId || "").trim();
        const role = String(member?.role || "member").trim() || "member";
        const key = userId || identityId || `member-${index}`;
        const current = memberByKey.get(key);

        if (!current) {
            memberByKey.set(key, {
                identityId: identityId || null,
                identityIds: identityId ? [identityId] : [],
                userId: userId || null,
                name: member?.name || "频道成员",
                avatar: member?.avatar || "",
                primaryRole: role,
                roles: [role],
                createdAt: member?.createdAt || null
            });
            return;
        }

        if (identityId && !current.identityIds.includes(identityId)) {
            current.identityIds.push(identityId);
        }
        if (!current.roles.includes(role)) {
            current.roles.push(role);
        }

        if (shouldReplaceRepresentative(member, current)) {
            current.identityId = identityId || current.identityId;
            current.name = member?.name || current.name;
            current.avatar = member?.avatar || current.avatar;
            current.primaryRole = role;
            current.createdAt = member?.createdAt || current.createdAt;
        }
    });

    return [...memberByKey.values()]
        .map((member) => {
            const roleLabels = getDistinctRoleLabels(member.roles);
            return {
                ...member,
                roleLabels,
                roleSummary: roleLabels.join(" · "),
                primaryRoleLabel: getRoleLabel(member.primaryRole)
            };
        })
        .sort((left, right) => {
            const roleDelta = getChannelRolePriority(left.primaryRole) - getChannelRolePriority(right.primaryRole);
            if (roleDelta !== 0) {
                return roleDelta;
            }

            const createdAtDelta = Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0);
            if (createdAtDelta !== 0) {
                return createdAtDelta;
            }

            return String(left.name || "").localeCompare(String(right.name || ""), "zh-Hans-CN");
        });
};

const buildReadonlyMembers = (state) => {
    const currentIdentityId = state.runtimeState.realIdentity.id;
    const currentName = String(state.runtimeState.realIdentity.name || "").trim();
    const currentRole = state.runtimeState.realIdentity.role || "member";

    return buildChannelMemberOptions(state).map((member) => {
        const isCurrent = (member.identityId && member.identityId === currentIdentityId)
            || (currentName && String(member.name || "").trim() === currentName);

        return {
            identityId: member.identityId || null,
            name: member.name,
            avatar: member.avatar,
            role: isCurrent ? currentRole : "member",
            roleLabel: isCurrent ? getRoleLabel(currentRole) : "成员",
            canPromote: false,
            canDemote: false,
            canRemove: false,
            confirmRemove: false,
            isBusy: false
        };
    });
};

const buildManageMembers = (state) => {
    const currentRole = resolveHighestChannelRole({
        members: state.membershipState.directoryItems || [],
        currentUserId: state.authState.user?.id || "",
        currentIdentityId: state.runtimeState.realIdentity.id,
        fallbackRole: state.runtimeState.realIdentity.role
    });
    const currentIdentityId = state.runtimeState.realIdentity.id;
    const pendingRemoveIdentityId = state.overlayState.memberList.pendingRemoveIdentityId;
    const activeMemberId = state.membershipState.activeMemberId;
    const actionsLocked = state.membershipState.mutationStatus === "submitting";

    return aggregateDirectoryMembers(state.membershipState.directoryItems || []).map((member) => {
        const role = String(member.primaryRole || "member").trim() || "member";
        const isCurrent = (Boolean(member.userId) && member.userId === state.authState.user?.id)
            || member.identityIds.includes(currentIdentityId);
        const canPromote = currentRole === "owner" && role === "member" && !isCurrent;
        const canDemote = currentRole === "owner" && role === "admin" && !isCurrent;
        const canRemove = role === "member" && !isCurrent && ["owner", "admin"].includes(currentRole);

        return {
            identityId: member.identityId || null,
            identityIds: member.identityIds,
            name: member.name,
            avatar: member.avatar,
            role,
            roleLabel: member.primaryRoleLabel,
            roleLabels: member.roleLabels,
            roleSummary: member.roleSummary,
            canPromote,
            canDemote,
            canRemove,
            confirmRemove: member.identityIds.includes(pendingRemoveIdentityId),
            isBusy: activeMemberId === member.identityId,
            actionsLocked
        };
    });
};

export const selectMemberListDialogVM = (state) => {
    const effectiveCurrentRole = resolveHighestChannelRole({
        members: state.membershipState.directoryItems || [],
        currentUserId: state.authState.user?.id || "",
        currentIdentityId: state.runtimeState.realIdentity.id,
        fallbackRole: state.runtimeState.realIdentity.role
    });
    const canManageMembers = state.overlayState.memberList.mode === "manage"
        && state.membershipState.status === "approved"
        && ["owner", "admin"].includes(effectiveCurrentRole);
    const members = canManageMembers ? buildManageMembers(state) : buildReadonlyMembers(state);

    return {
        open: state.overlayState.memberList.open,
        mode: canManageMembers ? "manage" : "view",
        subtitle: `${members.length} 位当前社区成员`,
        loading: canManageMembers && state.membershipState.directoryStatus === "loading",
        error: canManageMembers ? (state.membershipState.directoryError || "") : "",
        members,
        actionsLocked: state.membershipState.mutationStatus === "submitting"
    };
};
