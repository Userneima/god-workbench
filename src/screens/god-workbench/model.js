const STORAGE_KEY = "soulmap.god-workbench.v2";
const MEMBER_ROSTER_KEY = "soulmap.god-workbench.member-roster.v1";
const STATE_VERSION = 2;
const BACKUP_VERSION = 1;
const BACKUP_APP_ID = "god-workbench";
const DEFAULT_WISH_REMINDER_TEMPLATE = "某某，这周主题是：XX，你还没许愿哦。";
export const REVEAL_STATUS_HEADER = "愿望完成状态";

export const selectionStatusLabels = {
    pending: "待审",
    approved: "通过",
    rejected: "退回"
};

export const completionStatuses = ["pending", "done"];

export const completionStatusLabels = {
    pending: "未完成",
    done: "已完成"
};

const defaultParticipants = [];

const sampleParticipants = [
    { id: "p1", name: "白榆" },
    { id: "p2", name: "北桥" },
    { id: "p3", name: "小满" },
    { id: "p4", name: "林舟" },
    { id: "p5", name: "青柚" }
];

const defaultWishes = [
    { id: "w1", ownerId: "p1", body: "想收到一份和夏天有关的小惊喜", status: "approved" },
    { id: "w2", ownerId: "p2", body: "想让一个普通工作日变得没那么普通", status: "approved" },
    { id: "w3", ownerId: "p3", body: "想有人陪我完成一次城市散步", status: "approved" },
    { id: "w4", ownerId: "p4", body: "想收到一段只属于本轮主题的歌单", status: "approved" },
    { id: "w5", ownerId: "p5", body: "想要一个不用解释也能笑出来的瞬间", status: "approved" }
];

const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const clone = (value) => JSON.parse(JSON.stringify(value));

const canUseLocalStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const normalizeCompletionStatus = (status) => status === "done" ? "done" : "pending";

const createCompletionMap = (participants, overrides = {}) => Object.fromEntries(participants.map((participant) => [
    participant.id,
    normalizeCompletionStatus(overrides[participant.id])
]));

const toLocalIsoDate = (date = new Date()) => {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
};

const parseIsoDate = (value) => {
    const [year, month, day] = String(value || "").split("-").map(Number);
    if (!year || !month || !day) {
        return new Date();
    }
    return new Date(year, month - 1, day);
};

const formatMonthDay = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;

const normalizeParticipants = (participants) => (
    Array.isArray(participants)
        ? participants
            .filter((participant) => participant?.id && String(participant.name || "").trim())
            .map((participant) => ({ id: String(participant.id), name: String(participant.name).trim() }))
        : []
);

const readStoredMemberRoster = () => {
    if (!canUseLocalStorage()) {
        return null;
    }
    try {
        const rawValue = window.localStorage.getItem(MEMBER_ROSTER_KEY);
        if (!rawValue) {
            return null;
        }
        const roster = normalizeParticipants(JSON.parse(rawValue));
        return roster.length ? roster : null;
    } catch {
        return null;
    }
};

export const loadMemberRoster = (fallbackParticipants = defaultParticipants) => (
    readStoredMemberRoster() || clone(fallbackParticipants.length ? fallbackParticipants : defaultParticipants)
);

export const saveMemberRoster = (participants) => {
    if (!canUseLocalStorage()) {
        return;
    }
    window.localStorage.setItem(MEMBER_ROSTER_KEY, JSON.stringify(normalizeParticipants(participants)));
};

export const getSelectionOrderFromWishes = (participants, wishes) => {
    const participantIds = new Set(participants.map((participant) => participant.id));
    const seenOwnerIds = new Set();
    return wishes
        .filter((wish) => wish.status === "approved" && participantIds.has(wish.ownerId))
        .map((wish) => wish.ownerId)
        .filter((ownerId) => {
            if (seenOwnerIds.has(ownerId)) {
                return false;
            }
            seenOwnerIds.add(ownerId);
            return true;
        });
};

