import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import expressWs from "express-ws";

dotenv.config({ path: "../.env" });

const app = express();
const port = 3001;

expressWs(app);
app.use(express.json());

app.post("/api/token", async (req, res) => {
	const response = await fetch(`https://discord.com/api/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: process.env.VITE_DISCORD_CLIENT_ID,
			client_secret: process.env.DISCORD_CLIENT_SECRET,
			grant_type: "authorization_code",
			code: req.body.code,
		}),
	});

	const { access_token } = await response.json();

	res.send({ access_token });
});
app.ws("/api/ws", (ws) => {
	console.log("WebSocket connected");
	ws.on("message", (msg) => {
		console.log(msg);
	});
	ws.on("close", () => {
		console.log("WebSocket closed");
	});
	ws.on("error", (err) => {
		console.error(err);
	});
	ws.on("ping", () => {
		console.log("WebSocket ping");
	});
	ws.on("pong", () => {
		console.log("WebSocket pong");
	});
});

app.listen(port, () => {
	console.log(`Server listening at http://localhost:${port}`);
});