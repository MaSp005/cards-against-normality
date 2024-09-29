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
 * Finds the most common entry in the array.
 * @arg {Array} arr Array of values "votes"
 * @returns {any} Most common entry
 */
function democracy(arr) {
  let votes = new Map();
  arr.forEach((v) => {
    votes.set(v, votes.get(v) + 1 || 1);
  });
  console.log(votes);
  let max = Math.max(...votes.values());
  console.log(max);
  let mostpop = [];
  votes.keys().forEach((k) => {
    if (votes.get(k) == max) mostpop.push(k);
  });
  console.log(mostpop);
  return mostpop[Math.floor(Math.random() * mostpop.length)] || arr[0];
}

// import baseDeck from ;
import fs from "fs";
const baseDeck = JSON.parse(fs.readFileSync("./src/packs/Base.json", "utf8"));

const cardsPerPlayer = 8;
const timeouts = {
  cardpreview: 20 * 1000,
  blackpick: 30 * 1000,
};

/**
 * Room Class
 * @prop {String} name Instance ID connected to this room
 * @prop {String} vip User ID of current VIP Player
 * @prop {Object.<string, string[]>} cards Map of user ids to card array
 * @prop {int[]} whitedeck Array of indices
 * @prop {int[]} blackdeck Array of indices
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
  whitedeck = [];
  blackdeck = [];
  whitediscard = [];
  blackdiscard = [];
  isdemocracy = false;
  gamestate = {
    stage: "LOBBY",
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
   * Sets this room's VIP to this user and emits the update event.
   * @arg {String} user User ID of new VIP
   */
  setVIP(user) {
    console.log(user);
    this.vip = user.user.id;
    this._io.in(this.name).emit("NEW_VIP", this.vip);
  }

  /**
   * Fills up player's deck.
   * @arg {String | String[] | null} userid User ID to target this user, Array of IDs to fill each of them, null to fill all existing hands.
   */
  distributeCards(userid = null) {
    // console.log("shuffling cards for", userid);
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
    // console.log(this.whitedeck, this.blackdeck);
  }

  /**
   * Starts the game.
   */
  async startGame() {
    if (this.gamestate.stage != "LOBBY") return;
    console.log("-- STARTING GAME --");
    this.shuffleDeck(3, true);
    this.cards = {};

    this.playerClients = await this._io.of("/").in(this.name).fetchSockets();

    this.gamestate = {
      stage: "CARD_PREVIEW",
      czar: null,
      round: 0,
      cycle: 0,
    };

    this.startRound();
  }

  /**
   * Starts and counts a new round.
   */
  async startRound() {
    console.log("STARTING ROUND");
    this.gamestate.round++;

    this.distributeCards(this.playerClients.map((c) => c.user.id));
    this.playerClients.forEach((c) => {
      c.emit(
        "YOUR_CARDS",
        this.cards[c.user.id].map((i) => baseDeck.white[i])
      );
    });

    this.startCardPreview();
  }

  async startCardPreview() {
    console.log("Starting Card Preview");
    
    this.gamestate.stage = "CARD_PREVIEW";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);

    await Promise.allSettled(
      this.playerClients.map((cl) =>
        cl.waitFor("CONTINUE", timeouts.cardpreview)
      )
    );

    this.startBlackPick();
  }

  async startBlackPick() {
    console.log("Starting Black Pick.");

    this.gamestate.stage = "BLACK_PICK";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);

    let options = this.pullBlack(3);
    // console.log(options);

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
      let czarClient = this.playerClients.find((x) => x.user.id == this.vip);

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

    console.log("Votes are in:", this.gamestate.black);
  }
}
