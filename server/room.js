/**
 * Room Class
 * @prop {Object.<string, string[]>} cards Map of user ids to card array
 * @prop {Boolean} isdemocracy Whether or not this room has enabled democracy mode
 * @prop {{
 *   stage: String,
 *   czar: String|null,
 *   round: Number,
 *   cycle: Number
 * }} gamestate Game State Object
 */
export class Room {
	#io;
	name;
  vip;
	cards = {};
	isdemocracy = false;
	gamestate = {
		stage: "LOBBY",
		czar: null,
		round: 0,
		cycle: 0,
	};

	constructor(io, name, user) {
		this.#io = io;
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
		this.vip = user.user.id;
		this.#io.in(this.name).emit("NEW_VIP", this.vip);
	}

	startGame() {
		// this.cards;
		this.#io.in(this.name).emit("TO_SCREEN", "CARD_PREVIEW");
	}
}
