import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
    const state = {
        remoteState: null,
        remoteRoster: null,
        savedStates: [],
        savedRosters: [],
        publicArchives: []
    };
    const auth = {
        getSession: vi.fn(),
        getUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resend: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn()
    };
    const from = vi.fn((table) => {
        if (table === "god_workbench_public_archives") {
            return {
                select: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(async () => ({ data: state.publicArchives, error: null }))
                    }))
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn(async () => ({ data: state.publicArchives[0], error: null }))
                    }))
                }))
            };
        }

        if (table === "god_workbench_member_rosters") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: state.remoteRoster, error: null }))
                    }))
                })),
                upsert: vi.fn(async (payload) => {
                    state.savedRosters.push(payload);
                    return { error: null };
                })
            };
        }

        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: state.remoteState, error: null }))
                }))
            })),
            upsert: vi.fn(async (payload) => {
                state.savedStates.push(payload);
                return { error: null };
            })
        };
    });
    const client = { auth, from };
    return {
        auth,
        client,
        createClient: vi.fn(() => client),
        state,
        reset: () => {
            state.remoteState = null;
            state.remoteRoster = null;
            state.savedStates = [];
            state.savedRosters = [];
            state.publicArchives = [];
            Object.values(auth).forEach((fn) => fn.mockReset());
            from.mockClear();
            auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
            auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "host@example.com" } }, error: null });
            auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
            auth.signUp.mockResolvedValue({ data: { session: null, user: { email: "host@example.com" } }, error: null });
            auth.resend.mockResolvedValue({ data: {}, error: null });
            auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
            auth.updateUser.mockResolvedValue({ data: { user: { email: "host@example.com" } }, error: null });
            auth.signOut.mockResolvedValue({ error: null });
            auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
        }
    };
});

vi.mock("@supabase/supabase-js", () => ({
    createClient: supabaseMock.createClient
}));

