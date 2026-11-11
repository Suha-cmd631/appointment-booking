// Runs once before all tests: makes sure the server and website are running.
// If "npm run dev" is already running it is used; otherwise it is started here
// and stopped again after the tests.

const { spawn } = require("child_process");
const path = require("path");
const { API, SITE, ROOT } = require("./common");

async function isUp(url) {
    try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        return res.ok;
    } catch (e) {
        return false;
    }
}

module.exports = async function () {
    const apiUp = await isUp(API + "/api/health");
    const siteUp = await isUp(SITE + "/landing.html");

    if (apiUp && siteUp) {
        console.log("\nUsing the server that is already running.");
        return;
    }

    if (apiUp !== siteUp) {
        throw new Error("Only part of the project is running. Stop it (Ctrl + C) and run the tests again.");
    }

    console.log("\nStarting the server for the tests...");
    require("fs").mkdirSync(path.join(ROOT, "test-report"), { recursive: true });
    try { require("fs").unlinkSync(path.join(ROOT, "test-report", "emails.log")); } catch (e) { /* none yet */ }
    const child = spawn(process.execPath, [path.join(ROOT, "backend", "dev.js")], {
        // Emails are written to test-report/emails.log instead of being sent
        env: { ...process.env, BNM_NO_BROWSER: "1", SMTP_USER: "", SMTP_PASS: "",
            MAIL_TEST_FILE: path.join(ROOT, "test-report", "emails.log") },
        stdio: "ignore"
    });
    globalThis.__BNM_SERVER__ = child;

    for (let i = 0; i < 40; i++) {
        if (await isUp(API + "/api/health") && await isUp(SITE + "/landing.html")) return;
        await new Promise((r) => setTimeout(r, 500));
    }
    child.kill();
    throw new Error("The server did not start. Check backend/.env and run npm run dev to see the error.");
};
