import { escapeHtml } from "../../lib/helpers.js";
import { createCloudSyncClient } from "./cloud.js";
import {
    addParticipant,
    addWish,
    applyForcedSwap,
    buildBlindChoiceText,
    buildCompletionFollowup,
    archiveCurrentRound,
    buildRevealCsv,
    buildRevealAnnouncement,
    buildRevealMarkdown,
    buildRevealSvg,
    buildRevealTsv,
    buildSingleWishReminder,
    buildThemeAnnouncement,
    buildWorkbenchBackup,
    buildRevealRows,
    clearWorkbenchState,
    completionStatuses,
    completionStatusLabels,
    createInitialWorkbenchState,
    REVEAL_STATUS_HEADER,
    getAvailableWishes,
    getCurrentAngel,
    getForcedSwapCandidate,
    getParticipantName,
    getRoundApprovedWishes,
    getRoundPlayerParticipants,
    getSelectionParticipants,
    getStageCounts,
    getSubmittedWishOwnerIds,
    getWishById,
    loadWorkbenchState,
    moveWishToIndex,
    normalizeWorkbenchState,
    removeAssignment,
    removeParticipant,
    removeWish,
    resetSelection,
    restoreArchivedRound,
    saveWorkbenchState,
    saveMemberRoster,
    selectWishForCurrentAngel,
    setCompletionStatus,
    startNewRound,
    updateRoundField,
    wouldSelectionCauseConflict
} from "./model.js";
import "./styles.css";

export {
    buildRevealMarkdown,
    createInitialWorkbenchState,
    getAvailableWishes,
    selectWishForCurrentAngel
} from "./model.js";

const getLatestAssignment = (state) => {
    const assignment = state.assignments.at(-1);
    const wish = assignment ? getWishById(state, assignment.wishId) : null;
    if (!assignment || !wish) {
        return null;
    }

    return {
        angelName: getParticipantName(state, assignment.angelId),
        kingName: getParticipantName(state, wish.ownerId),
        wishBody: wish.body
    };
};

export const buildAngelNotice = (state) => {
    const latestAssignment = getLatestAssignment(state);
    if (!latestAssignment) {
        return "";
    }
    return [
        `你选到的是：${latestAssignment.kingName}`,
        `愿望：${latestAssignment.wishBody}`
    ].join("\n");
};

const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
};

const resizeWishTextarea = (textarea) => {
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 36)}px`;
};

const resizeWishTextareas = (root) => {
    root.querySelectorAll(".god-workbench__wish-row-form textarea[name='body']")
        .forEach(resizeWishTextarea);
};

const downloadTextFile = (filename, content, type = "text/plain") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const getBackupFilename = (state) => {
    const date = new Date().toISOString().slice(0, 10);
    const roundCode = String(state.round.code || "round").replace(/[^\w-]+/g, "-");
    return `god-workbench-${roundCode}-${date}.json`;
};

const createDefaultCloudStatus = () => ({
    state: "checking",
    label: "云端检查中",
    email: ""
});

const getCloudStatusLabel = (cloudStatus) => cloudStatus?.label || "本地保存";

const getCloudPayload = (state) => ({
    ...normalizeWorkbenchState(state),
    toast: ""
});

const getActiveStage = (state, counts) => {
    if (!counts.members) return "members";
    if (!state.round.god) return "god";
    if (!state.round.theme) return "theme";
    if (state.selectionOrder.length < 2) return "wishes";
    if (counts.select < state.selectionOrder.length) return "wishes";
    if (counts.finish < state.selectionOrder.length) return "completion";
    return "reveal";
};

/* ── Stepper ─────────────────────────────────────── */

const STEP_ORDER = ["god", "theme", "wishes", "completion", "reveal"];

const STEP_META = [
    { label: "选上帝",   target: "god" },
    { label: "发主题",   target: "theme" },
    { label: "愿望表",   target: "wishes" },
    { label: "看完成",   target: "completion" },
    { label: "生成揭晓", target: "reveal" }
];

const STEP_VALUES = {
    god:        (state)   => state.round.god || "未选",
    theme:      (state)   => state.round.theme || "未定",
    wishes:     (state, c) => `${c.wish}/${c.members}`,
    select:     (state, c) => `${c.select}/${state.selectionOrder.length}`,
    completion: (state, c) => `${c.finish}/${state.selectionOrder.length}`,
    reveal:     (_s, c)    => `${c.reveal}`
};

const renderStepper = (state, activeStage) => {
    if (activeStage === "members") return "";
    const counts = getStageCounts(state);
    const activeIndex = STEP_ORDER.indexOf(activeStage);

    return `
        <nav class="god-workbench__stepper" aria-label="游戏阶段">
            ${STEP_META.map((step, i) => {
                const status = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
                const value = STEP_VALUES[step.target](state, counts);
                return `
                    <button class="god-workbench__step is-${status}"
                        type="button"
                        data-action="scroll-stage"
                        data-stage="${escapeHtml(step.target)}">
                        <span class="god-workbench__step-dot">${status === "done" ? "" : ""}</span>
                        <span class="god-workbench__step-label">${escapeHtml(step.label)}</span>
                        <span class="god-workbench__step-value">${escapeHtml(value)}</span>
                    </button>
                `;
            }).join("")}
        </nav>
    `;
};

/* ── Stage panels (unchanged internally) ─────────── */

const renderGodSelect = (state) => `
    <select data-input="round" data-field="god" aria-label="本轮上帝">
        <option value="">我是</option>
        ${state.participants.map((participant) => `
            <option value="${escapeHtml(participant.name)}" ${state.round.god === participant.name ? "selected" : ""}>
                ${escapeHtml(participant.name)}
            </option>
        `).join("")}
    </select>
