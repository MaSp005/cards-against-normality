import { DiscordSDK } from "@discord/embedded-app-sdk";
import $ from "jquery";
window.$ = $;

import "./style.css";

let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

$().on(() => {
	// start loading indicator
	$("#loading").show();
});

setupDiscordSdk().then(async () => {
	console.log("Discord SDK is authenticated");
	// stop loading indicator
	$("#loading").fadeOut(() => {
		$("#loading").remove();
	});
	// connect to backend ws
	const ws = new WebSocket(`wss://${window.location.host}/.proxy/api/ws`);
	ws.onopen = () => {
		// initial message with lobby id (channel id)
		let channelId = discordSdk.channelId;
		ws.send(
			JSON.stringify({
				lobbyId: channelId,
			})
		);
		console.log("WebSocket connected");
	};
});

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


// Fetch
const participants = await discordSdk.commands.getInstanceConnectedParticipants();

// Subscribe
function updateParticipants(participants) {
  // Do something really cool
}
discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);