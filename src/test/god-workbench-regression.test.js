import { beforeEach, describe, expect, it } from "vitest";
import {
    addParticipant,
    addWish,
    archiveCurrentRound,
    buildCompletionFollowup,
    buildRevealRows,
    getAvailableWishes,
    getCurrentAngel,
    getRoundPlayerParticipants,
    getStageCounts,
    moveWishToIndex,
    normalizeWorkbenchState,
    removeAssignment,
    removeParticipant,
    removeWish,
    resetSelection,
    restoreArchivedRound,
    selectWishForCurrentAngel,
    setCompletionStatus,
    updateRoundField
} from "../screens/god-workbench/model.js";

const createCompletedRound = () => ({
    version: 2,
    round: {
        code: "01",
        theme: "毕业季",
        god: "上帝",
        themeSetDate: "2026-06-13",
        wishDeadline: "明天5点前",
        finishDeadline: "6月19日 20:00",
        revealAt: "6月19日 21:00",
        wishReminderTemplate: "某某，这周主题是：XX，你还没许愿哦。"
    },
    participants: [
        { id: "p1", name: "上帝" },
        { id: "p2", name: "雯子" },
        { id: "p3", name: "瓜子" },
        { id: "p4", name: "阿豹" }
    ],
    wishes: [
        { id: "w2", ownerId: "p2", body: "雯子的愿望", status: "approved" },
        { id: "w3", ownerId: "p3", body: "瓜子的愿望", status: "approved" },
        { id: "w4", ownerId: "p4", body: "阿豹的愿望", status: "approved" }
    ],
    selectionOrder: ["p2", "p3", "p4"],
    activeSelectionIndex: 3,
    assignments: [
        { angelId: "p2", wishId: "w3" },
        { angelId: "p3", wishId: "w4" },
        { angelId: "p4", wishId: "w2" }
    ],
    completionByParticipantId: {
        p1: "pending",
        p2: "done",
        p3: "pending",
        p4: "done"
    },
    archives: [],
    toast: ""
});

const expectCompletedRoundIntact = (state, expected = normalizeWorkbenchState(createCompletedRound())) => {
    expect(state.wishes).toEqual(expected.wishes);
    expect(state.selectionOrder).toEqual(expected.selectionOrder);
    expect(state.assignments).toEqual(expected.assignments);
    expect(state.activeSelectionIndex).toBe(expected.selectionOrder.length);
    expect(buildRevealRows(state).map((row) => row.angel)).toEqual(["雯子", "瓜子", "阿豹"]);
};

const createPartiallySelectedRound = () => normalizeWorkbenchState({
    ...createCompletedRound(),
    assignments: [
        { angelId: "p2", wishId: "w3" }
    ],
    activeSelectionIndex: 1,
    completionByParticipantId: {
        p1: "pending",
        p2: "pending",
        p3: "pending",
        p4: "pending"
    }
});

const selectFirstAvailableWish = (state) => {
    const [wish] = getAvailableWishes(state);
    return selectWishForCurrentAngel(state, wish?.id);
};

