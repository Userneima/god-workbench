import { defineConfig } from "vite";

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true
    },
    test: {
        environment: "jsdom",
        include: ["src/test/**/*.test.js"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**"
        ]
    }
});
