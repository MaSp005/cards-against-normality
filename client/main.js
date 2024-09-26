import { DiscordSDK } from "@discord/embedded-app-sdk";
import $ from "jquery";
import io from "socket.io-client";
window.$ = $;

import "./style.css";

import logoFull from "./src/img/logo_cards_full.png";
import splashBackground from "./src/img/splash_dark.png";

let auth;
let socket;
let gamestate;
let mycards = [];

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID, {
	// disableConsoleLogOverride: true,
});

// INITIALIZE

$(() => {
	// show loading indicator
	$("#loading").show();

	// set images
	// $(".scren.lobby .logo img").attr("src", logoFull);
	$(".screen.lobby").css("background-image", `url(${splashBackground})`);
})

setupDiscordSdk().then(async () => {
	console.log("Discord SDK is authenticated");
	// console.log(auth);

	$("#loading-info").text("Connecting to the socket server...");
	// Connect to the socket server
	socket = io("https://" + import.meta.env.VITE_DISCORD_CLIENT_ID + ".discordsays.com", {
		path: "/.proxy/socket.io",
		transports: ["polling", "websocket"],
		cors: {
			origin: "https://" + import.meta.env.VITE_DISCORD_CLIENT_ID + ".discordsays.com/ ",
		},
		query: {
			instanceId: discordSdk.instanceId,
			user: JSON.stringify(auth.user),
		},
	});

	socket.on("connect", () => {
		console.log("Socket connected");
		$("#loading-info").text("Connected!");

		// Hide loading indicator
		setTimeout(() => {
			goToLobby();
			$("#loading").fadeOut(() => {
				$(".destroy_afer_load").remove();
			});
		}, 1500); //5000
	});

	socket.once("JOIN_DATA", (g) => {
		gamestate = g;
		goTo(g.gamestate.stage);
	});

	socket.on("YOUR_CARDS", (c) => {
		mycards = c;
	});

	socket.on("NEW_VIP", (c) => {
		// mark user as vip, refresh display
	});

	socket.on("BLACK_OPTIONS", (d) => {
		goToBlackPick(d);
	});

	socket.on("BLACK_PROMPT", (d) => {
		goToWhitePick(d);
	});

	socket.on("WHITE_PRESENT", (d) => {
		// goToPresent();
	});

	socket.on("WHITE_OPTIONS", (d) => {
		goToWinnerPick(d);
	});

	socket.on("WINNER", (d) => {
		goToWinner(d);
	});

	socket.on("TO_SCREEN", (s) => {
		goTo(s);
	});

	try {
		discordSdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", updateParticipants);
		updateParticipants(await discordSdk.commands.getInstanceConnectedParticipants());
	} catch (e) {
		console.log(e);
	}
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

function updateParticipants(participants) {
	participants.forEach((p) => {
		// format: {id: '439490179968008194', username: 'masp.', global_name: 'Masp'}
		let avatarSrc = user.avatar
			? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
			: `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;
	});
	console.log(participants);
}

function goTo(screen, ...data) {
	switch (screen) {
		case "LOBBY":
			goToLobby(...data);
			break;
		case "CARD_PREVIEW":
			goToCards(...data);
			break;
		case "BLACK_PICK":
			goToBlackPick(...data);
			break;
		case "WHITE_PICK":
			goToWhitePick(...data);
			break;
		case "PRESENT":
			goToPresent(...data);
			break;
		case "WINNER_PICK":
			goToWinnerPick(...data);
			break;
		case "WINNER":
			goToWinner(...data);
			break;
		case "INTERMEDIATE":
			goToIntermediate(...data);
			break;
		case "DUMP":
			goToDump(...data);
			break;
		case "END":
			goToEnd(...data);
			break;
	}
}

function goToLobby() {
	$("#app > .screen").hide();
	$(".lobby").show();
}

function goToCards() {
	$("#app > .screen").hide();
	$(".cards").show();
}

function goToBlackPick() {
	$("#app > .screen").hide();
	$(".black_pick").show();
}

function goToWhitePick() {
	$("#app > .screen").hide();
	$(".white_pick").show();
}

function goToPresent() {
	$("#app > .screen").hide();
	$(".present").show();
}

function goToWinnerPick() {
	$("#app > .screen").hide();
	$(".winner_pick").show();
}

function goToWinner() {
	$("#app > .screen").hide();
	$(".winner").show();
}

function goToIntermediate() {
	$("#app > .screen").hide();
	$(".intermediate").show();
}

function goToEnd() {
	$("#app > .screen").hide();
	$(".end").show();
}

function goToDump() {
	$("#app > .screen").hide();
	$(".dump").show();
}
