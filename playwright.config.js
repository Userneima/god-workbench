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
        baseURL: "http://localhost:43174",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    webServer: {
        command: "npm run dev",
        url: "http://localhost:43174/",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ]
});