export const getDefaultRoundDeadlines = (themeSetDate = toLocalIsoDate()) => {
    const seventhDay = addDays(parseIsoDate(themeSetDate), 6);
    const seventhDayLabel = formatMonthDay(seventhDay);
    return {
        wishDeadline: "明天5点前",
        finishDeadline: `${seventhDayLabel} 20:00`,
        revealAt: `${seventhDayLabel} 21:00`
    };
};

export const createInitialWorkbenchState = () => {
    const participants = loadMemberRoster();
    return {
        version: STATE_VERSION,
        round: {
            code: "01",
            theme: "",
            god: "",
            themeSetDate: toLocalIsoDate(),
            wishReminderTemplate: DEFAULT_WISH_REMINDER_TEMPLATE,
            ...getDefaultRoundDeadlines()
        },
        participants,
        wishes: [],
        selectionOrder: [],
        activeSelectionIndex: 0,
        assignments: [],
        completionByParticipantId: createCompletionMap(participants),
        archives: [],
        toast: ""
    };
};

export const createSampleWorkbenchState = () => {
    const participants = loadMemberRoster(sampleParticipants);
    const wishes = clone(defaultWishes);
    return normalizeWorkbenchState({
        ...createInitialWorkbenchState(),
        round: {
            code: "04",
            theme: "夏日",
            god: "白榆",
            themeSetDate: toLocalIsoDate(),
            ...getDefaultRoundDeadlines()
        },
        participants,
        wishes,
        selectionOrder: getSelectionOrderFromWishes(participants, wishes),
        completionByParticipantId: {
            p1: "pending",
            p2: "pending",
            p3: "pending",
            p4: "done",
            p5: "pending"
        }
    });
};

export const getParticipantName = (state, participantId) => (
    state.participants.find((participant) => participant.id === participantId)?.name || "未知"
);

export const getRoundPlayerParticipants = (state) => {
    const godName = String(state.round?.god || "").trim();
    return state.participants.filter((participant) => participant.name !== godName);
};

export const getRoundPlayerIds = (state) => new Set(getRoundPlayerParticipants(state).map((participant) => participant.id));

export const getWishById = (state, wishId) => state.wishes.find((wish) => wish.id === wishId) || null;

export const getAssignedWishIds = (state) => new Set(state.assignments.map((assignment) => assignment.wishId));

export const getSubmittedWishOwnerIds = (wishes) => new Set(
    wishes
        .filter((wish) => wish.status === "approved")
        .map((wish) => wish.ownerId)
);

export const getRoundApprovedWishes = (state) => {
    const roundPlayerIds = getRoundPlayerIds(state);
    return state.wishes.filter((wish) => wish.status === "approved" && roundPlayerIds.has(wish.ownerId));
};

export const getSelectionParticipants = (state) => {
    const participantById = new Map(state.participants.map((participant) => [participant.id, participant]));
    return state.selectionOrder
        .map((participantId) => participantById.get(participantId))
        .filter(Boolean);
};

const normalizeWishes = (wishes, participantIds) => (
    Array.isArray(wishes)
        ? wishes
            .filter((wish) => wish?.id && participantIds.has(wish.ownerId) && String(wish.body || "").trim())
            .map((wish) => ({
                id: String(wish.id),
                ownerId: String(wish.ownerId),
                body: String(wish.body).trim(),
                status: selectionStatusLabels[wish.status] ? wish.status : "pending"
            }))
        : []
);

