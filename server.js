// BOOK N MEET - entry file for Vercel.
// Vercel looks for server.js in the main folder; the real server
// code is in backend/server.js (and backend/data.js).
const express = require("express"); // tells Vercel this is an Express app
module.exports = require("./backend/server");
