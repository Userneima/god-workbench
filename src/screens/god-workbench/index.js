import { escapeHtml } from "../../lib/helpers.js";
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
    buildThemeAnnouncement,
    buildWishCollectionFollowup,
    buildRevealRows,
    clearWorkbenchState,
    completionStatusLabels,
    createInitialWorkbenchState,
    cycleCompletionStatus,
    getAvailableWishes,
    getCurrentAngel,
    getForcedSwapCandidate,
    getParticipantName,
    getStageCounts,
    getSubmittedWishOwnerIds,
    getWishById,
    loadWorkbenchState,
    moveWish,
    normalizeWorkbenchState,
    removeAssignment,
    removeParticipant,
    removeWish,
    resetSelection,
    restoreArchivedRound,
    saveWorkbenchState,
    saveMemberRoster,
    selectWishForCurrentAngel,
    setManualAssignment,
    startNewRound,
    updateRoundField
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

const buildAngelNotice = (state) => {
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

const getActiveStage = (state, counts) => {
    if (!counts.members) return "members";
    if (!state.round.theme) return "theme";
    if (counts.members < 2 || !state.wishes.length || counts.wish < counts.members) return "wishes";
    if (counts.select < state.selectionOrder.length) return "select";
    if (counts.finish < state.participants.length) return "completion";
    return "reveal";
};

const renderStageButton = ({ label, value, target, state }, activeStage) => `
    <button
        class="god-workbench__stage ${target === activeStage ? "is-active" : ""} ${state ? `is-${state}` : ""}"
        type="button"
        data-action="scroll-section"
        data-section-target="${escapeHtml(target)}"
    >
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
    </button>
`;

const renderStageNext = (label, target) => `<button class="god-workbench__stage-next" type="button" data-action="scroll-section" data-section-target="${escapeHtml(target)}">${escapeHtml(label)}</button>`;

const renderStageRail = (state, focusedStage = "") => {
    const counts = getStageCounts(state);
    const activeStage = getActiveStage(state, counts);
    const highlightedStage = focusedStage || activeStage;
    const stageOrder = ["members", "theme", "wishes", "select", "completion", "reveal"];
    const activeIndex = stageOrder.indexOf(activeStage);
    const stageState = (target) => target === highlightedStage ? "" : stageOrder.indexOf(target) < activeIndex ? "done" : "pending";
    const fixedStages = [
        { label: "成员名单", value: `${counts.members}`, target: "members" }
    ];
    const roundStages = [
        { label: "发主题", value: state.round.theme || "未定", target: "theme" },
        { label: "录愿望", value: `${counts.wish}/${counts.members}`, target: "wishes" },
        { label: "截图盲选", value: `${counts.select}/${state.selectionOrder.length}`, target: "select" },
        { label: "看完成", value: `${counts.finish}/${state.participants.length}`, target: "completion" },
        { label: "生成揭晓", value: `${counts.reveal}`, target: "reveal" }
    ];

    return `
        <div class="god-workbench__rail-group">
            <div class="god-workbench__rail-label">名单</div>
            ${fixedStages.map((stage) => renderStageButton({ ...stage, state: stageState(stage.target) }, highlightedStage)).join("")}
        </div>
        <div class="god-workbench__rail-group">
            <div class="god-workbench__rail-label">本轮</div>
            ${roundStages.map((stage) => renderStageButton({ ...stage, state: stageState(stage.target) }, highlightedStage)).join("")}
        </div>
    `;
};

const renderRoundControls = (state) => {
    const fields = [
        ["code", "轮次"],
        ["god", "上帝"],
        ["themeSetDate", "定题日"],
        ["wishDeadline", "许愿"],
        ["finishDeadline", "完成"],
        ["revealAt", "揭晓"]
    ];

    return fields.map(([field, label]) => `
        <label class="god-workbench__field">
            <span>${escapeHtml(label)}</span>
            <input type="${field === "themeSetDate" ? "date" : "text"}" value="${escapeHtml(state.round[field] || "")}" data-input="round" data-field="${escapeHtml(field)}" />
        </label>
    `).join("");
};

const renderMessageCard = ({ title, body, action }) => `
    <div class="god-workbench__message-card">
        <div>
            <span>${escapeHtml(title)}</span>
            <p>${escapeHtml(body)}</p>
        </div>
        <button type="button" data-action="${escapeHtml(action)}">复制</button>
    </div>
`;

const renderThemeTimeline = (state) => [["wishDeadline", "愿望截止"], ["finishDeadline", "完成截止"], ["revealAt", "揭晓时间"]].map(([field, label]) => `
    <label class="god-workbench__theme-time">
        <span>${escapeHtml(label)}</span>
        <input value="${escapeHtml(state.round[field] || "")}" data-input="round" data-field="${escapeHtml(field)}" placeholder="${escapeHtml(label)}" />
    </label>
`).join("");

const renderThemeKickoff = (state) => `
    <section class="god-workbench__panel god-workbench__panel--theme" data-section="theme">
        <div class="god-workbench__panel-head">
            <h2>发主题</h2>
            <span>${escapeHtml(state.round.theme || "未命名")}</span>
        </div>
        <label class="god-workbench__theme-field">
            <span>本周主题</span>
            <input value="${escapeHtml(state.round.theme || "")}" data-input="round" data-field="theme" placeholder="主题" />
        </label>
        <div class="god-workbench__theme-timeline">${renderThemeTimeline(state)}</div>
        ${state.round.theme ? `<div class="god-workbench__message-grid">
            ${renderMessageCard({
                title: "发布主题",
                body: buildThemeAnnouncement(state),
                action: "copy-theme-announcement"
            })}
        </div>${renderStageNext("录愿望", "wishes")}` : ""}
    </section>
`;

const renderRoundPanel = (state, forceOpen = false) => `
    <section class="god-workbench__panel god-workbench__panel--round god-workbench__panel--compact" data-section="round">
        <details class="god-workbench__compact-panel" ${forceOpen ? "open" : ""}>
            <summary>
                <div>
                    <span>低频设置</span>
                    <strong>本轮设置</strong>
                </div>
                <span>${escapeHtml(state.round.god || state.round.theme || "未设置")}</span>
            </summary>
            <div class="god-workbench__round-form">${renderRoundControls(state)}</div>
        </details>
    </section>
`;

const renderSelectionPanel = (state, currentAngel) => `
    <section class="god-workbench__panel god-workbench__panel--select" data-section="select">
        <div class="god-workbench__panel-head god-workbench__panel-head--lead">
            <div>
                <span>截图盲选</span>
                <h2>${escapeHtml(currentAngel ? `截图给 ${currentAngel.name}` : "盲选完成")}</h2>
            </div>
            <strong>${escapeHtml(`${state.assignments.length}/${state.selectionOrder.length}`)}</strong>
        </div>
        <div class="god-workbench__selection-layout">
            <div class="god-workbench__blind-list" aria-label="可选愿望">${renderAvailableWishes(state)}</div>
            <div class="god-workbench__selection-side">
                <div class="god-workbench__handoff">
                    <span>发给</span>
                    <strong>${escapeHtml(currentAngel?.name || "已完成")}</strong>
                </div>
                ${renderLatestAssignment(state)}
                <div class="god-workbench__queue">${renderSelectionQueue(state)}</div>
                <div class="god-workbench__actions">
                    <button class="god-workbench__host-primary" type="button" data-action="copy-blind-choice" ${getAvailableWishes(state).length ? "" : "disabled"}>${escapeHtml(currentAngel ? `复制给 ${currentAngel.name}` : "复制列表")}</button>
                    <button type="button" data-action="undo-selection" ${state.assignments.length ? "" : "disabled"}>撤回上一步</button>
                    <button type="button" data-action="reset-selection">重置盲选</button>
                </div>
            </div>
        </div>
    </section>
`;

const renderLatestAssignment = (state) => {
    const latestAssignment = getLatestAssignment(state);
    if (!latestAssignment) {
        return "";
    }

    return `
        <div class="god-workbench__latest-assignment">
            <span>刚选中</span>
            <strong>${escapeHtml(latestAssignment.angelName)} -> ${escapeHtml(latestAssignment.kingName)}</strong>
            <p>${escapeHtml(latestAssignment.wishBody)}</p>
            <button type="button" data-action="copy-angel-notice">复制通知</button>
        </div>
    `;
};

const renderParticipants = (state) => state.participants.length ? state.participants.map((participant, index) => `
    <div class="god-workbench__member-row">
        <span class="god-workbench__member-order">${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
        <strong>${escapeHtml(participant.name)}</strong>
        <button type="button" data-action="remove-participant" data-participant-id="${escapeHtml(participant.id)}">移除</button>
    </div>
`).join("") : `<div class="god-workbench__empty">暂无成员</div>`;

const renderMembersPanel = (state, forceOpen = false) => `
    <section class="god-workbench__panel god-workbench__panel--members god-workbench__panel--compact" data-section="members">
        <details class="god-workbench__compact-panel" ${forceOpen || !state.participants.length ? "open" : ""}>
            <summary>
                <div>
                    <span>成员库</span>
                    <strong>成员名单</strong>
                </div>
                <span>${escapeHtml(state.participants.length)} 人</span>
            </summary>
            <div class="god-workbench__member-setup">
                <form class="god-workbench__inline-form" data-form="participant">
                    <textarea name="name" placeholder="花名，换行添加"></textarea>
                    <button type="submit">添加</button>
                </form>
                <div class="god-workbench__member-list" aria-label="成员名单">${renderParticipants(state)}</div>
            </div>
            ${state.participants.length ? renderStageNext("定主题", "theme") : ""}
        </details>
    </section>
`;

const renderWishReview = (state) => {
    if (!state.participants.length) {
        return `<div class="god-workbench__empty">暂无成员</div>`;
    }

    return state.participants.map((participant) => {
        const wish = state.wishes.find((item) => item.ownerId === participant.id);
        const index = wish ? state.wishes.findIndex((item) => item.id === wish.id) : -1;
        const assignment = wish ? state.assignments.find((item) => item.wishId === wish.id) : null;
        return `
            <form class="god-workbench__wish-ledger-item ${wish ? "" : "is-empty"}" data-form="wish">
                <div class="god-workbench__wish-rank">
                    <span>${escapeHtml(wish ? `第 ${String(index + 1).padStart(2, "0")} 个` : "未录")}</span>
                    <strong>${escapeHtml(participant.name)}</strong>
                </div>
                <div class="god-workbench__wish-entry">
                    <input type="hidden" name="ownerId" value="${escapeHtml(participant.id)}" />
                    <textarea name="body" placeholder="愿望">${escapeHtml(wish?.body || "")}</textarea>
                    <span>${escapeHtml(assignment ? `已被 ${getParticipantName(state, assignment.angelId)} 选` : wish ? "待选" : "待录")}</span>
                </div>
                <div class="god-workbench__wish-tools">
                    <div class="god-workbench__actions">
                        <button type="submit">${escapeHtml(wish ? "保存" : "录入")}</button>
                        ${wish ? `<button type="button" data-action="move-wish-up" data-wish-id="${escapeHtml(wish.id)}" ${index === 0 ? "disabled" : ""}>上移</button><button type="button" data-action="move-wish-down" data-wish-id="${escapeHtml(wish.id)}" ${index === state.wishes.length - 1 ? "disabled" : ""}>下移</button><button type="button" data-action="remove-wish" data-wish-id="${escapeHtml(wish.id)}">删除</button>` : ""}
                    </div>
                </div>
            </form>
        `;
    }).join("");
};

const getMissingWishParticipants = (state) => {
    const submittedOwnerIds = getSubmittedWishOwnerIds(state.wishes);
    return state.participants.filter((participant) => !submittedOwnerIds.has(participant.id));
};

const renderWishProgress = (state) => {
    const counts = getStageCounts(state);
    const missingParticipants = getMissingWishParticipants(state);
    return `
        <div class="god-workbench__wish-progress">
            <strong>${escapeHtml(counts.wish)}/${escapeHtml(counts.members)}</strong>
            <span>${escapeHtml(missingParticipants.length ? `未收 ${missingParticipants.map((participant) => participant.name).join("、")}` : "已收齐")}</span>
            <button type="button" data-action="copy-wish-followup">复制催愿望</button>
        </div>
    `;
};

const renderWishesPanel = (state) => {
    const counts = getStageCounts(state);
    return `
        <section class="god-workbench__panel god-workbench__panel--wishes" data-section="wishes">
            <div class="god-workbench__panel-head">
                <h2>录愿望</h2>
                <span>${escapeHtml(counts.wish)}/${escapeHtml(counts.members)}</span>
            </div>
            ${renderWishProgress(state)}
            <div class="god-workbench__wish-ledger">${renderWishReview(state)}</div>
            ${counts.members > 1 && counts.wish >= counts.members ? renderStageNext("开始盲选", "select") : ""}
        </section>
    `;
};

const renderSelectionQueue = (state) => state.selectionOrder.map((participantId, index) => {
    const assignment = state.assignments.find((item) => item.angelId === participantId);
    const className = [
        "god-workbench__queue-item",
        index === state.activeSelectionIndex ? "is-active" : "",
        assignment ? "is-done" : ""
    ].filter(Boolean).join(" ");
    return `
        <div class="${className}">
            <span>${escapeHtml(getParticipantName(state, participantId))}</span>
            <strong>${assignment ? "已选" : index === state.activeSelectionIndex ? "当前" : "等待"}</strong>
        </div>
    `;
}).join("");

const getChoiceLabel = (index) => {
    const alphabetSize = 26;
    if (index < alphabetSize) {
        return String.fromCharCode(65 + index);
    }
    return `${Math.floor(index / alphabetSize) + 1}-${String.fromCharCode(65 + (index % alphabetSize))}`;
};

const renderAvailableWishes = (state) => {
    const availableWishes = getAvailableWishes(state);
    const currentAngel = getCurrentAngel(state);
    const forcedSwapCandidate = getForcedSwapCandidate(state);
    const approvedUnassigned = state.wishes.filter((wish) => (
        wish.status === "approved"
        && !state.assignments.some((assignment) => assignment.wishId === wish.id)
    ));

    if (state.participants.length < 2) {
        return `<div class="god-workbench__empty">至少 2 人</div>`;
    }

    if (!currentAngel) {
        return `<div class="god-workbench__empty">已完成</div>`;
    }

    if (!availableWishes.length && approvedUnassigned.length) {
        if (forcedSwapCandidate) {
            return renderForcedSwapCard(state, forcedSwapCandidate);
        }
        return `<div class="god-workbench__empty">需调整</div>`;
    }

    if (!availableWishes.length) {
        return `<div class="god-workbench__empty">暂无愿望</div>`;
    }

    return `
        <div class="god-workbench__screenshot-card" data-screenshot-card>
            <div class="god-workbench__screenshot-head">
                <span>第 ${escapeHtml(state.round.code || "-")} 轮</span>
                <strong>${escapeHtml(state.round.theme || "未命名")}</strong>
            </div>
            <div class="god-workbench__screenshot-title">请选择一个愿望</div>
            <div class="god-workbench__screenshot-options">
                ${availableWishes.map((wish, index) => `
                    <button class="god-workbench__wish-choice" type="button" data-action="select-wish" data-wish-id="${escapeHtml(wish.id)}">
                        <strong>${escapeHtml(getChoiceLabel(index))}</strong>
                        <span>${escapeHtml(wish.body)}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;
};

const renderForcedSwapCard = (state, candidate) => `
    <div class="god-workbench__swap-card">
        <span>可交换</span>
        <strong>${escapeHtml(getParticipantName(state, candidate.swapAngelId))} ↔ ${escapeHtml(getParticipantName(state, candidate.angelId))}</strong>
        <button type="button" data-action="apply-forced-swap">强制交换</button>
    </div>
`;

const needsManualAdjustment = (state) => {
    const currentAngel = getCurrentAngel(state);
    if (state.participants.length < 2 || !currentAngel || getStageCounts(state).wish < state.participants.length) {
        return false;
    }
    const approvedUnassigned = state.wishes.filter((wish) => (
        wish.status === "approved"
        && !state.assignments.some((assignment) => assignment.wishId === wish.id)
    ));
    return !getForcedSwapCandidate(state) && !getAvailableWishes(state).length && Boolean(approvedUnassigned.length);
};

const renderAssignmentRows = (state) => {
    const approvedWishes = state.wishes.filter((wish) => wish.status === "approved");
    if (!state.participants.length) {
        return `<div class="god-workbench__empty">暂无成员</div>`;
    }

    return state.participants.map((participant) => {
        const assignment = state.assignments.find((item) => item.angelId === participant.id);
        return `
            <div class="god-workbench__manual-row">
                <span>${escapeHtml(participant.name)}</span>
                <select data-action="manual-assignment" data-angel-id="${escapeHtml(participant.id)}">
                    <option value="">未分配</option>
                    ${approvedWishes.map((wish) => `
                        <option value="${escapeHtml(wish.id)}" ${assignment?.wishId === wish.id ? "selected" : ""} ${wish.ownerId === participant.id ? "disabled" : ""}>
                            ${escapeHtml(getParticipantName(state, wish.ownerId))} · ${escapeHtml(wish.body)}
                        </option>
                    `).join("")}
                </select>
                <button type="button" data-action="remove-assignment" data-angel-id="${escapeHtml(participant.id)}">撤回</button>
            </div>
        `;
    }).join("");
};

const renderManualPanel = (state, forceOpen = false) => {
    const shouldOpen = forceOpen || needsManualAdjustment(state);
    return `
        <section class="god-workbench__panel god-workbench__panel--manual" data-section="manual">
            <details class="god-workbench__exception-panel" ${shouldOpen ? "open" : ""}>
                <summary>
                    <div>
                        <span>异常处理</span>
                        <strong>人工调整</strong>
                    </div>
                    <span>${escapeHtml(shouldOpen ? "需调整" : `${state.assignments.length} 组`)}</span>
                </summary>
                <div class="god-workbench__manual-list">${renderAssignmentRows(state)}</div>
            </details>
        </section>
    `;
};

const getCompletionStats = (state) => {
    const doneParticipants = state.participants.filter((participant) => (
        state.completionByParticipantId[participant.id] === "done"
    ));
    const reminderParticipants = state.participants.filter((participant) => (
        state.completionByParticipantId[participant.id] !== "done"
    ));
    return {
        doneParticipants,
        reminderParticipants
    };
};

const renderCompletion = (state, participants = state.participants) => participants.map((participant) => {
    const status = state.completionByParticipantId[participant.id] || "unseen";
    return `
        <button class="god-workbench__completion-row" type="button" data-action="cycle-completion" data-participant-id="${escapeHtml(participant.id)}">
            <span>${escapeHtml(participant.name)}</span>
            <strong class="god-workbench__completion god-workbench__completion--${escapeHtml(status)}">${escapeHtml(completionStatusLabels[status])}</strong>
        </button>
    `;
}).join("");

const renderCompletionPanel = (state) => {
    const { doneParticipants, reminderParticipants } = getCompletionStats(state);
    return `
        <section class="god-workbench__panel god-workbench__panel--completion" data-section="completion">
            <div class="god-workbench__panel-head">
                <h2>看完成</h2>
                <div class="god-workbench__actions">
                    <span>${escapeHtml(doneParticipants.length)}/${escapeHtml(state.participants.length)}</span>
                    <button type="button" data-action="copy-completion-followup">复制提醒</button>
                </div>
            </div>
            <div class="god-workbench__completion-summary">
                <div>
                    <span>已完成</span>
                    <strong>${escapeHtml(doneParticipants.length)}</strong>
                </div>
                <div>
                    <span>提醒名单</span>
                    <strong>${escapeHtml(reminderParticipants.length ? reminderParticipants.map((participant) => participant.name).join("、") : "无")}</strong>
                </div>
            </div>
            <div class="god-workbench__completion-board">
                <section><h3>待确认</h3><div class="god-workbench__completion-list">${renderCompletion(state, reminderParticipants)}</div></section>
                <section><h3>已完成</h3><div class="god-workbench__completion-list">${doneParticipants.length ? renderCompletion(state, doneParticipants) : `<div class="god-workbench__empty">无</div>`}</div></section>
            </div>
        </section>
    `;
};

const renderRevealRows = (state) => buildRevealRows(state).map((row) => `
    <tr>
        <td>${escapeHtml(row.index)}</td>
        <td>${escapeHtml(row.wish)}</td>
        <td>${escapeHtml(row.king)}</td>
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

const renderArchivePanel = (state, forceOpen = false) => `
    <section class="god-workbench__panel god-workbench__panel--archives god-workbench__panel--compact" data-section="archives">
        <details class="god-workbench__compact-panel" ${forceOpen ? "open" : ""}>
            <summary>
                <div>
                    <span>历史记录</span>
                    <strong>归档</strong>
                </div>
                <span>${escapeHtml(state.archives.length)} 轮</span>
            </summary>
            <div class="god-workbench__archive-list">${renderArchives(state)}</div>
        </details>
    </section>
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
        <div class="god-workbench__reveal-list"><table class="god-workbench__reveal-table"><thead><tr><th>序号</th><th>愿望</th><th>国王</th><th>天使</th><th>状态</th></tr></thead><tbody>${renderRevealRows(state)}</tbody></table></div>
    </section>
`;

const renderMainFlow = (state, currentAngel, focusedStage = "") => {
    const counts = getStageCounts(state);
    const activeStage = getActiveStage(state, counts);
    const panelRenderers = {
        theme: () => renderThemeKickoff(state),
        wishes: () => renderWishesPanel(state),
        select: () => renderSelectionPanel(state, currentAngel),
        completion: () => renderCompletionPanel(state),
        reveal: () => renderRevealPanel(state),
        round: () => renderRoundPanel(state, selectedStage === "round"),
        manual: () => renderManualPanel(state, selectedStage === "manual"),
        members: () => renderMembersPanel(state, selectedStage === "members"),
        archives: () => renderArchivePanel(state, selectedStage === "archives")
    };
    const selectedStage = panelRenderers[focusedStage] ? focusedStage : activeStage;
    const mainPanel = panelRenderers[selectedStage]();
    const manualPanel = selectedStage === "select" && counts.members > 1 && needsManualAdjustment(state) ? renderManualPanel(state) : "";
    return selectedStage === "members" || selectedStage === "round" || selectedStage === "archives" || selectedStage === "manual"
        ? mainPanel.replace("god-workbench__panel ", "god-workbench__panel god-workbench__panel--focus-support ")
        : `${mainPanel}${manualPanel}`;
};

const render = (root, state, focusedStage = "") => {
    const currentAngel = getCurrentAngel(state);
    root.innerHTML = `
        <main class="god-workbench">
            <aside class="god-workbench__rail">
                <a class="god-workbench__brand" href="?view=god-workbench" aria-label="上帝工作台">
                    <span>G</span>
                    <strong>上帝工作台</strong>
                </a>
                <nav class="god-workbench__stages" aria-label="阶段">${renderStageRail(state, focusedStage)}</nav>
                <div class="god-workbench__rail-actions"></div>
            </aside>

            <section class="god-workbench__shell">
                <header class="god-workbench__topbar">
                    <div>
                        <div class="god-workbench__round-code">第 ${escapeHtml(state.round.code || "-")} 轮</div>
                        <h1>上帝工作台</h1>
                    </div>
                    <div class="god-workbench__top-actions">
                        <span>${escapeHtml(state.toast || "已保存")}</span>
                        <details class="god-workbench__more">
                            <summary>更多</summary>
                            <div>
                                <button type="button" data-action="scroll-section" data-section-target="round">本轮设置</button>
                                <button type="button" data-action="scroll-section" data-section-target="archives">历史</button>
                                <button type="button" data-action="scroll-section" data-section-target="manual">人工调整</button>
                                <button type="button" data-action="archive-round">归档</button>
                                <button type="button" data-action="new-round">新一轮</button>
                                <button type="button" data-action="clear-local">清空</button>
                            </div>
                        </details>
                    </div>
                </header>

                <section class="god-workbench__grid" aria-label="工作台">
                    ${renderMainFlow(state, currentAngel, focusedStage)}
                </section>
            </section>
        </main>
    `;
    root.querySelector(".god-workbench__stage.is-active")
        ?.scrollIntoView?.({ block: "nearest", inline: "center" });
};

export const mountGodWorkbenchPage = ({ root }) => {
    let state = loadWorkbenchState();
    let focusedStage = "";

    const setState = (nextState, { syncMemberRoster = false } = {}) => {
        state = normalizeWorkbenchState(nextState);
        if (syncMemberRoster) {
            saveMemberRoster(state.participants);
        }
        saveWorkbenchState(state);
        render(root, state, focusedStage);
    };

    root.addEventListener("change", (event) => {
        const roundInput = event.target.closest("[data-input='round']");
        if (roundInput) {
            focusedStage = roundInput.closest("[data-section='theme']") || roundInput.dataset.field === "theme" ? "theme" : "round";
            setState(updateRoundField(state, roundInput.dataset.field, roundInput.value));
            return;
        }

        const selector = event.target.closest("[data-action='manual-assignment']");
        if (!selector) {
            return;
        }
        if (!selector.value) {
            setState(removeAssignment(state, selector.dataset.angelId));
            return;
        }
        setState(setManualAssignment(state, selector.dataset.angelId, selector.value));
    });

    root.addEventListener("submit", (event) => {
        const form = event.target.closest("[data-form]");
        if (!form) {
            return;
        }
        event.preventDefault();
        const formData = new FormData(form);
        if (form.dataset.form === "participant") {
            focusedStage = "members";
            setState(String(formData.get("name") || "").split(/[\n,，、;；]+/).map((name) => name.trim()).filter(Boolean).reduce((nextState, name) => addParticipant(nextState, name), state), { syncMemberRoster: true });
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

        if (action === "scroll-section") {
            focusedStage = trigger.dataset.sectionTarget;
            render(root, state, focusedStage);
            return;
        }

        if (action === "remove-participant") {
            focusedStage = "members";
            setState(removeParticipant(state, participantId), { syncMemberRoster: true });
        }
        if (action === "remove-wish") setState(removeWish(state, wishId));
        if (action === "move-wish-up") setState(moveWish(state, wishId, "up"));
        if (action === "move-wish-down") setState(moveWish(state, wishId, "down"));
        if (action === "select-wish") {
            const nextState = selectWishForCurrentAngel(state, wishId);
            if (nextState.assignments.length >= nextState.selectionOrder.length) focusedStage = "completion";
            setState(nextState);
        }
        if (action === "apply-forced-swap") setState(applyForcedSwap(state));
        if (action === "undo-selection") setState(removeAssignment(state, state.assignments.at(-1)?.angelId));
        if (action === "remove-assignment") setState(removeAssignment(state, angelId));
        if (action === "reset-selection") setState(resetSelection(state));
        if (action === "cycle-completion") setState(cycleCompletionStatus(state, participantId));
        if (action === "archive-round") setState(archiveCurrentRound(state));
        if (action === "restore-archive") setState(restoreArchivedRound(state, archiveId));
        if (action === "new-round") {
            focusedStage = "theme";
            setState(startNewRound(archiveCurrentRound(state)));
        }
        if (action === "clear-local") {
            clearWorkbenchState();
            focusedStage = "";
            setState(createInitialWorkbenchState());
        }
        const copyActions = {
            "copy-reveal": [buildRevealMarkdown(state), "已复制"],
            "copy-reveal-announcement": [buildRevealAnnouncement(state), "已复制文案"],
            "copy-reveal-tsv": [buildRevealTsv(state), "已复制 Excel"],
            "copy-theme-announcement": [buildThemeAnnouncement(state), "已复制主题"],
            "copy-wish-followup": [buildWishCollectionFollowup(state), "已复制催愿望"],
            "copy-blind-choice": [buildBlindChoiceText(state), "已复制列表"],
            "copy-completion-followup": [buildCompletionFollowup(state), "已复制提醒"],
            "copy-angel-notice": [buildAngelNotice(state), "已复制通知"]
        };
        if (copyActions[action]) {
            void copyText(copyActions[action][0]).then(() => setState({ ...state, toast: copyActions[action][1] }));
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

    render(root, state, focusedStage);
};
