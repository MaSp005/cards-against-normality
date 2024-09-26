import { DiscordSDK } from "@discord/embedded-app-sdk";
import $ from "jquery";
import io from "socket.io-client";
window.$ = $;

import "./style.css";

let auth;
let socket;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID, {
	// disableConsoleLogOverride: true,
});

// INITIALIZE

$().on(() => {
	// start loading indicator
	$("#loading").show();
});

setupDiscordSdk().then(async () => {
	console.log("Discord SDK is authenticated");
	// console.log(auth);

	$("#loading p").text("Connecting to the socket server...");
	// Connect to the socket server
	socket = io("https://" + import.meta.env.VITE_DISCORD_CLIENT_ID + ".discordsays.com", {
		path: "/.proxy/socket.io",
		transports: ["websocket", "polling"],
		cors: {
			origin: "https://" + import.meta.env.VITE_DISCORD_CLIENT_ID + ".discordsays.com/ ",
		},
		query: {
			instanceId: discordSdk.instanceId,
		},
	});

	socket.on("connect", () => {
		console.log("Socket connected");
	$("#loading p").text("Connected!");

		// Hide loading indicator
		$("#loading").fadeOut(() => {
			$("#loading").remove();
		});
	});
});

// HELPER FUNCTIONS

async function setupDiscordSdk() {
	await discordSdk.ready();
	console.log("Discord SDK is ready");

	const { code } = await discordSdk.commands.authorize({
		client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
		response_type: "code",
		state: "",
		prompt: "none",
		scope: ["identify", "guilds", "applications.commands", "rpc.activities.write"],
	});

	const response = await fetch("/.proxy/api/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			code,
		}),
	});
	const { access_token } = await response.json();

	auth = await discordSdk.commands.authenticate({
		access_token,
	});

	if (auth == null) {
		throw new Error("Authenticate command failed");
	}
}