export const normalizeWorkbenchState = (rawState) => {
    const fallback = createInitialWorkbenchState();
    const source = rawState && typeof rawState === "object" ? rawState : fallback;
    const participants = normalizeParticipants(source.participants);
    const safeParticipants = participants.length ? participants : clone(defaultParticipants);
    const participantIds = new Set(safeParticipants.map((participant) => participant.id));
    const wishes = normalizeWishes(source.wishes, participantIds);
    const safeWishes = Object.hasOwn(source, "wishes") ? wishes : clone(fallback.wishes);
    const safeRound = {
        ...fallback.round,
        ...(source.round && typeof source.round === "object" ? source.round : {})
    };
    if (safeRound.god && !safeParticipants.some((participant) => participant.name === safeRound.god)) {
        safeRound.god = "";
    }
    const roundParticipantIds = new Set(safeParticipants
        .filter((participant) => participant.name !== safeRound.god)
        .map((participant) => participant.id));
    const storedWishIds = new Set(safeWishes.map((wish) => wish.id));
    const assignments = Array.isArray(source.assignments)
        ? source.assignments
            .filter((assignment) => participantIds.has(assignment.angelId) && storedWishIds.has(assignment.wishId))
            .filter((assignment, index, list) => (
                list.findIndex((item) => item.angelId === assignment.angelId || item.wishId === assignment.wishId) === index
            ))
            .map((assignment) => ({ angelId: String(assignment.angelId), wishId: String(assignment.wishId) }))
        : [];
    const roundParticipants = safeParticipants.filter((participant) => roundParticipantIds.has(participant.id));
    const selectionOrder = getSelectionOrderFromWishes(roundParticipants, safeWishes);
    const safeSelectionOrder = selectionOrder.length
        ? selectionOrder
        : (Array.isArray(source.selectionOrder) ? source.selectionOrder.filter((participantId) => (
            roundParticipantIds.has(participantId) && safeWishes.some((wish) => wish.ownerId === participantId)
        )) : []);

    return {
        version: STATE_VERSION,
        round: safeRound,
        participants: safeParticipants,
        wishes: safeWishes,
        selectionOrder: safeSelectionOrder,
        activeSelectionIndex: Math.min(
            Math.max(Number(source.activeSelectionIndex) || 0, assignments.length),
            safeSelectionOrder.length
        ),
        assignments,
        completionByParticipantId: createCompletionMap(safeParticipants, source.completionByParticipantId),
        archives: Array.isArray(source.archives) ? source.archives.slice(0, 20) : [],
        toast: String(source.toast || "")
    };
};

export const applyMemberRoster = (state, participants) => {
    const roster = normalizeParticipants(participants);
    return normalizeWorkbenchState({
        ...state,
        participants: roster,
        selectionOrder: state.selectionOrder.filter((participantId) => (
            roster.some((participant) => participant.id === participantId)
        )),
        completionByParticipantId: {
            ...state.completionByParticipantId,
            ...Object.fromEntries(roster.map((participant) => [
                participant.id,
                normalizeCompletionStatus(state.completionByParticipantId?.[participant.id])
            ]))
        }
    });
};

export const loadWorkbenchState = () => {
    try {
        const rawValue = window.localStorage.getItem(STORAGE_KEY);
        const state = normalizeWorkbenchState(rawValue ? JSON.parse(rawValue) : null);
        const storedRoster = readStoredMemberRoster();
        if (storedRoster) {
            return applyMemberRoster(state, storedRoster);
        }
        saveMemberRoster(state.participants);
        return state;
    } catch {
        return createInitialWorkbenchState();
    }
};

export const saveWorkbenchState = (state) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWorkbenchState(state)));
};

export const clearWorkbenchState = () => {
    window.localStorage.removeItem(STORAGE_KEY);
};

export const buildWorkbenchBackup = (state) => {
    const safeState = normalizeWorkbenchState(state);
    return JSON.stringify({
        app: BACKUP_APP_ID,
        backupVersion: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        state: {
            ...safeState,
            toast: ""
        },
        memberRoster: normalizeParticipants(safeState.participants)
    }, null, 2);
};

const fillMissingRoundDeadlines = (round, defaults) => ({
    wishDeadline: String(round.wishDeadline || "").trim() || defaults.wishDeadline,
    finishDeadline: String(round.finishDeadline || "").trim() || defaults.finishDeadline,
    revealAt: String(round.revealAt || "").trim() || defaults.revealAt
});

export const updateRoundField = (state, field, value) => ({
    ...state,
    round: field === "theme"
        ? {
            ...state.round,
            theme: String(value || "").trim(),
            themeSetDate: toLocalIsoDate(),
            ...fillMissingRoundDeadlines(state.round, getDefaultRoundDeadlines(toLocalIsoDate()))
        }
        : field === "themeSetDate"
            ? {
                ...state.round,
                themeSetDate: String(value || "").trim(),
                ...getDefaultRoundDeadlines(String(value || "").trim())
            }
        : {
            ...state.round,
            [field]: String(value || "").trim()
        },
    toast: "已保存"
});

