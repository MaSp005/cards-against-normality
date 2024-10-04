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
  // $(".screen[data-screen="lobby"]").css("background-image", `url(${splashBackground})`);
  // HELP BUTTON (SUPPORT SERVER)
  $('.screen[data-screen="lobby"] .btn4').on("click", () => {
    $(".popover.tutorial").addClass("active");
    $(".popover.tutorial").on("click", (event) => {
      if ($(event.target).closest(".popover.tutorial .btn").length) {
        // [data-action=close]
        if ($(event.target).closest(".btn").attr("data-action") == "close") {
          $(".popover.tutorial").removeClass("active");
          return;
        } else if (
          $(event.target).closest(".btn").attr("data-action") == "discord"
        ) {
          fetch(
            "https://discord.com/api/guilds/972847626053627934/widget.json",
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
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
          return;
        }
      }

      if ($(event.target).closest(".popover.tutorial .content").length) return;

      $(".popover.tutorial").removeClass("active");
    });
  });

  $('.screen[data-screen="lobby"] .btn5').on("click", () => {
    $(".popover.credits").addClass("active");
    $(".popover.credits").on("click", (event) => {
      if ($(event.target).closest(".popover.credits .btn").length) {
        // [data-action=close]
        if ($(event.target).closest(".btn").attr("data-action") == "close") {
          $(".popover.credits").removeClass("active");
          return;
        } else if (
          $(event.target).closest(".btn").attr("data-action") == "discord"
        ) {
          fetch(
            "https://discord.com/api/guilds/972847626053627934/widget.json",
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
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
          return;
        }
      }

      if ($(event.target).closest(".popover.credits .content").length) return;

      $(".popover.credits").removeClass("active");
    });
  });

  $('.screen[data-screen="lobby"] .btn1').on("click", () => {
    if (!$('.screen[data-screen="lobby"] .btn1').is(".disabled"))
      goTo("settings");
  });
  $('.screen[data-screen="settings"] .btn1').on("click", () => {
    if (!$('.screen[data-screen="settings"] .btn1').is(".disabled"))
      goTo("lobby");
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

  socket.onAny((...msg) => console.log("RECEIVED:", ...msg));
  socket.onAnyOutgoing((...msg) => console.log("SENDING:", ...msg));

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

  $('.screen[data-screen="lobby"] .btn3').click(() => {
    // if ($('.screen[data-screen="lobby"] .btn3').is(".disabled")) return;
    console.log("Start game pls.");
    socket.emit("CONTINUE");
  });

  $('.screen[data-screen="card_preview"] button').click(() => {
    socket.emit("CONTINUE");
  });

  // SOCKET EVENTS

  socket_events: {
    socket.on("GAMESTATE", (g) => {
      gamestate = g;
      console.log(g);
      goTo(g.gamestate.stage);
    });

    socket.on("NEW_VIP", async (c) => {
      console.log("NEW VIP:", c, c == auth.user.id, auth.user.id);
      currentvip = c;

      // (de)activate menu start button
      $('.screen[data-screen="lobby"] :is(.btn3,.btn1)').toggleClass(
        "disabled",
        c != auth.user.id
      );
      $('.screen[data-screen="lobby"] .btn3').attr(
        "title",
        c == auth.user.id
          ? "Click to start the game!"
          : "Only the VIP can start the game."
      );

      // update player list
      $(".players div").removeClass("vip");
      $(`.players div[data-userid="${c}"]`).addClass("vip");
    });

    socket.on("YOUR_CARDS", (c) => {
      console.log(c);
      mycards = c;
      $('.screen[data-screen="card_preview"] .white_cards').html(
        mycards.map(buildWhiteCard)
      );
      $('.screen[data-screen="white_pick"] .white_cards').html(
        mycards.map(buildWhiteCard)
      );
      $('.screen[data-screen="dump"] .white_cards').html(
        mycards.map(buildWhiteCard)
      );
    });

    socket.on("BLACK_OPTIONS", (d) => {
      console.log("Received Black Options:", d);
      pickfrom = d;
      $('.screen[data-screen="black_pick"] .black_cards').html(
        pickfrom.map((opt, i) => {
          let dom = buildBlackCard(opt);
          dom.addEventListener("click", () => {
            socket.emit("BLACK_PICK", i);
          });
          return dom;
        })
      );
    });

    socket.on("BLACK_PROMPT", (d) => {
      console.log("Received Prompt:", d);
      gamestate.black = d;
      let dragging = null;

      // TODO: dragging system
      // clicking should place at first empty spot, or last spot
      // dragging into occupied spot should shove existing one back into white deck
      $('.screen[data-screen="white_pick"] .prompt').html(
        buildBlackCard(d.text)
      );
      $('.screen[data-screen="white_pick"] .dropoff').html(
        `<div class="spot"></div>`.repeat(d.pick)
      );
      $('.screen[data-screen="white_pick"] .white_cards .card').each((i, c) => {
        c.draggable = true;
        c.addEventListener("dragstart", (evt) => {
          $(c).addClass("dragging");
          console.log("drag start evt", evt);
          dragging = c;
        });
        c.addEventListener("dragend", (evt) => {
          $(c).removeClass("dragging");
          console.log("drag end evt", evt);
          dragging = null;
        });
      });
      $('.screen[data-screen="white_pick"] .dropoff .spot').each((i, s) => {
        s.addEventListener("dragover", (evt) => {
          evt.preventDefault();
          console.log("drag over evt", evt);
        });
        s.addEventListener("drop", (evt) => {
          evt.preventDefault();
          console.log("drop evt", evt);
          if (s.childElementCount)
            $('.screen[data-screen="white_pick"] .white_cards').append(
              s.children[0]
            );
          $(s).append([dragging]);
        });
      });

      // TODO: work out selected cards
      function finish() {
        socket.emit(
          "WHITE_ANSWER",
          [...$('.screen[data-screen="white_pick"] .dropoff .spot')].map((s) =>
            s.childElementCount ? s.children[0].children[0].innerText : null
          )
        );
      }

      setTimeout(finish, 15000);
    });

    socket.on("WHITE_PRESENT", (d) => {
      // goToPresent();
    });

    socket.on("WHITE_OPTIONS", (d) => {
      pickfrom = d;
    });

    socket.on("WINNER", (d) => {
      goTo("WINNER", d);
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
          ? // ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=256`
            `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}${
              p.avatar.startsWith("a_") ? ".gif" : ".png"
            }?size=256`
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

function buildCard(color, text) {
  let obj = document.createElement("div");
  obj.className = "card " + color;
  obj.innerHTML = `<h1>${text}</h1><h2>Cards Against Normality</h2>`;
  return obj;
}
const buildWhiteCard = (text) => buildCard("white", text);
const buildBlackCard = (text) => buildCard("black", text);

// SCREEN MANAGEMENT FUNCTIONS

async function goTo(screen, ...data) {
  screen = screen.toLowerCase();

  let currentScreen = $(".screen.active").attr("data-screen");
  console.log(`[SWITCHING SCREEN] ${currentScreen} -> ${screen}`);

  if (screen === currentScreen) return;

  // Animation für das Verstecken der Button Cards beim Verlassen eines Screens
  if (currentScreen === "lobby" || currentScreen === "settings") {
    $(
      '.screen[data-screen="' + currentScreen + '"] .popover.tutorial'
    ).removeClass("active");
    await $(`.screen[data-screen="${currentScreen}"] .menu .buttonCard`).each(
      (i, el) => {
        console.log(i, el.target);
        setTimeout(() => {
          $(el).addClass("hidden");
        }, i * 70);
      }
    );
    await new Promise((res) =>
      setTimeout(
        res,
        $(`.screen[data-screen="${currentScreen}"] .menu .buttonCard`).length *
          70 +
          300
      )
    );
  }

  // Button Cards im neuen Bildschirm erst mal verstecken
  $(`.screen[data-screen=${screen}] .menu .buttonCard`).addClass("hidden");

  // Nach einem kleinen Delay die Button Cards wieder anzeigen
  setTimeout(() => {
    $(`.screen[data-screen=${screen}] .menu .buttonCard`).removeClass("hidden");
  }, 100); // Hier ist der Delay für das Aufpoppen

  // Entfernen der Hintergründe, die mit bge- anfangen
  let classList = Array.from($("#app")[0].classList);
  classList.forEach((x) => {
    if (x.startsWith("bge-")) {
      $("#app").removeClass(x);
      console.log("removed", x);
    }
  });

  // Deaktivieren der aktuellen Ansicht und Aktivieren des neuen Screens
  $(`.screen:not([data-screen=${screen}])`).removeClass("active");
  $(`.screen[data-screen="${screen.toLowerCase()}"]`).addClass("active");
}