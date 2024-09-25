const fs = require("fs");
const path = require("path");

// Load the original cards.json file
const filePath = "./cards.json";

fs.readFile(filePath, "utf-8", (err, data) => {
	if (err) {
		console.error("Error reading the file:", err);
		return;
	}

	const { whiteCards, blackCards, order, ...packs } = JSON.parse(data);
  

	const result = order.map((pack) => {
		return {
			name: packs[pack].name,
			white: packs[pack].white.map((i) => whiteCards[i]),
			black: packs[pack].black.map((i) => blackCards[i]),
		};
	});

    // console.log(Object.keys(result));
	order.forEach((pack, i) => {

		const outputFilePath = path.join(__dirname, `./out/${pack}.json`);
		fs.writeFile(outputFilePath, JSON.stringify(result[i], null, 2), "utf8", (err) => {
			if (err) {
				console.error(`Error writing ${outputFilePath}`, err);
			} else {
				console.log(`Pack ${outputFilePath} saved.`);
			}
		});
	});
});