export const buildThemeAnnouncement = (state) => {
    const theme = String(state.round.theme || "").trim() || "未命名";
    const wishDeadline = String(state.round.wishDeadline || "").trim() || getDefaultRoundDeadlines().wishDeadline;
    return `本周主题：${theme}\n请各位国王${wishDeadline}将愿望发送给我哦`;
};

export const buildWishCollectionFollowup = (state) => {
    const submittedOwnerIds = getSubmittedWishOwnerIds(state.wishes);
    const missingParticipants = getRoundPlayerParticipants(state).filter((participant) => !submittedOwnerIds.has(participant.id));
    if (!missingParticipants.length) {
        return "本轮愿望已收齐。";
    }
    return `还差 ${missingParticipants.map((participant) => participant.name).join("、")} 的愿望。`;
};

export const getWishReminderTemplate = (state) => (
    String(state.round.wishReminderTemplate || "").trim() || DEFAULT_WISH_REMINDER_TEMPLATE
);

export const buildSingleWishReminder = (state, participantId) => {
    const participantName = getParticipantName(state, participantId);
    const theme = String(state.round.theme || "").trim() || "未命名";
    const template = getWishReminderTemplate(state);
    const withName = template.includes("某某")
        ? template.replaceAll("某某", participantName)
        : `${participantName}，${template}`;
    return withName.includes("XX")
        ? withName.replaceAll("XX", theme)
        : withName;
};

export const buildCompletionReminder = () => "还没完成国王愿望的抓紧了哦，我们快要开始猜人了。";

export const buildCompletionFollowup = (state) => {
    const reminderParticipants = getSelectionParticipants(state).filter((participant) => (
        state.completionByParticipantId[participant.id] !== "done"
    ));
    if (!reminderParticipants.length) {
        return "本轮国王愿望都已完成。";
    }
    return buildCompletionReminder();
};

export const addParticipant = (state, name) => {
    const safeName = String(name || "").trim();
    if (!safeName) {
        return { ...state, toast: "成员为空" };
    }
    if (state.participants.some((participant) => participant.name === safeName)) {
        return { ...state, toast: "成员重复" };
    }
    const participant = { id: createId("p"), name: safeName };
    return normalizeWorkbenchState({
        ...state,
        participants: [...state.participants, participant],
        completionByParticipantId: {
            ...state.completionByParticipantId,
            [participant.id]: "pending"
        },
        toast: "已添加"
    });
};

export const removeParticipant = (state, participantId) => normalizeWorkbenchState({
    ...state,
    participants: state.participants.filter((participant) => participant.id !== participantId),
    wishes: state.wishes.filter((wish) => wish.ownerId !== participantId),
    selectionOrder: state.selectionOrder.filter((id) => id !== participantId),
    assignments: state.assignments.filter((assignment) => assignment.angelId !== participantId),
    completionByParticipantId: Object.fromEntries(
        Object.entries(state.completionByParticipantId).filter(([id]) => id !== participantId)
    ),
    toast: "已移除"
});

export const addWish = (state, { ownerId, body }) => {
    const safeBody = String(body || "").trim();
    if (!ownerId || !safeBody) {
        return { ...state, toast: "愿望为空" };
    }
    if (!getRoundPlayerIds(state).has(String(ownerId))) {
        return { ...state, toast: "上帝不参与本轮许愿" };
    }
    const existingWish = state.wishes.find((wish) => wish.ownerId === ownerId);
    if (existingWish) {
        return normalizeWorkbenchState({
            ...state,
            wishes: state.wishes.map((wish) => (
                wish.id === existingWish.id
                    ? {
                        ...wish,
                        body: safeBody,
                        status: "approved"
                    }
                    : wish
            )),
            toast: "已更新"
        });
    }
    return normalizeWorkbenchState({
        ...state,
        wishes: [
            ...state.wishes,
            {
                id: createId("w"),
                ownerId,
                body: safeBody,
                status: "approved"
            }
        ],
        toast: "已录入"
    });
};