`;

const renderGodKickoff = (state) => `
    <section class="god-workbench__panel god-workbench__panel--god" data-section="god">
        <div class="god-workbench__panel-head">
            <h2>选上帝</h2>
            <span>${escapeHtml(state.round.god || "未选")}</span>
        </div>
        <div class="god-workbench__god-kickoff">
            <label class="god-workbench__setting-field god-workbench__setting-field--inline">
                <span>本轮的上帝，你是谁？</span>
                ${renderGodSelect(state)}
            </label>
        </div>
    </section>
`;

const renderThemeAnnouncementPreview = (state) => `
    <div class="god-workbench__preview-lines" aria-label="${escapeHtml(buildThemeAnnouncement(state))}">
        <p><span>本周主题：</span><strong class="god-workbench__preview-variable">${escapeHtml(state.round.theme || "未命名")}</strong></p>
        <p><span>请各位国王</span><strong class="god-workbench__preview-variable">${escapeHtml(state.round.wishDeadline || "愿望截止前")}</strong><span>将愿望发送给我哦</span></p>
    </div>
`;

const renderThemeKickoff = (state) => `
    <section class="god-workbench__panel god-workbench__panel--theme" data-section="theme">
        <div class="god-workbench__panel-head">
            <h2>发主题</h2>
            <span>${escapeHtml(state.round.theme || "未命名")}</span>
        </div>
        <div class="god-workbench__theme-layout">
            <div class="god-workbench__theme-inputs">
                <div class="god-workbench__theme-form">
                    <label class="god-workbench__setting-field">
                        <span>轮次</span>
                        <input value="${escapeHtml(state.round.code || "")}" data-input="round" data-field="code" placeholder="01" />
                    </label>
                    <label class="god-workbench__setting-field">
                        <span>上帝</span>
                        ${renderGodSelect(state)}
                    </label>
                    <label class="god-workbench__setting-field">
                        <span>本周主题</span>
                        <input value="${escapeHtml(state.round.theme || "")}" data-input="round" data-field="theme" placeholder="主题" />
                    </label>
                    <label class="god-workbench__setting-field">
                        <span>愿望截止</span>
                        <input value="${escapeHtml(state.round.wishDeadline || "")}" data-input="round" data-field="wishDeadline" placeholder="愿望截止" />
                    </label>
                </div>
            </div>
            <div class="god-workbench__theme-preview">
                <div class="god-workbench__message-card god-workbench__message-card--theme">
                    <div class="god-workbench__message-copy">
                        <span class="god-workbench__message-label">预览发布文案</span>
                        ${renderThemeAnnouncementPreview(state)}
                    </div>
                    <button type="button" data-action="copy-theme-announcement">复制</button>
                </div>
            </div>
        </div>
    </section>
