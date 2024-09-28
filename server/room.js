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

// import baseDeck from ;
import fs from "fs";
const baseDeck = JSON.parse(fs.readFileSync("./src/packs/Base.json", "utf8"));

const cardsPerPlayer = 8;

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
 *   cycle: Number
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
  };

  constructor(io, name, user) {
    this._io = io;
    this.name = name;
    this.setVIP(user);
  }

  toJSON() {
    return {
      isdemocracy: this.isdemocracy,
      gamestate: this.gamestate,
    };
  }

  setVIP(user) {
    console.log(user);
    this.vip = user.user.id;
    this._io.in(this.name).emit("NEW_VIP", this.vip);
  }

  distributeCards(userid = null) {
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
   * @prop {int} nr Number of cards to pull.
   * @returns {int[]} List of pulled cards (indices)
   */
  pullWhite(nr) {
    let pulled = [];
    if (this.whitedeck.length < pullNr) {
      pulled = [...this.whitedeck];
      nr = nr - pulled.length;
      this.shuffleDeck(1);
    }
    return [...pulled, ...this.whitedeck.splice(0, nr)];
  }

  /**
   * Pulls a number of black cards, automatically reshuffles when needed.
   * @prop {int} nr Number of cards to pull.
   * @returns {int[]} List of pulled cards (indices)
   */
  pullBlack(nr) {
    let pulled = [];
    if (this.blackdeck.length < pullNr) {
      pulled = [...this.blackdeck];
      nr = nr - pulled.length;
      this.shuffleDeck(2);
    }
    return [...pulled, ...this.blackdeck.splice(0, nr)];
  }

  /**
   * Shuffles one or both of the decks of this room.
   * @prop {int} n Bitfield <White, Black> of which to shuffle. n = 1 -> Shuffle White, n = 2 -> Shuffle Black, n = 3 -> Shuffle Both.
   * @prop {Boolean} fromSource true if deck should be filled up from the source deck, false if it should recycle discard pile
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
        ? shuffleRange(baseDeck.white.length)
        : shuffleRange(this.whitediscard.length).map(
            (i) => this.blackdiscard[i]
          );
      if (!fromSource) this.blackdiscard = [];
    }
    // console.log(this.whitedeck, this.blackdeck);
  }

  async startGame() {
    this.shuffleDeck(3, true);
    this.cards = {};

    let cl = await this._io.of("/").in(this.name).fetchSockets();
    this.distributeCards(cl.map((c) => c.user.id));
    console.log(this.cards);

    this.gamestate.stage = "CARD_PREVIEW";
    this._io.in(this.name).emit("TO_SCREEN", this.gamestate.stage);
    cl.forEach((c) => {
      c.emit(
        "YOUR_CARDS",
        this.cards[c.user.id].map((i) => baseDeck.white[i])
      );
    });
  }
}