export const removeWish = (state, wishId) => normalizeWorkbenchState({
    ...state,
    wishes: state.wishes.filter((wish) => wish.id !== wishId),
    assignments: state.assignments.filter((assignment) => assignment.wishId !== wishId),
    toast: "已删除"
});

export const moveWish = (state, wishId, direction) => {
    const currentIndex = state.wishes.findIndex((wish) => wish.id === wishId);
    const offset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.wishes.length) {
        return state;
    }
    const wishes = [...state.wishes];
    const [wish] = wishes.splice(currentIndex, 1);
    wishes.splice(nextIndex, 0, wish);
    return normalizeWorkbenchState({
        ...state,
        wishes,
        toast: "顺序已调整"
    });
};

export const moveWishToIndex = (state, wishId, targetIndex) => {
    const currentIndex = state.wishes.findIndex((wish) => wish.id === wishId);
    const safeTargetIndex = Math.max(0, Math.min(Number(targetIndex), state.wishes.length - 1));
    if (currentIndex < 0 || currentIndex === safeTargetIndex) {
        return state;
    }
    const wishes = [...state.wishes];
    const [wish] = wishes.splice(currentIndex, 1);
    wishes.splice(safeTargetIndex, 0, wish);
    return normalizeWorkbenchState({
        ...state,
        wishes,
        toast: "顺序已调整"
    });
};

export const updateWish = (state, wishId, updater) => normalizeWorkbenchState({
    ...state,
    wishes: state.wishes.map((wish) => (wish.id === wishId ? updater(wish) : wish))
});

export const setWishStatus = (state, wishId, status) => updateWish(state, wishId, (wish) => ({
    ...wish,
    status
}));

export const getCurrentAngel = (state) => {
    const angelId = state.selectionOrder[state.activeSelectionIndex];
    return state.participants.find((participant) => participant.id === angelId) || null;
};

const getCurrentSelectableWishes = (state) => {
    const angel = getCurrentAngel(state);
    if (!angel) {
        return [];
    }
    const assignedWishIds = getAssignedWishIds(state);
    return getRoundApprovedWishes(state).filter((wish) => (
        wish.ownerId !== angel.id && !assignedWishIds.has(wish.id)
    ));
};

const canCompleteRemainingAssignments = (angelIds, wishes) => {
    if (!angelIds.length) {
        return wishes.length === 0;
    }

    const search = (remainingAngelIds, remainingWishes) => {
        if (!remainingAngelIds.length) {
            return remainingWishes.length === 0;
        }

        const [angelId] = [...remainingAngelIds].sort((a, b) => (
            remainingWishes.filter((wish) => wish.ownerId !== a).length
            - remainingWishes.filter((wish) => wish.ownerId !== b).length
        ));
        const nextAngelIds = remainingAngelIds.filter((id) => id !== angelId);
        const possibleWishes = remainingWishes.filter((wish) => wish.ownerId !== angelId);

        return possibleWishes.some((wish) => search(
            nextAngelIds,
            remainingWishes.filter((item) => item.id !== wish.id)
        ));
    };

    return search(angelIds, wishes);
};

const canCompleteAfterChoice = (state, wishId) => {
    const assignedWishIds = getAssignedWishIds(state);
    const remainingAngelIds = state.selectionOrder.slice(state.activeSelectionIndex + 1);
    const remainingWishes = getRoundApprovedWishes(state).filter((wish) => (
        wish.id !== wishId && !assignedWishIds.has(wish.id)
    ));

    return canCompleteRemainingAssignments(remainingAngelIds, remainingWishes);
};

export const wouldSelectionCauseConflict = (state, wishId) => (
    getCurrentSelectableWishes(state).some((wish) => wish.id === wishId)
    && !canCompleteAfterChoice(state, wishId)
);

