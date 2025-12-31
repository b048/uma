import { createClient } from '@supabase/supabase-js'

// Try to grab from env, otherwise null
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || null;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || null;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.warn("Supabase keys missing. Global leaderboard disabled.");
}

const LOCAL_STORAGE_KEY = 'zodaic_dash_user_v1';

export const Leaderboard = {
    getUserState: () => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            username: `Rider${Math.floor(Math.random() * 1000)}`,
            balance: 1000,
            hasAccount: false
        };
    },

    saveUserState: (state) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        // Also try to sync to global if possible?
        // Usually we sync on Game End.
    },

    submitScore: async (username, balance) => {
        // Always save local
        Leaderboard.saveUserState({ username, balance, hasAccount: true });

        if (!supabase) return;

        try {
            // Upsert based on username (In real app, use Auth ID. Here we trust username unique-ish for demo)
            // Or just insert a new record for every race? No, let's keep a "High Score" table.

            // First check if user exists (mocked logic since no auth)
            // We will just insert into 'leaderboard' table: { username, balance, updated_at }
            // Assuming table constraint on username unique

            console.log("Submitting score to Supabase:", { username, total_winnings: balance });
            const { data, error } = await supabase
                .from('leaderboard')
                .upsert({
                    username: username,
                    total_winnings: balance,
                    updated_at: new Date()
                }, { onConflict: 'username' })
                .select();

            if (error) {
                console.warn("Supabase Submit Error (Ignored):", error.message);
                // Fail silently to local
            } else {
                console.log("Score submitted:", data);
            }

        } catch (e) {
            console.error("Supabase Exception:", e);
        }
    },

    getTopScores: async () => {
        if (!supabase) {
            console.warn("No Supabase client, using mock data.");
            // Return fake local scores mixed with current user
            const local = Leaderboard.getUserState();
            return [
                { username: "SeiunSky", total_winnings: 99999 },
                { username: "KingHalo", total_winnings: 50000 },
                { username: local.username, total_winnings: local.balance }
            ].sort((a, b) => b.total_winnings - a.total_winnings);
        }

        console.log("Fetching top scores...");
        const { data, error } = await supabase
            .from('leaderboard')
            .select('username, total_winnings')
            .order('total_winnings', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            console.warn("Supabase Fetch Failed or Empty, using Local Fallback:", error);
            const local = Leaderboard.getUserState();
            // Fallback Mock Data (Cleaned up for New Year)
            return [
                { username: local.username, total_winnings: local.balance, bankruptcy_count: local.bankruptcyCount || 0 }
            ].sort((a, b) => b.total_winnings - a.total_winnings);
        }
        console.log("Scores fetched:", data);
        return data;
    }
};
