import chalk from "chalk";

/**
 * Generates a shuffled Index-Array.
 * @arg {int} max Number of items.
 * @returns {int[]} Array of length max with each number between 0 and max at exactly one random spot.
 */
function shuffleRange(max) {
  let result = new Array(max);
  for (let i = 0; i < max; i++) {
    let num;
    do {
      num = Math.floor(Math.random() * max);
    } while (result.includes(num));

    result[i] = num;
  }
  return result;
}

/**
 * Shuffles a given array.
 * @param {T[]} arr Array to shuffle
 * @returns {T[]} The same array with its items in a new random order
 */
function shuffleArr(arr) {
  let order = shuffleRange(arr.length);
  return arr.map((_, i) => arr[order[i]]);
}

/**
 * Finds the most common entry in the array.
 * @arg {Array} arr Array of values "votes"
 * @returns {any} Most common entry
 */
function democracy(arr) {
  let votes = new Map();
  arr.forEach((v) => {
    votes.set(v, votes.get(v) + 1 || 1);
  });
  this.print(votes);
  let max = Math.max(...votes.values());
  this.print(max);
  let mostpop = [];
  votes.keys().forEach((k) => {
    if (votes.get(k) == max) mostpop.push(k);
  });
  this.print(mostpop);
  return mostpop[Math.floor(Math.random() * mostpop.length)] || arr[0];
}

import fs from "fs";
const baseDeck = JSON.parse(fs.readFileSync("./src/packs/Base.json", "utf8"));

const cardsPerPlayer = 8;
const notimeouts = true;
const timeouts = notimeouts ? {
  cardpreview: 0,
  blackpick: 0,
  whiteanswer: 0,
  presentreveal: 0,
  presentnext: 0,
} : {
  cardpreview: 20 * 1000,
  blackpick: 30 * 1000,
  whiteanswer: 60 * 1000,
  presentreveal: 5 * 1000,
  presentnext: 20 * 1000,
};

/**
 * Room Class
 * @prop {String} name Instance ID connected to this room
 * @prop {String} vip User ID of current VIP Player
 * @prop {Object.<string, string[]>} cards Map of user ids to card array
 * @prop {Object.<string, string[]>} picks Map of user ids to picked white card array
 * @prop {int[]} whitedeck Array of deck indices for available cards
 * @prop {int[]} blackdeck Array of deck indices for available cards
 * @prop {int[]} whitediscard Array of deck indices for discarded cards
 * @prop {int[]} blackdiscard Array of deck indices for discarded cards
 * @prop {Boolean} isdemocracy Whether or not this room has enabled democracy mode
 * @prop {{
 *   stage: String,
 *   czar: String|null,
 *   round: Number,
 *   cycle: Number,
 *   black: {text: String, pick: int} | null
 * }} gamestate Game State Object
 */
export class Room {
  _io;
  name;
  vip;
  cards = {};
  picks = {};
  pickorder = [];
  whitedeck = [];
  blackdeck = [];
  whitediscard = [];
  blackdiscard = [];
  isdemocracy = false;
  gamestate = {
    stage: "lobby",
    czar: null,
    round: 0,
    cycle: 0,
    black: null,
  };
  playerClients = [];

  constructor(io, name, user) {
    this._io = io;
    this.name = name;
    this.setVIP(user);
  }

  /**
   * Exports Room data as JSON to send to player clients.
   */
  toJSON() {
    return {
      isdemocracy: this.isdemocracy,
      gamestate: this.gamestate,
    };
  }

  /**
   * Refreshes a new connection with current data.
   * @arg {Socket} ncl New connection socket of potentially reconnected player.
   */
  refreshClient(ncl) {
    // TODO: Transfer waitfor()s, however thatll work lmao
    let idx = this.playerClients.findIndex((cl) => cl.user.id == ncl.user.id);
    if (idx == -1) return;
    this.playerClients[idx] = ncl;
    ncl.emit(
      "YOUR_CARDS",
      this.cards[ncl.user.id].map((i) => baseDeck.white[i])
    );
  }