export const getAvailableWishes = (state) => (
    getCurrentSelectableWishes(state).filter((wish) => canCompleteAfterChoice(state, wish.id))
);

const getChoiceLabel = (index) => {
    const alphabetSize = 26;
    if (index < alphabetSize) {
        return String.fromCharCode(65 + index);
    }
    return `${Math.floor(index / alphabetSize) + 1}-${String.fromCharCode(65 + (index % alphabetSize))}`;
};

export const buildBlindChoiceText = (state) => {
    const angel = getCurrentAngel(state);
    const availableWishes = getAvailableWishes(state);
    if (!angel || !availableWishes.length) {
        return "";
    }
    return [
        `第 ${state.round.code || "-"} 轮 ${state.round.theme || "未命名"}`,
        `发给：${angel.name}`,
        "请选择一个愿望",
        ...availableWishes.map((wish, index) => `${getChoiceLabel(index)}. ${wish.body}`)
    ].join("\n");
};

export const getForcedSwapCandidate = (state) => {
    const angel = getCurrentAngel(state);
    if (getRoundApprovedWishes(state).length < getRoundPlayerParticipants(state).length) {
        return null;
    }
    const unassignedWishes = getRoundApprovedWishes(state).filter((wish) => (
        !state.assignments.some((assignment) => assignment.wishId === wish.id)
    ));
    if (!angel || getAvailableWishes(state).length || unassignedWishes.length !== 1) {
        return null;
    }
    const [blockedWish] = unassignedWishes;
    if (blockedWish.ownerId !== angel.id) {
        return null;
    }
    const swapAssignment = [...state.assignments].reverse().find((assignment) => {
        const assignedWish = getWishById(state, assignment.wishId);
        return assignedWish && assignedWish.ownerId !== angel.id;
    });
    if (!swapAssignment) {
        return null;
    }
    return {
        angelId: angel.id,
        wishId: swapAssignment.wishId,
        swapAngelId: swapAssignment.angelId,
        swapWishId: blockedWish.id
    };
};

export const applyForcedSwap = (state) => {
    const candidate = getForcedSwapCandidate(state);
    if (!candidate) {
        return { ...state, toast: "请撤回或重置" };
    }
    return normalizeWorkbenchState({
        ...state,
        activeSelectionIndex: Math.min(state.activeSelectionIndex + 1, state.selectionOrder.length),
        assignments: state.assignments
            .map((assignment) => (
                assignment.angelId === candidate.swapAngelId
                    ? { ...assignment, wishId: candidate.swapWishId }
                    : assignment
            ))
            .concat({ angelId: candidate.angelId, wishId: candidate.wishId }),
        toast: "已交换"
    });
};

export const selectWishForCurrentAngel = (state, wishId) => {
    const angel = getCurrentAngel(state);
    const wish = getWishById(state, wishId);
    if (!angel || !wish) {
        return state;
    }

    const alreadyAssigned = getAssignedWishIds(state).has(wishId);
    if (alreadyAssigned || wish.ownerId === angel.id || wish.status !== "approved" || !getRoundPlayerIds(state).has(wish.ownerId)) {
        return { ...state, toast: "不可选择" };
    }
    if (!getAvailableWishes(state).some((availableWish) => availableWish.id === wishId)) {
        return { ...state, toast: "会导致冲突" };
    }

    return normalizeWorkbenchState({
        ...state,
        activeSelectionIndex: Math.min(state.activeSelectionIndex + 1, state.selectionOrder.length),
        assignments: [...state.assignments, { angelId: angel.id, wishId }],
        toast: `${angel.name} -> ${getParticipantName(state, wish.ownerId)}`
    });
};

export const removeAssignment = (state, angelId) => normalizeWorkbenchState({
    ...state,
    assignments: state.assignments.filter((assignment) => assignment.angelId !== angelId),
    activeSelectionIndex: Math.max(0, state.assignments.length - 1),
    toast: "已撤回"
});

export const resetSelection = (state) => normalizeWorkbenchState({
    ...state,
    activeSelectionIndex: 0,
    assignments: [],
    toast: "已重置"
});

