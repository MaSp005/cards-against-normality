import {defineConfig} from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	envDir: "../",
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
				secure: false,
				ws: true,
			},
			"/socket.io": {
				target: "ws://localhost:3002",
				ws: true,
			},
		},
		hmr: {
			clientPort: 443,
		},
	},
});
