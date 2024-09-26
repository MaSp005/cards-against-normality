/**
 * Room Class
 * @prop {Array} players Array of player sockets
 * @prop {Boolean} isdemocracy Whether or not this room has enabled democracy mode
 * @prop {{
 *   stage: String,
 *   czar: String|null,
 *   round: Number,
 *   cycle: Number
 * }} gamestate Game State Object
 */
export class Room {
	players = [];
	isdemocracy = false;
	gamestate = {
		stage: "LOBBY",
		czar: null,
		round: 0,
		cycle: 0,
	};

	constructor() {}

	join(socket) {
		this.players.push(socket);
	}
	leave(socket) {
		if (!this.players.includes(socket)) return;
		this.players.splice(this.players.indexOf(socket));
	}
}