export const cycleCompletionStatus = (state, participantId) => {
    const currentStatus = normalizeCompletionStatus(state.completionByParticipantId[participantId]);
    const nextStatus = completionStatuses[(completionStatuses.indexOf(currentStatus) + 1) % completionStatuses.length];
    return {
        ...state,
        completionByParticipantId: {
            ...state.completionByParticipantId,
            [participantId]: nextStatus
        },
        toast: "已标记"
    };
};

export const setCompletionStatus = (state, participantId, status) => {
    if (!completionStatuses.includes(status)) {
        return state;
    }
    return {
        ...state,
        completionByParticipantId: {
            ...state.completionByParticipantId,
            [participantId]: status
        },
        toast: "已标记"
    };
};

export const buildRevealRows = (state) => {
    const roundPlayerIds = getRoundPlayerIds(state);
    const roundWishIds = new Set(getRoundApprovedWishes(state).map((wish) => wish.id));
    const visibleAssignments = state.assignments.filter((assignment) => (
        roundPlayerIds.has(assignment.angelId) && roundWishIds.has(assignment.wishId)
    ));
    const assignedWishIds = new Set(visibleAssignments.map((assignment) => assignment.wishId));
    const assignedRows = visibleAssignments.map((assignment, index) => {
        const wish = getWishById(state, assignment.wishId);
        return {
            index: index + 1,
            wish: wish?.body || "",
            king: wish ? getParticipantName(state, wish.ownerId) : "未知",
            angel: getParticipantName(state, assignment.angelId),
            status: completionStatusLabels[normalizeCompletionStatus(state.completionByParticipantId[assignment.angelId])]
        };
    });

    const unassignedRows = getRoundApprovedWishes(state)
        .filter((wish) => !assignedWishIds.has(wish.id))
        .map((wish, index) => ({
            index: assignedRows.length + index + 1,
            wish: wish.body,
            king: getParticipantName(state, wish.ownerId),
            angel: "未分配",
            status: completionStatusLabels.pending
        }));

    return [...assignedRows, ...unassignedRows];
};

export const buildRevealMarkdown = (state) => {
    const rows = buildRevealRows(state);
    return [
        `# 第 ${state.round.code} 轮 ${state.round.theme}`,
        "",
        `| 序号 | 国王 | 愿望 | 天使 | ${REVEAL_STATUS_HEADER} |`,
        "| --- | --- | --- | --- | --- |",
        ...rows.map((row) => `| ${row.index} | ${row.king} | ${row.wish} | ${row.angel} | ${row.status} |`)
    ].join("\n");
};

export const buildRevealAnnouncement = (state) => (
    `第 ${state.round.code || "-"} 轮「${state.round.theme || "未命名"}」国王与天使揭晓`
);

export const buildRevealCsv = (state) => {
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [
        ["序号", "国王", "愿望", "天使", REVEAL_STATUS_HEADER],
        ...buildRevealRows(state).map((row) => [row.index, row.king, row.wish, row.angel, row.status])
    ].map((row) => row.map(escapeCell).join(",")).join("\n");
};

export const buildRevealTsv = (state) => [
    ["序号", "国王", "愿望", "天使", REVEAL_STATUS_HEADER],
    ...buildRevealRows(state).map((row) => [row.index, row.king, row.wish, row.angel, row.status])
].map((row) => row.map((cell) => String(cell ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")).join("\n");

const escapeSvgText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
})[char]);

