export const createAuthSessionApi = (context) => ({
    async getAuthState() {
        const snapshot = await context.getSessionSnapshot();
        const profile = snapshot.user?.id ? await context.ensureProfile() : null;
        return {
            ...snapshot,
            profile
        };
    },
    async loginWithPassword(email, password) {
        const client = context.getSupabaseClient();
        const currentSnapshot = await context.getSessionSnapshot();

        if (currentSnapshot.isAnonymous) {
            const { error: signOutError } = await client.auth.signOut();
            if (signOutError) {
                throw signOutError;
            }

            context.runtimeState.authUser = null;
            context.runtimeState.identity = null;
            context.runtimeState.aliasProfiles = [];
        }

        const { error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        const nextSnapshot = await context.getSessionSnapshot();
        await context.ensureProfile();
        return nextSnapshot;
    },
    async registerWithPassword(email, password, displayName = "") {
        const client = context.getSupabaseClient();
        const currentSnapshot = await context.getSessionSnapshot();

        if (currentSnapshot.isAnonymous) {
            const { error: signOutError } = await client.auth.signOut();
            if (signOutError) {
                throw signOutError;
            }

            context.runtimeState.authUser = null;
            context.runtimeState.identity = null;
            context.runtimeState.aliasProfiles = [];
        }

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName
                }
            }
        });

        if (error) {
            throw error;
        }

        if (!data.session?.user) {
            const confirmationError = new Error("Supabase email confirmation is still enabled.");
            confirmationError.code = "auth_email_confirmation_required";
            throw confirmationError;
        }

        const nextSnapshot = await context.getSessionSnapshot();
        await context.ensureProfile(displayName);
        return nextSnapshot;
    },
    async upgradeLegacyAnonymousUser(email, token = "") {
        const client = context.getSupabaseClient();
        if (!token) {
            const { error } = await client.auth.updateUser({ email });
            if (error) {
                throw error;
            }
            return { email, verificationPending: true };
        }

        const { error } = await client.auth.verifyOtp({
            email,
            token,
            type: "email_change"
        });

        if (error) {
            throw error;
        }

        const snapshot = await context.getSessionSnapshot();
        await context.ensureProfile();
        return snapshot;
    },
    async signOut() {
        const client = context.getSupabaseClient();
        const { error } = await client.auth.signOut();
        if (error) {
            throw error;
        }

        context.runtimeState.authUser = null;
        context.runtimeState.identity = null;
        context.runtimeState.aliasProfiles = [];
        return { user: null, isAnonymous: false };
    },
    async updateAccountProfile(input) {
        const snapshot = await context.getSessionSnapshot();
        if (!snapshot.user?.id || snapshot.isAnonymous) {
            throw new Error("请先登录，再编辑账号资料。");
        }

        const client = context.getSupabaseClient();
        const updatePayload = {
            display_name: String(input.displayName || "").trim() || null
        };

        if (typeof input.avatarUrl === "string" && input.avatarUrl.trim()) {
            updatePayload.avatar_url = input.avatarUrl.trim();
        }

        const { data, error } = await client
            .from("profiles")
            .update(updatePayload)
            .eq("id", snapshot.user.id)
            .select("id, display_name, avatar_url")
            .single();

        if (error) {
            throw error;
        }

        return {
            name: String(data.display_name || "").trim(),
            avatar: String(data.avatar_url || "").trim()
        };
    }
});
