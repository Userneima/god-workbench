import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    reporter: [["list"]],
    timeout: 30_000,
    expect: {
        timeout: 5_000
    },
    use: {
        baseURL: "http://localhost:43175",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    webServer: {
        command: "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 43175 --strictPort",
        url: "http://localhost:43175/",
        reuseExistingServer: false,
        timeout: 60_000
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ]
});