`;

/* ── Members panel ──────────────────────────────── */

const renderParticipants = (state) => state.participants.length ? state.participants.map((participant, index) => `
    <div class="god-workbench__member-row">
        <span class="god-workbench__member-order">${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
        <strong>${escapeHtml(participant.name)}</strong>
        <button type="button" data-action="remove-participant" data-participant-id="${escapeHtml(participant.id)}">移除</button>
    </div>
`).join("") : `<div class="god-workbench__empty">暂无成员</div>`;

const renderMembersPanel = (state) => `
    <div class="god-workbench__utility-panel">
        <section class="god-workbench__member-setup">
            <form class="god-workbench__inline-form" data-form="participant">
                <input type="text" name="name" placeholder="输入花名" aria-label="花名" autocomplete="off" data-field="participant-name">
                <button type="submit">添加</button>
            </form>
            <div class="god-workbench__member-list" aria-label="成员名单">${renderParticipants(state)}</div>
        </section>
    </div>
`;

/* ── Wishes panel (unified table) ────────────────── */

const getSelectionSortBucket = ({ wish, currentAngel, assignedWishIds, availableWishIds }) => {
    if (!wish) {
        return 0;
    }
    if (availableWishIds.has(wish.id)) {
        return 0;
    }
    if (assignedWishIds.has(wish.id)) {
        return 2;
    }
    if (currentAngel && wish.ownerId === currentAngel.id) {
        return 1;
    }
    return 1;
};

const getSortedParticipantsForTable = (state, { isSelecting = false, currentAngel = null, availableWishes = [] } = {}) => getRoundPlayerParticipants(state).sort((a, b) => {
    const wishA = state.wishes.find((w) => w.ownerId === a.id);
    const wishB = state.wishes.find((w) => w.ownerId === b.id);
    if (isSelecting) {
        const assignedWishIds = new Set(state.assignments.map((assignment) => assignment.wishId));
        const availableWishIds = new Set(availableWishes.map((wish) => wish.id));
        const bucketA = getSelectionSortBucket({ wish: wishA, currentAngel, assignedWishIds, availableWishIds });
        const bucketB = getSelectionSortBucket({ wish: wishB, currentAngel, assignedWishIds, availableWishIds });
        if (bucketA !== bucketB) {
            return bucketA - bucketB;
        }
    }
    if (!wishA && !wishB) {
        return 0;
    }
    if (!wishA) return -1;
    if (!wishB) return 1;
    if (wishA && wishB) {
        return state.wishes.findIndex((w) => w.id === wishA.id) - state.wishes.findIndex((w) => w.id === wishB.id);
    }
    return 0;
});

const renderWishTableRows = (state) => {
    const roundPlayers = getRoundPlayerParticipants(state);
    if (!roundPlayers.length) {
        return `<div class="god-workbench__empty">暂无本轮玩家</div>`;
    }

    const counts = getStageCounts(state);
    const canStartSelection = state.selectionOrder.length > 1;
    const isSelecting = canStartSelection && counts.select < state.selectionOrder.length;
    const selectionStarted = canStartSelection || counts.select > 0;
    const currentAngel = getCurrentAngel(state);
    const availableWishes = getAvailableWishes(state);
    const roundApprovedWishes = getRoundApprovedWishes(state);
    const statusColumnLabel = isSelecting && currentAngel ? `给${currentAngel.name}选择` : "状态";

    const sortedParticipants = getSortedParticipantsForTable(state, { isSelecting, currentAngel, availableWishes });

    return `
        <table class="god-workbench__wish-table ${isSelecting ? "god-workbench__wish-table--selecting" : ""}">
            <thead>
                <tr>
                    <th class="god-workbench__wish-num">许愿顺序</th>
                    <th class="god-workbench__wish-name">姓名</th>
                    <th class="god-workbench__wish-body">愿望</th>
                    <th class="god-workbench__wish-status">${escapeHtml(statusColumnLabel)}</th>
                </tr>
            </thead>
            <tbody>
                ${sortedParticipants.map((participant) => {
                    const wish = state.wishes.find((w) => w.ownerId === participant.id);
                    const wishIndex = wish ? roundApprovedWishes.findIndex((w) => w.id === wish.id) : -1;
                    const assignment = wish ? state.assignments.find((a) => a.wishId === wish.id) : null;
                    const isAvailable = isSelecting && wish && availableWishes.some((w) => w.id === wish.id);
                    const isOwnWish = isSelecting && wish && currentAngel && wish.ownerId === currentAngel.id;
                    const isConflictChoice = isSelecting && wish && !assignment && !isOwnWish && wouldSelectionCauseConflict(state, wish.id);

                    return `
                        <tr
                            class="god-workbench__wish-row ${wish ? "is-submitted" : "is-empty"} ${isAvailable ? "is-available" : ""} ${isOwnWish ? "is-own" : ""} ${isConflictChoice ? "is-conflict" : ""}"
                            ${wish ? `data-wish-row-id="${escapeHtml(wish.id)}"` : ""}
                        >
                            <td class="god-workbench__wish-num">
                                ${wish ? `
                                    <button
                                        class="god-workbench__wish-drag"
                                        type="button"
                                        draggable="true"
                                        aria-label="拖拽调整 ${escapeHtml(participant.name)} 的许愿顺序"
                                        data-wish-id="${escapeHtml(wish.id)}"
                                    >⋮⋮</button>
                                    <span>${escapeHtml(String(wishIndex + 1).padStart(2, "0"))}</span>
                                ` : ""}
                            </td>
                            <td class="god-workbench__wish-name">${escapeHtml(participant.name)}</td>
                            <td class="god-workbench__wish-body">
                                ${!wish || !selectionStarted
                                    ? `<form class="god-workbench__wish-row-form" data-form="wish">
                                        <input type="hidden" name="ownerId" value="${escapeHtml(participant.id)}" />
                                        <textarea name="body" rows="1" placeholder="输入他的愿望，按回车录入">${escapeHtml(wish?.body || "")}</textarea>
                                        <div class="god-workbench__wish-row-actions">
                                            <button type="submit">${wish ? "保存" : "录入"}</button>
                                            ${wish ? `<button type="button" data-action="remove-wish" data-wish-id="${escapeHtml(wish.id)}">删除</button>` : ""}
                                        </div>
                                    </form>`
                                    : `<span>${escapeHtml(wish?.body || "—")}</span>`
                                }
                            </td>
                            <td class="god-workbench__wish-status">
                                ${!wish
                                    ? `<button type="button" data-action="copy-single-wish-reminder" data-participant-id="${escapeHtml(participant.id)}">复制催愿望</button>`
                                    : assignment
                                        ? `<span class="god-workbench__status-pill">天使 ${escapeHtml(getParticipantName(state, assignment.angelId))}</span>`
                                        : isSelecting && isAvailable
                                            ? `<button type="button" class="god-workbench__select-btn" data-action="select-wish" data-wish-id="${escapeHtml(wish.id)}" aria-label="记录 ${escapeHtml(currentAngel?.name || "当前成员")} 选择这个愿望">记录选择</button>`
                                            : isConflictChoice
                                                ? `<button type="button" class="god-workbench__select-btn" disabled title="选择后会导致后续冲突">会冲突</button>`
                                            : isOwnWish
                                                ? `<span class="god-workbench__wish-status--hidden">本人愿望</span>`
                                                : `<span class="god-workbench__status-pill">待选择</span>`
                                }
                            </td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    `;
};

const getMissingWishParticipants = (state) => {
    const submittedOwnerIds = getSubmittedWishOwnerIds(state.wishes);
    return getRoundPlayerParticipants(state).filter((participant) => !submittedOwnerIds.has(participant.id));
};

const renderWishProgress = (state) => {
    const counts = getStageCounts(state);
    const missingParticipants = getMissingWishParticipants(state);
    return `
        <div class="god-workbench__wish-progress">
            <strong>${escapeHtml(counts.wish)}/${escapeHtml(counts.members)}</strong>
            <span>${escapeHtml(missingParticipants.length ? `未收 ${missingParticipants.map((participant) => participant.name).join("、")}` : "已收齐")}</span>
        </div>
        <label class="god-workbench__wish-reminder-template">
            <span>催愿望文案</span>
            <input value="${escapeHtml(state.round.wishReminderTemplate || "")}" data-input="round" data-field="wishReminderTemplate" placeholder="某某，这周主题是：XX，你还没许愿哦。" />
        </label>
    `;
};

const renderSelectionBar = (state) => {
    const currentAngel = getCurrentAngel(state);
    const availableWishes = getAvailableWishes(state);
    const forcedSwapCandidate = getForcedSwapCandidate(state);
    const queueItems = state.selectionOrder.map((participantId, index) => {
        const assignment = state.assignments.find((item) => item.angelId === participantId);
        return `
            <span class="god-workbench__queue-dot ${index === state.activeSelectionIndex ? "is-active" : ""} ${assignment ? "is-done" : ""}">
                ${escapeHtml(getParticipantName(state, participantId))}
            </span>
        `;
    }).join("");

    if (forcedSwapCandidate) {
        return renderForcedSwapCard(state, forcedSwapCandidate);
    }

    if (!currentAngel) {
        return `
            <div class="god-workbench__selection-bar">
                <div class="god-workbench__handoff">
                    <span>状态</span>
                    <strong>选择完成</strong>
                </div>
                <div class="god-workbench__selection-queue">${queueItems}</div>
                <div class="god-workbench__selection-actions">
                    <button type="button" data-action="copy-blind-choice" disabled>复制列表</button>
                    <button type="button" data-action="undo-selection" ${state.assignments.length ? "" : "disabled"}>撤回</button>
                    <button type="button" data-action="reset-selection" ${state.assignments.length ? "" : "disabled"}>重置</button>
                </div>
            </div>
        `;
    }

    return `
        <div class="god-workbench__selection-bar">
            <div class="god-workbench__handoff">
                <span>截图给</span>
                <strong>${escapeHtml(currentAngel.name)}</strong>
            </div>
            <div class="god-workbench__selection-queue">${queueItems}</div>
            <div class="god-workbench__selection-actions">
                <button type="button" data-action="copy-blind-choice" ${availableWishes.length ? "" : "disabled"}>${currentAngel ? `复制给 ${escapeHtml(currentAngel.name)}` : "复制列表"}</button>
                <button type="button" data-action="undo-selection" ${state.assignments.length ? "" : "disabled"}>撤回</button>
                <button type="button" data-action="reset-selection">重置</button>
            </div>
        </div>
    `;
};

const renderWishesPanel = (state) => {
    const counts = getStageCounts(state);
    const canStartSelection = state.selectionOrder.length > 1;
    const isSelecting = canStartSelection && counts.select < state.selectionOrder.length;
    const currentAngel = getCurrentAngel(state);
    const hasMissingWishes = counts.wish < counts.members;

    return `
        <section class="god-workbench__panel god-workbench__panel--wishes" data-section="wishes">
            <div class="god-workbench__panel-head">
                <h2>${isSelecting ? `截图给 ${escapeHtml(currentAngel?.name || "")}` : "愿望表"}</h2>
                <span>${escapeHtml(canStartSelection ? `${counts.select}/${state.selectionOrder.length}` : `${counts.wish}/${counts.members}`)}</span>
            </div>
            ${hasMissingWishes || !canStartSelection ? renderWishProgress(state) : ""}
            ${canStartSelection ? renderSelectionBar(state) : ""}
            <div class="god-workbench__wish-table-wrap">${renderWishTableRows(state)}</div>
        </section>
    `;
};

/* ── Blind selection helpers ────────────────────── */

const renderForcedSwapCard = (state, candidate) => `
    <div class="god-workbench__swap-card">
        <span>可交换</span>
        <strong>${escapeHtml(getParticipantName(state, candidate.swapAngelId))} ↔ ${escapeHtml(getParticipantName(state, candidate.angelId))}</strong>
        <button type="button" data-action="apply-forced-swap">强制交换</button>
    </div>
`;

/* ── Completion panel ───────────────────────────── */

const getCompletionStats = (state) => {
    const countsByStatus = Object.fromEntries(completionStatuses.map((status) => [status, 0]));
    getSelectionParticipants(state).forEach((participant) => {
        const status = completionStatuses.includes(state.completionByParticipantId[participant.id])
            ? state.completionByParticipantId[participant.id]
            : "pending";
        countsByStatus[status] += 1;
    });
    const reminderParticipants = getSelectionParticipants(state).filter((participant) => (
        state.completionByParticipantId[participant.id] !== "done"
    ));
    return {
        countsByStatus,
        doneCount: countsByStatus.done,
        reminderParticipants
    };
};

const renderCompletion = (state, participants = getSelectionParticipants(state)) => participants.map((participant) => {
    const status = completionStatuses.includes(state.completionByParticipantId[participant.id])
        ? state.completionByParticipantId[participant.id]
        : "pending";
    return `
        <div class="god-workbench__completion-row">
            <span>${escapeHtml(participant.name)}</span>
            <div class="god-workbench__completion-options" aria-label="${escapeHtml(participant.name)} 完成状态">
                ${completionStatuses.map((item) => `
                    <button
                        class="god-workbench__completion-option god-workbench__completion-option--${escapeHtml(item)} ${status === item ? "is-active" : ""}"
                        type="button"
                        data-action="set-completion"
                        data-participant-id="${escapeHtml(participant.id)}"
                        data-status="${escapeHtml(item)}"
                        aria-pressed="${status === item ? "true" : "false"}"
                    >${escapeHtml(completionStatusLabels[item])}</button>
                `).join("")}
            </div>
        </div>
    `;
}).join("");

const renderCompletionPanel = (state) => {
    const { countsByStatus, doneCount, reminderParticipants } = getCompletionStats(state);
    const selectionParticipants = getSelectionParticipants(state);
    return `
        <section class="god-workbench__panel god-workbench__panel--completion" data-section="completion">
            <div class="god-workbench__panel-head">
                <h2>完成状况记录</h2>
                <div class="god-workbench__actions">
                    <span>${escapeHtml(doneCount)}/${escapeHtml(selectionParticipants.length)} 已完成</span>
                    <button type="button" data-action="copy-completion-followup" ${reminderParticipants.length ? "" : "disabled"}>复制待确认提醒</button>
                </div>
            </div>
            <div class="god-workbench__completion-summary">
                ${completionStatuses.map((item) => `
                    <div>
                        <span>${escapeHtml(completionStatusLabels[item])}</span>
                        <strong>${escapeHtml(countsByStatus[item])}</strong>
                    </div>
                `).join("")}
            </div>
            <div class="god-workbench__completion-board">
                <div class="god-workbench__completion-list">${renderCompletion(state)}</div>
            </div>
        </section>
    `;
};

/* ── Reveal & archive ───────────────────────────── */

const renderRevealRows = (state) => buildRevealRows(state).map((row) => `
    <tr>
        <td>${escapeHtml(row.index)}</td>
        <td>${escapeHtml(row.king)}</td>
        <td>${escapeHtml(row.wish)}</td>
        <td>${escapeHtml(row.angel)}</td>
        <td>${escapeHtml(row.status)}</td>
    </tr>
`).join("");

const renderArchives = (state) => {
    if (!state.archives.length) {
        return `<div class="god-workbench__empty">暂无归档</div>`;
    }

    return state.archives.slice(0, 5).map((archive) => `
        <div class="god-workbench__archive-row">
            <span>${escapeHtml(archive.round?.code || "")} · ${escapeHtml(archive.round?.theme || "")}</span>
            <strong>${escapeHtml((archive.archivedAt || "").slice(0, 10))}</strong>
            <button type="button" data-action="restore-archive" data-archive-id="${escapeHtml(archive.id)}">恢复</button>
        </div>
    `).join("");
};

const renderArchivePanel = (state) => `
    <div class="god-workbench__utility-panel">
        <div class="god-workbench__archive-list">${renderArchives(state)}</div>
    </div>
`;

const renderCloudAuth = (cloudStatus) => {
    if (cloudStatus.state === "unconfigured") {
        return `
            <div class="god-workbench__cloud-form">
                <span>缺少 Supabase 环境变量</span>
                <button type="button" data-action="export-backup">下载备份</button>
            </div>
        `;
    }

    if (cloudStatus.state === "authenticated" || cloudStatus.state === "syncing" || cloudStatus.state === "synced") {
        return `
            <div class="god-workbench__cloud-form">
                <span>${escapeHtml(cloudStatus.email || "已登录")}</span>
                <button type="button" data-action="cloud-sign-out">退出</button>
                <button type="button" data-action="export-backup">下载备份</button>
            </div>
        `;
    }

    return `
        <form class="god-workbench__cloud-form" data-form="cloud-auth">
            <label>
                <span>邮箱</span>
                <input type="email" name="email" autocomplete="email" required />
            </label>
            <label>
                <span>密码</span>
                <input type="password" name="password" autocomplete="current-password" required />
            </label>
            <button type="submit" data-auth-mode="sign-in">登录</button>
            <button type="submit" data-auth-mode="sign-up">注册</button>
        </form>
    `;
};

const renderDataPanel = (state, cloudStatus) => `
    <div class="god-workbench__utility-panel">
        <div class="god-workbench__data-actions">
            <div>
                <strong>Supabase</strong>
                <span>${escapeHtml(getCloudStatusLabel(cloudStatus))} · ${escapeHtml(state.archives.length)} 轮归档</span>
            </div>
            ${renderCloudAuth(cloudStatus)}
        </div>
    </div>
`;

const renderRevealPanel = (state) => `
    <section class="god-workbench__panel god-workbench__panel--reveal" data-section="reveal">
        <div class="god-workbench__panel-head">
            <h2>生成揭晓</h2>
            <div class="god-workbench__actions">
                <button type="button" data-action="copy-reveal-announcement">复制文案</button>
                <button type="button" data-action="copy-reveal">复制 Markdown</button>
                <button type="button" data-action="copy-reveal-tsv">复制 Excel</button>
                <button type="button" data-action="export-reveal-svg">导出图片</button>
                <button type="button" data-action="export-csv">导出 CSV</button>
                <button type="button" data-action="archive-round">${state.archives.some((item) => item.round?.code === state.round.code && item.round?.theme === state.round.theme) ? "更新归档" : "归档本轮"}</button>
                <button type="button" data-action="new-round">开新一轮</button>
            </div>
        </div>
        <div class="god-workbench__reveal-list"><table class="god-workbench__reveal-table"><thead><tr><th>序号</th><th>国王</th><th>愿望</th><th>天使</th><th>${escapeHtml(REVEAL_STATUS_HEADER)}</th></tr></thead><tbody>${renderRevealRows(state)}</tbody></table></div>
    </section>
`;

/* ── Content assembly ───────────────────────────── */

const PANEL_RENDERERS = {
    god:        (s)  => renderGodKickoff(s),
    theme:      (s)  => renderThemeKickoff(s),
    wishes:     (s)  => renderWishesPanel(s),
    completion: (s)  => renderCompletionPanel(s),
    reveal:     (s)  => renderRevealPanel(s)
};

const renderContent = (state, currentAngel, cloudStatus, activeStage) => {
    if (activeStage === "members") {
        return `
            <div class="god-workbench__stage-row is-active" data-stage="members">
                <section class="god-workbench__panel god-workbench__panel--members">
                    <div class="god-workbench__panel-head">
                        <h2>成员名单</h2>
                    </div>
                    <div class="god-workbench__empty">请点击右上角「成员」添加所有参与者，上帝本人也要在名单里</div>
                </section>
            </div>
        `;
    }

    const counts = getStageCounts(state);
    const activeIndex = STEP_ORDER.indexOf(activeStage);

    return STEP_ORDER.map((stage, i) => {
        const isActive = i === activeIndex;
        const panel = PANEL_RENDERERS[stage](state, currentAngel, cloudStatus, activeStage);
        return `
            <div class="god-workbench__stage-row ${isActive ? "is-active" : i < activeIndex ? "is-done" : "is-pending"}" data-stage="${escapeHtml(stage)}">
                ${panel}
            </div>
        `;
    }).join("");
};

/* ── Utility bar ────────────────────────────────── */

const UTILITY_SECTIONS = [
    { label: "归档", target: "archives", value: (s) => `${s.archives.length}轮`, render: (s) => renderArchivePanel(s) },
    { label: "云端", target: "data", value: (_s, cs) => getCloudStatusLabel(cs), render: (s, cs) => renderDataPanel(s, cs) }
];

const renderUtilityBar = (state, cloudStatus) => `
    <footer class="god-workbench__utility">
        ${UTILITY_SECTIONS.map((section) => `
            <details class="god-workbench__utility-item" data-utility="${escapeHtml(section.target)}">
                <summary>
                    <strong>${escapeHtml(section.label)}</strong>
                    <span>${escapeHtml(section.value(state, cloudStatus))}</span>
                </summary>
                <div class="god-workbench__utility-drop">${section.render(state, cloudStatus)}</div>
            </details>
        `).join("")}
    </footer>
`;

/* ── Shell ──────────────────────────────────────── */

const render = (root, state, cloudStatus, membersPanelOpen = false) => {
    const currentAngel = getCurrentAngel(state);
    const counts = getStageCounts(state);
    const activeStage = getActiveStage(state, counts);

    root.innerHTML = `
        <main class="god-workbench">
            <header class="god-workbench__topbar">
                <a class="god-workbench__brand" href="?view=god-workbench" aria-label="上帝工作台">
                    <span>G</span>
                </a>
                <div class="god-workbench__round-context">
                    <span>第 ${escapeHtml(state.round.code || "-")} 轮</span>
                    ${state.round.theme ? `<strong>${escapeHtml(state.round.theme)}</strong>` : ""}
                    ${state.round.god ? `<span>上帝 ${escapeHtml(state.round.god)}</span>` : ""}
                </div>
                <div class="god-workbench__top-actions">
                    <button class="god-workbench__members-toggle ${membersPanelOpen ? "is-active" : ""}" type="button" data-action="toggle-members">
                        成员 ${escapeHtml(String(state.participants.length))}人
                    </button>
                    <span class="god-workbench__toast">${escapeHtml(state.toast || "已保存")}</span>
                    <span class="god-workbench__cloud-pill">${escapeHtml(getCloudStatusLabel(cloudStatus))}</span>
                    <details class="god-workbench__more">
                        <summary>更多</summary>
                        <div>
                            <button type="button" data-action="export-backup">下载备份</button>
                            <button type="button" data-action="archive-round">归档本轮</button>
                            <button type="button" data-action="new-round">开新一轮</button>
                            <button type="button" data-action="clear-local">清空本地</button>
                        </div>
                    </details>
                </div>
            </header>

            ${renderStepper(state, activeStage)}

            <section class="god-workbench__content" aria-label="工作台">
                ${renderContent(state, currentAngel, cloudStatus, activeStage)}
            </section>

            ${renderUtilityBar(state, cloudStatus)}

            <div class="god-workbench__members-overlay ${membersPanelOpen ? "is-open" : ""}">
                <div class="god-workbench__members-overlay-panel">
                    <div class="god-workbench__members-overlay-head">
                        <h3>成员名单</h3>
                        <button type="button" data-action="toggle-members" aria-label="关闭">×</button>
                    </div>
                    ${renderMembersPanel(state)}
                </div>
            </div>
        </main>
    `;

    resizeWishTextareas(root);
};

/* ── Mount ──────────────────────────────────────── */

export const mountGodWorkbenchPage = ({ root }) => {
    let state = loadWorkbenchState();
    let cloudStatus = createDefaultCloudStatus();
    let cloudSaveTimer = 0;
    let cloudHydrating = false;
    let membersPanelOpen = false;
    let draggedWishId = "";
    const cloudClient = createCloudSyncClient();

    const renderNow = () => render(root, state, cloudStatus, membersPanelOpen);

    const setCloudStatus = (nextStatus) => {
        cloudStatus = {
            ...cloudStatus,
            ...nextStatus
        };
        renderNow();
    };

    const canSaveToCloud = () => (
        cloudClient
        && ["authenticated", "syncing", "synced"].includes(cloudStatus.state)
    );

    const saveToCloud = () => {
        if (!canSaveToCloud()) {
            return;
        }
        window.clearTimeout(cloudSaveTimer);
        setCloudStatus({ state: "syncing", label: "云端保存中" });
        cloudSaveTimer = window.setTimeout(() => {
            void cloudClient.saveState(getCloudPayload(state))
                .then(() => setCloudStatus({ state: "synced", label: "云端已保存" }))
                .catch(() => setCloudStatus({ state: "error", label: "云端保存失败" }));
        }, 520);
    };

    const setState = (nextState, { syncMemberRoster = false, syncCloud = true } = {}) => {
        state = normalizeWorkbenchState(nextState);
        if (syncMemberRoster) {
            saveMemberRoster(state.participants);
        }
        saveWorkbenchState(state);
        renderNow();
        if (syncCloud) {
            saveToCloud();
        }
    };

    const parseParticipantNames = (value) => (
        String(value || "")
            .split(/[\n,，、;；]+/)
            .map((name) => name.trim())
            .filter(Boolean)
    );

    const addParticipantsFromText = (value) => {
        const names = parseParticipantNames(value);
        if (!names.length) {
            return;
        }
        setState(names.reduce((nextState, name) => addParticipant(nextState, name), state), { syncMemberRoster: true });
    };

    const hydrateFromCloud = async () => {
        if (!cloudClient || cloudHydrating) {
            return;
        }
        cloudHydrating = true;
        setCloudStatus({ state: "syncing", label: "云端同步中" });
        try {
            const remote = await cloudClient.loadState();
            if (remote?.state) {
                state = normalizeWorkbenchState({
                    ...remote.state,
                    toast: "已从云端同步"
                });
                saveMemberRoster(state.participants);
                saveWorkbenchState(state);
                setCloudStatus({ state: "synced", label: "云端已同步" });
                return;
            }
            await cloudClient.saveState(getCloudPayload(state));
            setCloudStatus({ state: "synced", label: "云端已保存" });
        } catch {
            setCloudStatus({ state: "error", label: "云端同步失败" });
        } finally {
            cloudHydrating = false;
        }
    };

    const initializeCloud = async () => {
        if (!cloudClient) {
            setCloudStatus({ state: "unconfigured", label: "本地保存" });
            return;
        }

        try {
            const session = await cloudClient.getSession();
            if (session?.user) {
                setCloudStatus({
                    state: "authenticated",
                    label: "云端已连接",
                    email: session.user.email || ""
                });
                await hydrateFromCloud();
            } else {
                setCloudStatus({ state: "signedOut", label: "本地保存", email: "" });
            }
        } catch {
            setCloudStatus({ state: "error", label: "云端连接失败" });
        }

        cloudClient.onAuthStateChange((_event, session) => {
            if (session?.user) {
                cloudStatus = {
                    state: "authenticated",
                    label: "云端已连接",
                    email: session.user.email || ""
                };
                renderNow();
                void hydrateFromCloud();
                return;
            }
            setCloudStatus({ state: "signedOut", label: "本地保存", email: "" });
        });
    };

    root.addEventListener("change", (event) => {
        const roundInput = event.target.closest("[data-input='round']");
        if (roundInput) {
            setState(updateRoundField(state, roundInput.dataset.field, roundInput.value));
            return;
        }

        return;
    });

    root.addEventListener("paste", (event) => {
        const participantNameInput = event.target.closest("[data-field='participant-name']");
        if (!participantNameInput) {
            return;
        }
        const pastedText = event.clipboardData?.getData("text") || "";
        if (!/[\n,，、;；]/.test(pastedText)) {
            return;
        }
        event.preventDefault();
        addParticipantsFromText(pastedText);
    });

    root.addEventListener("input", (event) => {
        const textarea = event.target.closest(".god-workbench__wish-row-form textarea[name='body']");
        if (textarea) {
            resizeWishTextarea(textarea);
        }
    });

    root.addEventListener("submit", (event) => {
        const form = event.target.closest("[data-form]");
        if (!form) {
            return;
        }
        event.preventDefault();
        const formData = new FormData(form);
        if (form.dataset.form === "cloud-auth") {
            const email = String(formData.get("email") || "").trim();
            const password = String(formData.get("password") || "");
            const mode = event.submitter?.dataset.authMode || "sign-in";
            if (!cloudClient || !email || !password) {
                setCloudStatus({ state: "signedOut", label: "无法登录" });
                return;
            }
            setCloudStatus({ state: "syncing", label: mode === "sign-up" ? "注册中" : "登录中" });
            void (mode === "sign-up" ? cloudClient.signUp(email, password) : cloudClient.signIn(email, password))
                .then(({ data, error }) => {
                    if (error) {
                        throw error;
                    }
                    if (data?.session?.user) {
                        setCloudStatus({
                            state: "authenticated",
                            label: "云端已连接",
                            email: data.session.user.email || email
                        });
                        void hydrateFromCloud();
                        return;
                    }
                    setCloudStatus({ state: "signedOut", label: "检查邮箱", email });
                })
                .catch(() => setCloudStatus({ state: "error", label: mode === "sign-up" ? "注册失败" : "登录失败" }));
            return;
        }
        if (form.dataset.form === "participant") {
            addParticipantsFromText(formData.get("name"));
        }
        if (form.dataset.form === "wish") {
            setState(addWish(state, {
                ownerId: formData.get("ownerId"),
                body: formData.get("body")
            }));
        }
    });

    root.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-action]");
        if (!trigger) {
            return;
        }

        const action = trigger.dataset.action;
        const wishId = trigger.dataset.wishId;
        const participantId = trigger.dataset.participantId;
        const angelId = trigger.dataset.angelId;
        const archiveId = trigger.dataset.archiveId;

        if (action === "scroll-stage") {
            const stage = trigger.dataset.stage;
            const target = root.querySelector(`[data-stage="${stage}"]`);
            if (target && typeof target.scrollIntoView === "function") {
                target.scrollIntoView({ block: "start", behavior: "smooth" });
            }
            return;
        }

        if (action === "toggle-members") {
            membersPanelOpen = !membersPanelOpen;
            renderNow();
            return;
        }

        if (action === "remove-participant") {
            setState(removeParticipant(state, participantId), { syncMemberRoster: true });
        }
        if (action === "remove-wish") setState(removeWish(state, wishId));
        if (action === "select-wish") {
            setState(selectWishForCurrentAngel(state, wishId));
        }
        if (action === "apply-forced-swap") setState(applyForcedSwap(state));
        if (action === "undo-selection") setState(removeAssignment(state, state.assignments.at(-1)?.angelId));
        if (action === "reset-selection") setState(resetSelection(state));
        if (action === "set-completion") setState(setCompletionStatus(state, participantId, trigger.dataset.status));
        if (action === "archive-round") setState(archiveCurrentRound(state));
        if (action === "restore-archive") setState(restoreArchivedRound(state, archiveId));
        if (action === "new-round") {
            setState(startNewRound(archiveCurrentRound(state)));
        }
        if (action === "clear-local") {
            clearWorkbenchState();
            setState(createInitialWorkbenchState());
        }
        if (action === "export-backup") {
            downloadTextFile(getBackupFilename(state), buildWorkbenchBackup(state), "application/json;charset=utf-8");
            setState({ ...state, toast: "已导出备份" });
        }
        if (action === "cloud-sign-out" && cloudClient) {
            void cloudClient.signOut()
                .then(() => setCloudStatus({ state: "signedOut", label: "本地保存", email: "" }))
                .catch(() => setCloudStatus({ state: "error", label: "退出失败" }));
        }
        const copyActions = {
            "copy-reveal": [buildRevealMarkdown(state), "已复制"],
            "copy-reveal-announcement": [buildRevealAnnouncement(state), "已复制文案"],
            "copy-reveal-tsv": [buildRevealTsv(state), "已复制 Excel"],
            "copy-theme-announcement": [buildThemeAnnouncement(state), "已复制主题"],
            "copy-blind-choice": [buildBlindChoiceText(state), "已复制列表"],
            "copy-completion-followup": [buildCompletionFollowup(state), "已复制提醒"],
            "copy-angel-notice": [buildAngelNotice(state), "已复制通知"]
        };
        if (copyActions[action]) {
            void copyText(copyActions[action][0]).then(() => setState({ ...state, toast: copyActions[action][1] }));
        }
        if (action === "copy-single-wish-reminder") {
            void copyText(buildSingleWishReminder(state, participantId)).then(() => setState({ ...state, toast: "已复制催愿望" }));
        }
        const exportActions = {
            "export-csv": [`king-angel-${state.round.code}.csv`, buildRevealCsv(state), "text/csv;charset=utf-8", "已导出"],
            "export-reveal-svg": [`king-angel-${state.round.code}-reveal.svg`, buildRevealSvg(state), "image/svg+xml;charset=utf-8", "已导出图片"]
        };
        if (exportActions[action]) {
            downloadTextFile(...exportActions[action].slice(0, 3));
            setState({ ...state, toast: exportActions[action][3] });
        }
    });

    root.addEventListener("dragstart", (event) => {
        const dragHandle = event.target.closest(".god-workbench__wish-drag");
        if (!dragHandle) {
            return;
        }
        draggedWishId = dragHandle.dataset.wishId || "";
        event.dataTransfer?.setData("text/plain", draggedWishId);
        event.dataTransfer?.setDragImage?.(dragHandle, 8, 8);
        dragHandle.closest(".god-workbench__wish-row")?.classList.add("is-dragging");
    });

    root.addEventListener("dragover", (event) => {
        const targetRow = event.target.closest("[data-wish-row-id]");
        if (!draggedWishId || !targetRow || targetRow.dataset.wishRowId === draggedWishId) {
            return;
        }
        event.preventDefault();
        targetRow.classList.add("is-drag-over");
    });

    root.addEventListener("dragleave", (event) => {
        event.target.closest("[data-wish-row-id]")?.classList.remove("is-drag-over");
    });

    root.addEventListener("drop", (event) => {
        const targetRow = event.target.closest("[data-wish-row-id]");
        const droppedWishId = event.dataTransfer?.getData("text/plain") || draggedWishId;
        if (!droppedWishId || !targetRow || targetRow.dataset.wishRowId === droppedWishId) {
            return;
        }
        event.preventDefault();
        const targetIndex = state.wishes.findIndex((wish) => wish.id === targetRow.dataset.wishRowId);
        root.querySelectorAll(".god-workbench__wish-row.is-drag-over, .god-workbench__wish-row.is-dragging")
            .forEach((row) => row.classList.remove("is-drag-over", "is-dragging"));
        draggedWishId = "";
        setState(moveWishToIndex(state, droppedWishId, targetIndex));
    });

    root.addEventListener("dragend", () => {
        draggedWishId = "";
        root.querySelectorAll(".god-workbench__wish-row.is-drag-over, .god-workbench__wish-row.is-dragging")
            .forEach((row) => row.classList.remove("is-drag-over", "is-dragging"));
    });

    root.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
            return;
        }
        const textarea = event.target.closest(".god-workbench__wish-row-form textarea[name='body']");
        if (!textarea) {
            return;
        }
        event.preventDefault();
        textarea.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    renderNow();
    void initializeCloud();
};
