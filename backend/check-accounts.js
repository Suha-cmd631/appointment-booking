// Shows the accounts saved in the database, their role, and each
// hospital's staff join code.
// Run it from the backend folder with:   node check-accounts.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

(async () => {
    const { data, error } = await db
        .from("profiles")
        .select("email, role, hospital, created_at")
        .order("created_at");

    if (error) {
        console.log("Could not read accounts:", error.message);
        return;
    }

    console.log("");
    console.log("Accounts in the database:");
    data.forEach((p) => {
        console.log(" - " + p.email + "  |  " + p.role + (p.hospital ? "  |  " + p.hospital : ""));
    });
    if (data.length === 0) console.log(" (none yet)");

    const { data: hospitals, error: hospitalError } = await db
        .from("hospitals")
        .select("name, join_code")
        .order("name");

    console.log("");
    console.log("Staff join codes (needed to sign up as Hospital Staff):");

    if (hospitalError) {
        console.log(" Could not read them: run backend/database/setup.sql again in Supabase.");
    } else {
        hospitals.forEach((h) => console.log(" - " + h.name + "  ->  " + (h.join_code || "(none)")));
    }

    console.log("");
})();
