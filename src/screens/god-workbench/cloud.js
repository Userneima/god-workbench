import { createClient } from "@supabase/supabase-js";

const WORKBENCH_TABLE = "god_workbench_states";
const PUBLIC_ARCHIVES_TABLE = "god_workbench_public_archives";
const MEMBER_ROSTERS_TABLE = "god_workbench_member_rosters";
const DEFAULT_DOCUMENT_ID = "default";

const getCloudConfig = () => ({
    url: import.meta.env.VITE_SUPABASE_URL || "",
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    documentId: import.meta.env.VITE_GOD_WORKBENCH_DOCUMENT_ID || DEFAULT_DOCUMENT_ID
});

const getAuthRedirectTo = () => {
    if (typeof window === "undefined") {
        return undefined;
    }
    return `${window.location.origin}/`;
};

export const createCloudSyncClient = () => {
    const config = getCloudConfig();
    if (!config.url || !config.key) {
        return null;
    }

    const supabase = createClient(config.url, config.key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    const getSession = async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            throw error;
        }
        return data.session || null;
    };

    const getUser = async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            throw error;
        }
        return data.user || null;
    };

    const loadState = async () => {
        const { data, error } = await supabase
            .from(WORKBENCH_TABLE)
            .select("state, updated_at")
            .eq("document_id", config.documentId)
            .maybeSingle();

        if (error) {
            throw error;
        }
        return data || null;
    };

    const saveState = async (state) => {
        const user = await getUser();
        if (!user) {
            return null;
        }

        const updatedAt = new Date().toISOString();
        const { error } = await supabase
            .from(WORKBENCH_TABLE)
            .upsert({
                user_id: user.id,
                document_id: config.documentId,
                state,
                updated_at: updatedAt
            }, {
                onConflict: "user_id,document_id"
            });

        if (error) {
            throw error;
        }
        return updatedAt;
    };

    const normalizePublicArchive = (archive) => ({
        id: archive.archive_id,
        schemaVersion: archive.schema_version,
        roundId: archive.round_id,
        roundLabel: archive.round_label,
        theme: archive.theme,
        godName: archive.god_name,
        publishedAt: archive.published_at,
        revealRows: Array.isArray(archive.reveal_rows) ? archive.reveal_rows : [],
        completionRows: Array.isArray(archive.completion_rows) ? archive.completion_rows : [],
        sourceAppVersion: archive.source_app_version
    });

    const loadPublicArchives = async () => {
        const { data, error } = await supabase
            .from(PUBLIC_ARCHIVES_TABLE)
            .select("archive_id, schema_version, round_id, round_label, theme, god_name, published_at, reveal_rows, completion_rows, source_app_version")
            .order("published_at", { ascending: false })
            .limit(20);

        if (error) {
            throw error;
        }
        return (data || []).map(normalizePublicArchive);
    };

    const normalizeSharedMemberRoster = (roster) => ({
        participants: Array.isArray(roster?.participants) ? roster.participants : [],
        updatedAt: roster?.updated_at || ""
    });

    const loadSharedMemberRoster = async () => {
        const { data, error } = await supabase
            .from(MEMBER_ROSTERS_TABLE)
            .select("participants, updated_at")
            .eq("document_id", config.documentId)
            .maybeSingle();

        if (error) {
            throw error;
        }
        return data ? normalizeSharedMemberRoster(data) : null;
    };

    const saveSharedMemberRoster = async (participants) => {
        const user = await getUser();
        if (!user) {
            return null;
        }

        const updatedAt = new Date().toISOString();
        const { error } = await supabase
            .from(MEMBER_ROSTERS_TABLE)
            .upsert({
                document_id: config.documentId,
                participants,
                updated_by: user.id,
                updated_at: updatedAt
            }, {
                onConflict: "document_id"
            });

        if (error) {
            throw error;
        }
        return updatedAt;
    };

    const publishPublicArchive = async (archive) => {
        const user = await getUser();
        if (!user) {
            throw new Error("Login required to publish public archive.");
        }

        const { data, error } = await supabase
            .from(PUBLIC_ARCHIVES_TABLE)
            .insert({
                creator_user_id: user.id,
                schema_version: archive.schema_version,
                round_id: archive.round_id,
                round_label: archive.round_label,
                theme: archive.theme,
                god_name: archive.god_name,
                reveal_rows: archive.reveal_rows,
                completion_rows: archive.completion_rows,
                source_app_version: archive.source_app_version
            })
            .select("archive_id, schema_version, round_id, round_label, theme, god_name, published_at, reveal_rows, completion_rows, source_app_version")
            .single();

        if (error) {
            throw error;
        }
        return normalizePublicArchive(data);
    };

    return {
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signUp: (email, password) => supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getAuthRedirectTo()
            }
        }),
        resendSignupConfirmation: (email) => supabase.auth.resend({
            type: "signup",
            email,
            options: {
                emailRedirectTo: getAuthRedirectTo()
            }
        }),
        resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
            redirectTo: getAuthRedirectTo()
        }),
        updatePassword: (password) => supabase.auth.updateUser({ password }),
        signOut: () => supabase.auth.signOut(),
        onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),
        getSession,
        getUser,
        loadState,
        saveState,
        loadSharedMemberRoster,
        saveSharedMemberRoster,
        loadPublicArchives,
        publishPublicArchive
    };
};