describe("god workbench regression cases", () => {
    beforeEach(() => window.localStorage.clear());

    it("keeps a completed round intact after accidentally changing the god and changing back", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());

        const wrongGod = normalizeWorkbenchState(updateRoundField(completedRound, "god", "雯子"));
        const restoredGod = normalizeWorkbenchState(updateRoundField(wrongGod, "god", "上帝"));

        expect(restoredGod.round.god).toBe("上帝");
        expectCompletedRoundIntact(restoredGod, completedRound);
    });

    it("keeps completed assignments after harmless round edits", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const renamed = updateRoundField(completedRound, "theme", "毕业快乐");
        const rescheduled = updateRoundField(renamed, "wishDeadline", "今晚8点前");
        const marked = setCompletionStatus(rescheduled, "p3", "done");

        expect(marked.round.theme).toBe("毕业快乐");
        expect(marked.round.wishDeadline).toBe("今晚8点前");
        expect(marked.completionByParticipantId.p3).toBe("done");
        expectCompletedRoundIntact(normalizeWorkbenchState(marked), completedRound);
    });

    it("keeps completed round data when appending a new member after reveal", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const nextState = addParticipant(completedRound, "饼干");

        expect(nextState.participants.map((participant) => participant.name)).toContain("饼干");
        expect(nextState.selectionOrder).toEqual(completedRound.selectionOrder);
        expect(nextState.assignments).toEqual(completedRound.assignments);
        expect(buildRevealRows(nextState)).toHaveLength(3);
        expect(nextState.completionByParticipantId[nextState.participants.at(-1).id]).toBe("pending");
    });

    it("rejects duplicate member append without changing completed round data", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const duplicate = addParticipant(completedRound, "雯子");

        expect(duplicate.toast).toBe("成员重复");
        expect(duplicate.participants).toEqual(completedRound.participants);
        expectCompletedRoundIntact(duplicate, completedRound);
    });

    it("removes an irrelevant non-round member without changing completed assignments", () => {
        const completedRound = normalizeWorkbenchState({
            ...createCompletedRound(),
            participants: [...createCompletedRound().participants, { id: "p5", name: "饼干" }],
            completionByParticipantId: {
                ...createCompletedRound().completionByParticipantId,
                p5: "pending"
            }
        });
        const nextState = removeParticipant(completedRound, "p5");

        expect(nextState.participants.map((participant) => participant.id)).not.toContain("p5");
        expectCompletedRoundIntact(nextState, normalizeWorkbenchState(createCompletedRound()));
    });

    it("removes all dependent data when a relevant round member is deleted", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const nextState = removeParticipant(completedRound, "p2");

        expect(nextState.participants.map((participant) => participant.id)).not.toContain("p2");
        expect(nextState.wishes.some((wish) => wish.ownerId === "p2")).toBe(false);
        expect(nextState.selectionOrder).not.toContain("p2");
        expect(nextState.assignments.some((assignment) => assignment.angelId === "p2" || assignment.wishId === "w2")).toBe(false);
        expect(buildRevealRows(nextState).every((row) => row.king !== "雯子" && row.angel !== "雯子")).toBe(true);
    });

    it("keeps god excluded after roster and round edits", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const withNewMember = addParticipant(completedRound, "饼干");
        const playerNames = getRoundPlayerParticipants(withNewMember).map((participant) => participant.name);

        expect(playerNames).not.toContain("上帝");
        expect(playerNames).toContain("饼干");
        expect(getStageCounts(withNewMember).members).toBe(4);
    });

    it("appends a late wish after selection has started without disturbing existing selection", () => {
        const partialRound = createPartiallySelectedRound();
        const withLateMember = addParticipant(partialRound, "饼干");
        const lateMember = withLateMember.participants.find((participant) => participant.name === "饼干");
        const withLateWish = addWish(withLateMember, {
            ownerId: lateMember.id,
            body: "饼干补交的愿望"
        });

        expect(withLateWish.wishes.at(-1).ownerId).toBe(lateMember.id);
        expect(withLateWish.selectionOrder).toEqual(["p2", "p3", "p4", lateMember.id]);
        expect(withLateWish.assignments).toEqual(partialRound.assignments);
        expect(withLateWish.activeSelectionIndex).toBe(partialRound.activeSelectionIndex);
    });

    it("rejects empty wishes and god wishes without changing selection state", () => {
        const partialRound = createPartiallySelectedRound();
        const emptyWish = addWish(partialRound, { ownerId: "p3", body: "   " });
        const godWish = addWish(partialRound, { ownerId: "p1", body: "上帝的愿望" });

        expect(emptyWish.toast).toBe("愿望为空");
        expect(godWish.toast).toBe("上帝不参与本轮许愿");
        expect(emptyWish.wishes).toEqual(partialRound.wishes);
        expect(godWish.wishes).toEqual(partialRound.wishes);
        expect(emptyWish.assignments).toEqual(partialRound.assignments);
        expect(godWish.assignments).toEqual(partialRound.assignments);
    });

    it("updates an existing wish body without losing its assignment", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const updated = addWish(completedRound, {
            ownerId: "p3",
            body: "瓜子更新后的愿望"
        });

        expect(updated.wishes.find((wish) => wish.ownerId === "p3").body).toBe("瓜子更新后的愿望");
        expect(updated.assignments).toEqual(completedRound.assignments);
        expect(buildRevealRows(updated).find((row) => row.king === "瓜子").wish).toBe("瓜子更新后的愿望");
    });

    it("removing an assigned wish removes only the dependent assignment", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const nextState = removeWish(completedRound, "w3");

        expect(nextState.wishes.some((wish) => wish.id === "w3")).toBe(false);
        expect(nextState.assignments).toEqual([
            { angelId: "p3", wishId: "w4" },
            { angelId: "p4", wishId: "w2" }
        ]);
        expect(buildRevealRows(nextState).map((row) => row.king)).toEqual(["阿豹", "雯子"]);
    });

    it("drag reordering after partial selection keeps existing assignment and recomputes remaining queue", () => {
        const partialRound = createPartiallySelectedRound();
        const moved = moveWishToIndex(partialRound, "w4", 0);

        expect(moved.assignments).toEqual(partialRound.assignments);
        expect(moved.selectionOrder).toEqual(["p4", "p2", "p3"]);
        expect(getCurrentAngel(moved).name).toBe("雯子");
    });

    it("undo and reselect keeps blind selection internally consistent", () => {
        const partialRound = createPartiallySelectedRound();
        const undone = removeAssignment(partialRound, "p2");
        const reselected = selectFirstAvailableWish(undone);

        expect(undone.assignments).toEqual([]);
        expect(undone.activeSelectionIndex).toBe(0);
        expect(reselected.assignments).toHaveLength(1);
        expect(reselected.activeSelectionIndex).toBe(1);
        expect(reselected.assignments[0].angelId).toBe("p2");
        expect(reselected.assignments[0].wishId).not.toBe("w2");
    });

    it("reset selection clears assignments but preserves wishes and queue", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const reset = resetSelection(completedRound);

        expect(reset.assignments).toEqual([]);
        expect(reset.activeSelectionIndex).toBe(0);
        expect(reset.wishes).toEqual(completedRound.wishes);
        expect(reset.selectionOrder).toEqual(completedRound.selectionOrder);
        expect(getAvailableWishes(reset).every((wish) => wish.ownerId !== "p2")).toBe(true);
    });

    it("prevents a selection that would create a later dead end", () => {
        const riskyRound = normalizeWorkbenchState({
            ...createCompletedRound(),
            selectionOrder: ["p2", "p3", "p4"],
            activeSelectionIndex: 1,
            assignments: [{ angelId: "p2", wishId: "w3" }]
        });
        const blocked = selectWishForCurrentAngel(riskyRound, "w2");

        expect(blocked.toast).toBe("会导致冲突");
        expect(blocked.assignments).toEqual(riskyRound.assignments);
        expect(blocked.activeSelectionIndex).toBe(riskyRound.activeSelectionIndex);
    });

    it("normalizes legacy inconsistent completed queue without hiding recovery data", () => {
        const legacyState = normalizeWorkbenchState({
            ...createCompletedRound(),
            assignments: [{ angelId: "p2", wishId: "w3" }],
            activeSelectionIndex: 99
        });

        expect(legacyState.activeSelectionIndex).toBe(legacyState.selectionOrder.length);
        expect(legacyState.assignments).toEqual([{ angelId: "p2", wishId: "w3" }]);
        expect(buildRevealRows(legacyState).map((row) => row.angel)).toEqual(["雯子", "未分配", "未分配"]);
    });

    it("normalizes old localStorage shapes and old completion statuses", () => {
        const legacyState = normalizeWorkbenchState({
            ...createCompletedRound(),
            version: 1,
            round: { ...createCompletedRound().round, god: "不存在的人" },
            completionByParticipantId: {
                p1: "unseen",
                p2: "possible",
                p3: "remind",
                p4: "done"
            },
            assignments: [
                { angelId: "p2", wishId: "w3" },
                { angelId: "missing", wishId: "w4" },
                { angelId: "p3", wishId: "missing" }
            ]
        });

        expect(legacyState.round.god).toBe("");
        expect(legacyState.completionByParticipantId).toMatchObject({
            p1: "pending",
            p2: "pending",
            p3: "pending",
            p4: "done"
        });
        expect(legacyState.assignments).toEqual([{ angelId: "p2", wishId: "w3" }]);
    });

    it("archives, updates the archive, and restores without changing reveal semantics", () => {
        const completedRound = normalizeWorkbenchState(createCompletedRound());
        const archived = archiveCurrentRound(completedRound);
        const updatedArchive = archiveCurrentRound(setCompletionStatus(archived, "p3", "done"));
        const restored = restoreArchivedRound(updatedArchive, updatedArchive.archives[0].id);

        expect(updatedArchive.archives).toHaveLength(1);
        expect(restored.round).toEqual(updatedArchive.archives[0].round);
        expect(restored.wishes).toEqual(completedRound.wishes);
        expect(restored.assignments).toEqual(completedRound.assignments);
        expect(buildRevealRows(restored).map((row) => row.angel)).toEqual(["雯子", "瓜子", "阿豹"]);
    });

    it("keeps completion followup binary after mixed legacy statuses", () => {
        const mixed = normalizeWorkbenchState({
            ...createCompletedRound(),
            completionByParticipantId: {
                p2: "done",
                p3: "possible",
                p4: "remind"
            }
        });

        expect(buildCompletionFollowup(mixed)).toBe("还没完成国王愿望的抓紧了哦，我们快要开始猜人了。");
        const allDone = setCompletionStatus(setCompletionStatus(mixed, "p3", "done"), "p4", "done");
        expect(buildCompletionFollowup(allDone)).toBe("本轮国王愿望都已完成。");
    });
});