const flushPromises = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("god workbench cloud auth", () => {
    let mountGodWorkbenchPage;
    let createInitialWorkbenchState;
    let createSampleWorkbenchState;
    let loadWorkbenchState;
    let saveWorkbenchState;
    let saveMemberRoster;
    let updateRoundField;

    beforeEach(async () => {
        window.localStorage.clear();
        vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
        vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
        supabaseMock.reset();
        ({ mountGodWorkbenchPage } = await import("../screens/god-workbench/index.js"));
        ({
            createInitialWorkbenchState,
            createSampleWorkbenchState,
            loadWorkbenchState,
            saveWorkbenchState,
            saveMemberRoster,
            updateRoundField
        } = await import("../screens/god-workbench/model.js"));
    });

    const mountWorkbench = async () => {
        const root = document.createElement("div");
        mountGodWorkbenchPage({ root });
        await flushPromises();
        return root;
    };

    it("signs up with a nickname through the signup function and logs straight in", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
        vi.stubGlobal("fetch", fetchMock);
        supabaseMock.auth.signInWithPassword.mockResolvedValue({
            data: { session: { user: { id: "u2", email: "x@users.god-workbench.local", user_metadata: { display_name: "Carol" } } } },
            error: null
        });
        const root = await mountWorkbench();
        expect(root.querySelector('[data-top-menu="cloud"]').textContent).toContain("登录同步");
        const form = root.querySelector("[data-form='cloud-auth']");

        form.elements.account.value = "Carol";
        form.elements.password.value = "secret123";
        form.requestSubmit(form.querySelector("[data-auth-mode='sign-up']"));
        await flushPromises();
        await flushPromises();

        expect(fetchMock).toHaveBeenCalledWith(
            "https://example.supabase.co/functions/v1/god-workbench-signup",
            expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Carol", password: "secret123" }) })
        );
        expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
            email: "gw-6361726f6c@users.god-workbench.local",
            password: "secret123"
        });
        expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
        expect(root.querySelector('[data-top-menu="cloud"]').textContent).toContain("Carol");
        vi.unstubAllGlobals();
    });

    it("signs in with a nickname or an email", async () => {
        const root = await mountWorkbench();
        let form = root.querySelector("[data-form='cloud-auth']");
        form.elements.account.value = "  CAROL ";
        form.elements.password.value = "secret123";
        form.requestSubmit(form.querySelector("[data-auth-mode='sign-in']"));
        await flushPromises();
        expect(supabaseMock.auth.signInWithPassword).toHaveBeenLastCalledWith({
            email: "gw-6361726f6c@users.god-workbench.local",
            password: "secret123"
        });

        form = root.querySelector("[data-form='cloud-auth']");
        form.elements.account.value = "host@example.com";
        form.elements.password.value = "secret123";
        form.requestSubmit(form.querySelector("[data-auth-mode='sign-in']"));
        await flushPromises();
        expect(supabaseMock.auth.signInWithPassword).toHaveBeenLastCalledWith({
            email: "host@example.com",
            password: "secret123"
        });
    });

    it("shows the member roster read-only to non-admin accounts", async () => {
        supabaseMock.state.remoteRoster = {
            participants: [{ id: "p_cloud_1", name: "云端成员" }],
            updated_at: "2026-06-14T08:00:00.000Z"
        };
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1", email: "host@example.com" } } },
            error: null
        });

        const root = await mountWorkbench();
        await flushPromises();

        expect(root.textContent).toContain("云端成员");
        expect(root.querySelector("[data-form='participant']")).toBeNull();
        expect(root.querySelector("[data-action='remove-participant']")).toBeNull();
    });

    it("asks before replacing a different local draft with the cloud draft", async () => {
        const localState = updateRoundField(createSampleWorkbenchState(), "theme", "本地主题");
        const remoteState = updateRoundField(createSampleWorkbenchState(), "theme", "云端主题");
        saveWorkbenchState(localState);
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1", email: "host@example.com" } } },
            error: null
        });
        supabaseMock.state.remoteState = {
            state: remoteState,
            updated_at: "2026-06-14T08:00:00.000Z"
        };

        const root = await mountWorkbench();
        await flushPromises();

        expect(root.textContent).toContain("需要选择版本");
        expect(root.textContent).toContain("保留本地");
        expect(root.textContent).toContain("使用云端");

        root.querySelector("[data-action='cloud-use-remote']").click();
        await flushPromises();

        expect(loadWorkbenchState().round.theme).toBe("云端主题");
    });

    it("uploads the local draft automatically when the cloud draft is empty", async () => {
        const localState = updateRoundField(createSampleWorkbenchState(), "theme", "本地主题");
        saveWorkbenchState(localState);
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1", email: "host@example.com" } } },
            error: null
        });
        supabaseMock.state.remoteState = {
            state: createInitialWorkbenchState(),
            updated_at: "2026-06-14T08:00:00.000Z"
        };

        const root = await mountWorkbench();
        await flushPromises();
        await flushPromises();

        expect(root.textContent).not.toContain("需要选择版本");
        expect(root.textContent).toContain("已用本地草稿补全云端");
        expect(supabaseMock.state.savedStates.at(-1).state.round.theme).toBe("本地主题");
    });

    it("loads the shared member roster for signed out users", async () => {
        supabaseMock.state.remoteRoster = {
            participants: [{ id: "p_cloud_1", name: "云端成员" }],
            updated_at: "2026-06-14T08:00:00.000Z"
        };

        const root = await mountWorkbench();
        await flushPromises();

        expect(root.querySelector(".god-workbench__members-toggle").textContent).toContain("1人");
        expect(loadWorkbenchState().participants.map((participant) => participant.name)).toEqual(["云端成员"]);
    });

    it("uploads the local member roster when the shared cloud roster is empty", async () => {
        saveMemberRoster([{ id: "p_local_1", name: "本地成员" }]);
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: "905df538-3907-40ad-929f-2561af837724", email: "host@example.com" } } },
            error: null
        });

        const root = await mountWorkbench();
        await flushPromises();
        await flushPromises();

        expect(root.textContent).toContain("成员名单");
        expect(supabaseMock.state.savedRosters.at(-1).participants).toEqual([{ id: "p_local_1", name: "本地成员" }]);
    });

    it("keeps the shared member roster when loading a cloud draft with stale participants", async () => {
        const remoteState = updateRoundField(createInitialWorkbenchState(), "theme", "云端主题");
        remoteState.participants = [{ id: "p_old_1", name: "共享成员" }];
        remoteState.wishes = [{ id: "w_old_1", ownerId: "p_old_1", body: "旧草稿愿望", status: "approved" }];
        supabaseMock.state.remoteRoster = {
            participants: [{ id: "p_shared_1", name: "共享成员" }],
            updated_at: "2026-06-14T08:00:00.000Z"
        };
        supabaseMock.state.remoteState = {
            state: remoteState,
            updated_at: "2026-06-14T08:05:00.000Z"
        };
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1", email: "host@example.com" } } },
            error: null
        });

        const root = await mountWorkbench();
        await flushPromises();
        await flushPromises();

        expect(root.textContent).not.toContain("需要选择版本");
        expect(loadWorkbenchState().round.theme).toBe("云端主题");
        expect(loadWorkbenchState().participants.map((participant) => participant.name)).toEqual(["共享成员"]);
        expect(loadWorkbenchState().wishes).toEqual([{
            id: "w_old_1",
            ownerId: "p_shared_1",
            body: "旧草稿愿望",
            status: "approved"
        }]);
    });
});
