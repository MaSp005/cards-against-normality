const fs = require("fs");
let cards = {
    black: [],
    white: [],
};

// config
importPack(require("../../server/src/packs/Base.json"));
const amount = 50;

// actual code
const output = [];

for (let i = 0; i < amount; i++) {
  let blackCard = cards.black[Math.floor(Math.random() * cards.black.length)];
  // black card should only have one pick
  while (blackCard.pick > 1) {
    blackCard = cards.black[Math.floor(Math.random() * cards.black.length)];
  }
  let whiteCard = cards.white[Math.floor(Math.random() * cards.white.length)];

  output.push({
    black: blackCard.text,
    white: whiteCard,
  });
}

fs.writeFileSync("./output.json", JSON.stringify(output, null, 4));

function importPack(pack) {
  cards.black = [...cards.black, ...pack.black];
  cards.white = [...cards.white, ...pack.white];
}