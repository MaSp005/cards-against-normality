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
function getRoom(id, arg) {
	if (id in rooms) return rooms[id];
	else return (rooms[id] = new Room(io, id, arg));
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
	socket.user = JSON.parse(socket.handshake.query.user);
	socket.connected = new Date(socket.handshake.time).getTime();
	socket.emit("JOIN_DATA", getRoom(socket.handshake.query.instanceId, socket).toJSON());
	console.log(`@${socket.user.username} connected`);

	socket.on("disconnect", () => {
		console.log(`@${socket.user.username} disconnected`);
		let room = getRoom(socket.handshake.query.instanceId);
		socket.leave(room.name);
		if (!io.sockets.adapter.rooms.get(room.name)?.size) {
			delete rooms[socket.handshake.query.instanceId];
			console.log(`-> Room ${room.name} deleted.`);
			return;
		}
		if (room.vip == socket.user.id) {
			io.of("/")
				.in(room.name)
				.fetchSockets()
				.then((clients) => {
					if (!Array.isArray(clients)) clients = [clients];
					let min = Math.min(...clients.map((c) => c.connected));
					let newvipidx = clients.findIndex((c) => c.connected == min);
					let newvip = clients.find((c) => c.connected == min);
					room.setVIP(newvip);
					console.log(`-> Made @${newvip.user.username} new VIP.`);
				});
		}
	});
});