const trimSvgText = (value, maxLength) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export const buildRevealSvg = (state) => {
    const rows = buildRevealRows(state);
    const width = 1200;
    const rowHeight = 92;
    const top = 188;
    const height = top + rows.length * rowHeight + 72;
    const title = `第 ${state.round.code || "-"} 轮 ${state.round.theme || "未命名"}`;
    const rowCards = rows.map((row, index) => {
        const y = top + index * rowHeight;
        return `
            <g>
                <rect x="64" y="${y}" width="1072" height="72" rx="16" fill="#fffefa" stroke="#ded8cc"/>
                <text x="94" y="${y + 44}" fill="#28231d" font-size="24" font-weight="800">${escapeSvgText(String(row.index).padStart(2, "0"))}</text>
                <text x="168" y="${y + 34}" fill="#28231d" font-size="22" font-weight="700">${escapeSvgText(trimSvgText(row.wish, 38))}</text>
                <text x="168" y="${y + 58}" fill="#786f62" font-size="18">${escapeSvgText(row.status)}</text>
                <text x="862" y="${y + 34}" fill="#786f62" font-size="18">国王</text>
                <text x="862" y="${y + 58}" fill="#28231d" font-size="22" font-weight="800">${escapeSvgText(row.king)}</text>
                <text x="1004" y="${y + 34}" fill="#786f62" font-size="18">天使</text>
                <text x="1004" y="${y + 58}" fill="#2f6f6b" font-size="22" font-weight="800">${escapeSvgText(row.angel)}</text>
            </g>
        `;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#f4f3ee"/>
        <circle cx="1010" cy="82" r="260" fill="#2f6f6b" opacity="0.08"/>
        <text x="64" y="82" fill="#786f62" font-size="24" font-weight="700">${escapeSvgText(title)}</text>
        <text x="64" y="132" fill="#28231d" font-size="48" font-weight="900">国王与天使揭晓</text>
        <text x="64" y="166" fill="#786f62" font-size="20">${escapeSvgText(`共 ${rows.length} 个愿望`)}</text>
        ${rowCards}
    </svg>`;
};

export const archiveCurrentRound = (state) => {
    const existingArchive = state.archives.find((item) => (
        item.round?.code === state.round.code && item.round?.theme === state.round.theme
    ));
    const archive = {
        id: existingArchive?.id || createId("a"),
        archivedAt: new Date().toISOString(),
        round: clone(state.round),
        participants: clone(state.participants),
        wishes: clone(state.wishes),
        assignments: clone(state.assignments),
        completionByParticipantId: clone(state.completionByParticipantId),
        revealRows: buildRevealRows(state)
    };
    return normalizeWorkbenchState({
        ...state,
        archives: [archive, ...state.archives.filter((item) => item.id !== archive.id)].slice(0, 20),
        toast: "已归档"
    });
};

export const restoreArchivedRound = (state, archiveId) => {
    const archive = state.archives.find((item) => item.id === archiveId);
    if (!archive) {
        return {
            ...state,
            toast: "未找到"
        };
    }
    return normalizeWorkbenchState({
        ...state,
        round: archive.round,
        participants: archive.participants,
        wishes: archive.wishes,
        assignments: archive.assignments,
        completionByParticipantId: archive.completionByParticipantId,
        selectionOrder: archive.participants.map((participant) => participant.id),
        activeSelectionIndex: archive.assignments.length,
        toast: "已恢复"
    });
};

export const startNewRound = (state) => normalizeWorkbenchState({
    ...state,
    round: {
        ...state.round,
        code: String(Number.parseInt(state.round.code, 10) + 1 || state.round.code),
        god: "",
        theme: "",
        themeSetDate: toLocalIsoDate(),
        ...getDefaultRoundDeadlines()
    },
    wishes: [],
    assignments: [],
    activeSelectionIndex: 0,
    completionByParticipantId: Object.fromEntries(state.participants.map((participant) => [participant.id, "pending"])),
    toast: "新一轮"
});

export const getStageCounts = (state) => ({
    members: getRoundPlayerParticipants(state).length,
    wish: getSubmittedWishOwnerIds(getRoundApprovedWishes(state)).size,
    select: state.assignments.filter((assignment) => {
        const roundPlayerIds = getRoundPlayerIds(state);
        const roundWishIds = new Set(getRoundApprovedWishes(state).map((wish) => wish.id));
        return roundPlayerIds.has(assignment.angelId) && roundWishIds.has(assignment.wishId);
    }).length,
    finish: getSelectionParticipants(state).filter((participant) => state.completionByParticipantId[participant.id] === "done").length,
    reveal: buildRevealRows(state).filter((row) => row.angel !== "未分配").length
});
