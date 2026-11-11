// "npm run dev" - starts everything and opens the website.
//   1. the backend server   -> http://localhost:5050
//   2. the website (public folder) -> http://localhost:5501
//   3. opens landing.html in your browser
const path = require("path");
const { exec } = require("child_process");

process.chdir(__dirname);            // so backend/.env is always found
require("./server");                 // 1. backend server

const express = require("express");
const site = express();
const SITE_PORT = 5501;
const FRONTEND = path.join(__dirname, "..", "public");

site.use(express.static(FRONTEND, { extensions: ["html"] }));
site.get("/", (req, res) => res.redirect("/landing.html"));

const url = `http://localhost:${SITE_PORT}/landing.html`;

site.listen(SITE_PORT, () => {        // 2. website
  console.log(`Website running on ${url}`);
  console.log("Press Ctrl + C to stop.");
  const opener = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? 'start ""' : "xdg-open";
  if (!process.env.BNM_NO_BROWSER) exec(`${opener} "${url}"`);   // 3. open browser
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${SITE_PORT} is busy (Live Server may be running). Stop it, then run npm run dev again.`);
    process.exit(1);
  }
  throw err;
});
