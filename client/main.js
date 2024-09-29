import { DiscordSDK } from "@discord/embedded-app-sdk";
import io from "socket.io-client";
// import $ from "jquery";
// window.$ = $;

// import "./style.css";

let auth;
let socket;
let gamestate;
let currentvip;
let mycards = [];
let pickfrom = [];

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID, {
  // disableConsoleLogOverride: true,
});

// INITIALIZE

$(() => {
  // show loading indicator
  $("#loading").show();

  // set images
  // $(".scren.lobby .logo img").attr("src", logoFull);
  // $(".screen.lobby").css("background-image", `url(${splashBackground})`);
  // HELP BUTTON (SUPPORT SERVER)
  $(".screen.lobby .btn4").on("click", () => {
    fetch("https://discord.com/api/guilds/972847626053627934/widget.json", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        discordSdk.commands.openExternalLink({
          url: data.instant_invite,
        });
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  });
});

setupDiscordSdk().then(async () => {
  console.log("Discord SDK is authenticated");
  // console.log(auth);

  $("#loading-info").text("Connecting to the game server...");
  // Connect to the socket server
  socket = io(
    "https://" + import.meta.env.VITE_DISCORD_CLIENT_ID + ".discordsays.com",
    {
      path: "/.proxy/socket.io",
      transports: ["polling", "websocket"],
      cors: {
        origin:
          "https://" +
          import.meta.env.VITE_DISCORD_CLIENT_ID +
          ".discordsays.com/ ",
      },
      query: {
        instanceId: discordSdk.instanceId,
        user: JSON.stringify(auth.user),
      },
    }
  );

  socket.on("connect", async () => {
    console.log("Socket connected");
    $("#loading-info").text("Press the button below to start playing!");
    // socket.emit("HELLO");

    // Hide loading indicator
    $("#loading .btn.play").attr("disabled", false);

    // $("#loading .lcard").on("click", () => {
    $("#loading .btn.play").on("click", async () => {
      $("#loading .btn.play").addClass("active");
      await new Promise((res) => setTimeout(res, 250));
      $("#loading").slideUp(() => {
        $(".destroy_afer_load").remove();
      });
    });
  });

  // DOM EVENTS

  $(".screen.lobby .btn3").click(() => {
    console.log("Start game pls.");
    socket.emit("CONTINUE");
  });

  $(".screen.cards button").click(() => {
    socket.emit("CONTINUE");
  });

  // SOCKET EVENTS

  socket_events: {
    socket.on("GAMESTATE", (g) => {
      gamestate = g;
      console.log(g);
      goTo(g.gamestate.stage);
    });

    socket.on("YOUR_CARDS", (c) => {
      console.log(c);
      mycards = c;
      $(".screen.cards .cards").html(mycards.map(createWhiteCard));
    });

    socket.on("NEW_VIP", async (c) => {
      console.log("NEW VIP:", c, c == auth.user.id, auth.user.id);
      currentvip = c;

      // (de)activate menu start button
      $(".screen.lobby .btn3").toggleClass("disabled", c != auth.user.id);
      $(".screen.lobby .btn3").attr(
        "title",
        c == auth.user.id
          ? "Click to start the game!"
          : "Only the VIP can start the game."
      );

      // update player list
      $(".players div").removeClass("vip");
      $(`.players div[data-userid="${c}"]`).addClass("vip");
    });

    socket.on("BLACK_OPTIONS", (d) => {
      pickfrom = d;
      $(".screen.black_pick .cards").html(pickfrom.map(createBlackCard));
    });

    socket.on("BLACK_PROMPT", (d) => {
      gamestate.black = d;
    });

    socket.on("WHITE_PRESENT", (d) => {
      // goToPresent();
    });

    socket.on("WHITE_OPTIONS", (d) => {
      pickfrom = d;
    });

    socket.on("WINNER", (d) => {
      goToWinner(d);
    });

    socket.on("TO_SCREEN", (s) => {
      goTo(s);
    });
  }

  try {
    await discordSdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (d) =>
      updateParticipants(d.participants)
    );
    updateParticipants(
      (await discordSdk.commands.getInstanceConnectedParticipants())
        .participants
    );

    await new Promise((res) => setTimeout(res, 1000));

    discordSdk.subscribe(
      "SPEAKING_START",
      (u) => {
        $(`.players div[data-userid="${u.user_id}"]`).addClass("speaking");
      },
      { channel_id: discordSdk.channelId }
    );
    discordSdk.subscribe(
      "SPEAKING_STOP",
      (u) => {
        $(`.players div[data-userid="${u.user_id}"]`).removeClass("speaking");
      },
      { channel_id: discordSdk.channelId }
    );
  } catch (e) {
    console.warn("ERROR ON PLAYER MANAGEMENT", e);
  }
});

// DISCORD HELPER FUNCTIONS

async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands",
      "rpc.activities.write",
      "rpc.voice.read",
    ],
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
  console.log("UPDATING PARTICIPANTS", participants);
  $(".players")[0].replaceChildren(
    ...participants.map((p) => {
      // format: {id: '439490179968008194', username: 'masp.', global_name: 'Masp'}
      let el = document.createElement("div");
      el.style.backgroundImage = `url(${
        p.avatar
          ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${
              (BigInt(p.id) >> 22n) % 6n
            }.png`
      })`;
      if (p.id == currentvip) el.classList.add("vip");
      el.classList.add("czar");
      el.setAttribute("data-userid", p.id);
      return el;
    })
  );
}

// DOM HELPER FUNCTIONS

function createCard(color, text) {
  let obj = document.createElement("div");
  obj.className = "card " + color;
  obj.innerHTML = `<h1>${text}</h1><h2>Cards Against Normality</h2>`;
  return obj;
}
const createWhiteCard = (text) => createCard("white", text);
const createBlackCard = (text) => createCard("black", text);

// SCREEN MANAGEMENT FUNCTIONS

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
  $(".screen.cards").show();
  console.log("my cards", mycards);
}

function goToBlackPick(opt) {
  $("#app > .screen").hide();
  $(".screen.black_pick").show();
  console.log("black options:", pickfrom);
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