  /**
   * Prints debug information to the console, pre-tagged with the room name (activity id)
   * @param  {...any} args Stuff to print
   */
  print(...args) {
    console.log("\u001b[0;34m[" + this.name + "]\u001b[0m", ...args);
  }

  // --- Meta Utilities ---

  /**
   * Sets this room's VIP to this user and emits the update event.
   * @arg {String} user User ID of new VIP
   */
  setVIP(user) {
    this.vip = user.user.id;
    this._io.in(this.name).emit("NEW_VIP", this.vip);
  }

  // --- Game Utilities ---

  /**
   * Sets the new Czar to the next in line.
   */
  nextCzar() {
    this.gamestate.czar =
      this.playerClients[
        this.gamestate.round % this.playerClients.length
      ].user.id;
  }

  /**
   * Fills up player's deck.
   * @arg {String | String[] | null} userid User ID to target this user, Array of IDs to fill each of them, null to fill all existing hands.
   */
  distributeCards(userid = null) {
    // this.print("shuffling cards for", userid);
    if (!userid) {
      Object.keys(this.cards).forEach((u) => this.distributeCards(u));
      return;
    } else if (Array.isArray(userid)) {
      userid.forEach((u) => this.distributeCards(u));
      return;
    }

    let current = userid in this.cards ? this.cards[userid] : [];
    let pullNr = cardsPerPlayer - current.length;
    this.cards[userid] = [...current, ...this.pullWhite(pullNr)];
  }

  /**
   * Pulls a number of white cards, automatically reshuffles when needed.
   * @arg {int} nr Number of cards to pull.
   * @returns {int[]} List of pulled cards (indices)
   */
  pullWhite(nr) {
    let pulled = [];
    if (this.whitedeck.length < nr) {
      pulled = [...this.whitedeck];
      nr = nr - pulled.length;
      this.shuffleDeck(1);
    }
    return [...pulled, ...this.whitedeck.splice(0, nr)];
  }

  /**
   * Pulls a number of black cards, automatically reshuffles when needed.
   * @arg {int} nr Number of cards to pull.
   * @returns {int[]} List of pulled cards (indices)
   */
  pullBlack(nr) {
    let pulled = [];
    if (this.blackdeck.length < nr) {
      pulled = [...this.blackdeck];
      nr = nr - pulled.length;
      this.shuffleDeck(2);
    }
    return [...pulled, ...this.blackdeck.splice(0, nr)];
  }

  /**
   * Shuffles one or both of the decks of this room.
   * @arg {int} n Bitfield <White, Black> of which to shuffle. n = 1 -> Shuffle White, n = 2 -> Shuffle Black, n = 3 -> Shuffle Both.
   * @arg {Boolean} fromSource true if deck should be filled up from the source deck, false if it should recycle discard pile
   */
  shuffleDeck(n = 3, fromSource = false) {
    if (n & 1) {
      this.whitedeck = fromSource
        ? shuffleRange(baseDeck.white.length)
        : shuffleRange(this.whitediscard.length).map(
          (i) => this.whitediscard[i]
        );
      if (!fromSource) this.whitediscard = [];
    }
    if (n & 2) {
      this.blackdeck = fromSource
        ? shuffleRange(baseDeck.black.length)
        : shuffleRange(this.blackdiscard.length).map(
          (i) => this.blackdiscard[i]
        );
      if (!fromSource) this.blackdiscard = [];
    }
    // this.print(this.whitedeck, this.blackdeck);
  }

  // --- Progression Methods ---

  // TODO: Show timeouts to player

  /**
   * Starts the game.
   */
  async startGame() {
    if (this.gamestate.stage != "lobby") return;
    this.print("-- STARTING GAME --");
    this.shuffleDeck(3, true);
    this.cards = {};

    this.playerClients = await this._io.of("/").in(this.name).fetchSockets();

    this.gamestate = {
      stage: "card_preview",
      czar: null,
      round: 0,
      cycle: 0,
      black: null,
    };

    this.startRound();
  }

