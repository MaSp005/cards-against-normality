import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { Room } from "./room.js";

dotenv.config({ path: "../.env" });

const io = new Server(3002, {
	cors: {
		origin: ["https://admin.socket.io"],
		credentials: true,
	},
});

instrument(io, {
	auth: {
		type: "basic",
		username: process.env.SOCKETIO_ADMIN_USERNAME,
		password: process.env.SOCKETIO_ADMIN_PASSWORD,
	},
	// mode: process.env.NODE_ENV || "production",
	mode: "development",
});


const rooms = {};
function getRoom(id) {
	if (id in rooms) return rooms[id];
	else return (rooms[id] = new Room());
}

const app = express();
const port = 3001;

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

app.listen(port, () => {
	console.log(`Server listening at http://localhost:${port}`);
});

io.on("connection", (socket) => {
	// console.log(socket.handshake.query)
	// put into room based on instanceId
	socket.join(socket.handshake.query.instanceId);
	getRoom(socket.handshake.query.instanceId).join(socket);
	socket.user = JSON.parse(socket.handshake.query.user);
	console.log(`@${socket.user.username} connected`);
	socket.on("disconnect", () => {
		socket.leave(socket.handshake.query.instanceId);
		getRoom(socket.handshake.query.instanceId).leave(socket);
		console.log(`@${socket.user.username} disconnected`);
	});
});
