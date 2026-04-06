import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";

	return {
		server: {
			proxy: {
				"/api": {
					target: proxyTarget,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api/, "")
				}
			}
		}
	};
});