  /**
   * Starts and counts a new round.
   */
  async startRound() {
    this.print("STARTING ROUND");
    this.gamestate.round++;

    this.nextCzar();

    this.distributeCards(this.playerClients.map((c) => c.user.id));
    this.playerClients.forEach((c) => {
      c.emit(
        "YOUR_CARDS",
        this.cards[c.user.id].map((i) => baseDeck.white[i])
      );
    });

    this.print("Starting Card Preview");

    this.gamestate.stage = "card_preview";
    this._io.in(this.name).emit("GAMESTATE", this.toJSON());

    await Promise.allSettled(
      this.playerClients.map((cl) =>
        cl.waitFor("CONTINUE", timeouts.cardpreview)
      )
    );

    this.startBlackPick();
  }

  async startBlackPick() {
    this.print("Starting Black Pick.");

    this.gamestate.stage = "black_pick";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);

    let options = this.pullBlack(3);

    if (this.isdemocracy) {
      this._io.in(this.name).emit(
        "BLACK_OPTIONS",
        options.map((o) => baseDeck.black[o].text)
      );

      let picks = await Promise.allSettled(
        this.playerClients.map((c) =>
          c.waitFor("BLACK_PICK", timeouts.blackpick).then(
            (p) => {
              this.gamestate.black = baseDeck.black[options[p]];
            },
            () => {
              this.gamestate.black =
                baseDeck.black[
                options[Math.floor(Math.random() * options.length)]
                ];
            }
          )
        )
      );

      let votes = picks
        .filter((x) => x.status == "fulfilled")
        .map((x) => x.value)
        .filter((x) => typeof x == "number" && x >= 0 && x < options.length);
      // If no votes, fill up with one vote per option to invoke random outcome
      if (!votes.length) for (let i = 0; i < options.length; i++) votes.push(i);

      this.gamestate.black = baseDeck.black[options[democracy(votes)]];
    } else {
      let czarClient = this.playerClients.find(
        (x) => x.user.id == this.gamestate.czar
      );

      czarClient.emit(
        "BLACK_OPTIONS",
        options.map((o) => baseDeck.black[o].text)
      );

      try {
        this.gamestate.black =
          baseDeck.black[
          options[await czarClient.waitFor("BLACK_PICK", timeouts.blackpick)]
          ];
      } catch {
        this.gamestate.black =
          baseDeck.black[options[Math.floor(Math.random() * options.length)]];
      }
    }

    this.print("Votes are in:", this.gamestate.black);

    this.startWhitePick();
  }

  async startWhitePick() {
    this.print("Starting White Pick.");

    this._io.in(this.name).emit("BLACK_PROMPT", this.gamestate.black);

    this.gamestate.stage = "white_pick";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);

    // TODO: check if players have played cards
    let picksRaw = await Promise.allSettled(
      this.playerClients.map((c) =>
        c.waitFor("WHITE_ANSWER", timeouts.whiteanswer).then(
          (p) => ({
            user: c.user.id,
            pick: p,
          }),
          () => Promise.reject(c.user.id)
        )
      )
    );

    this.picks = {};
    picksRaw.forEach((p) => {
      // TODO: Check if player has card(s)
      if (p.status == "fulfilled") this.picks[p.value.user] = p.value.pick;
      else this.picks[p.reason] = null;
    });

    this.print("Picks are in:", this.picks);

    this.startPresent();
  }

  async startPresent() {
    this.print("Starting Presentation.");

    // TODO: presenter / common consensus when in democracy
    let czarClient = this.playerClients.find(
      (x) => x.user.id == this.gamestate.czar
    );

    this.gamestate.stage = "present";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);

    this.pickorder = shuffleArr(Object.keys(this.picks));

    for (let i = 0; i < this.pickorder.length; i++) {
      await czarClient.waitFor("CONTINUE", timeouts.presentreveal);
      this._io.in(this.name).emit("WHITE_PRESENT", this.picks[this.pickorder[i]]);
      await czarClient.waitFor("CONTINUE", timeouts.presentnext);
      this._io.in(this.name).emit("WHITE_NEXT");
    }
  }
}
