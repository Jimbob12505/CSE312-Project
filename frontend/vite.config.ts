import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    root: "app",
    publicDir: "../public",
    plugins: [
        tailwindcss(),
        react(),
        tsconfigPaths(),
    ],
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },

});
