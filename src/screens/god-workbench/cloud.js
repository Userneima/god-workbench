import { createClient } from "@supabase/supabase-js";

const WORKBENCH_TABLE = "god_workbench_states";
const DEFAULT_DOCUMENT_ID = "default";

const getCloudConfig = () => ({
    url: import.meta.env.VITE_SUPABASE_URL || "",
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    documentId: import.meta.env.VITE_GOD_WORKBENCH_DOCUMENT_ID || DEFAULT_DOCUMENT_ID
});

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

    return {
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signUp: (email, password) => supabase.auth.signUp({ email, password }),
        signOut: () => supabase.auth.signOut(),
        onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),
        getSession,
        getUser,
        loadState,
        saveState
    };
};
