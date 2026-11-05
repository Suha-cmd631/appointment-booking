// ======================================================
// BOOK N MEET - BACKEND SERVER
//
// This file:   starting the server, accounts (sign up, log in,
//              Google, password reset, profile).
// data.js:     hospitals, doctors, schedules, appointments and
//              notifications (everything else the website saves).
//
// Start it with:  npm start
// ======================================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

// Stop early with a clear message if the keys are missing.
["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"].forEach((name) => {
    if (!process.env[name] || /your-|example/i.test(process.env[name])) {
        console.error("");
        console.error("Missing " + name + " in backend/.env");
        console.error("Open backend/.env and paste your real Supabase values (see SETUP-GUIDE.md).");
        console.error("");
        process.exit(1);
    }
});

// The project address must be just "https://xxxx.supabase.co".
// If "/rest/v1" (or a "/") was copied with it, remove it.
process.env.SUPABASE_URL = process.env.SUPABASE_URL
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth)\/v1$/, "");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));


// ======================================================
// SUPABASE CLIENTS
// ======================================================

// Server-only client: full access to the database.
// The secret key never leaves this server.
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// A fresh sign-in client for one request, so one person's
// sign-in is never mixed up with another person's.
function newAuthClient() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}


// ======================================================
// SMALL HELPERS
// ======================================================

const PASSWORD_RULE_MESSAGE =
    "Password must be at least 8 characters and contain a capital letter, a digit and a special character.";

function isValidPassword(password) {
    return (
        typeof password === "string" &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
    );
}

function cleanText(value, maxLength) {
    return String(value == null ? "" : value).trim().slice(0, maxLength || 200);
}

// What the website gets back about the logged-in person.
function publicUser(profile) {
    return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        contact: profile.contact,
        role: profile.role,
        hospital: profile.hospital
    };
}

// What the website gets back after a successful log in.
function sessionDetails(session) {
    return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
    };
}

// Staff must type their hospital's join code (shown on the
// admin Settings page and by "node check-accounts.js").
function joinCodeMatches(hospital, typedCode) {
    const expected = String(hospital.join_code || "").trim().toUpperCase();
    const typed = String(typedCode || "").trim().toUpperCase();
    return expected !== "" && typed === expected;
}

const WRONG_CODE_MESSAGE =
    "The hospital join code is not correct. Ask a staff member of your hospital for the code (admin Settings page).";

function serverError(res, error) {
    if (error && error.outdated) {
        console.error("The database needs updating: run backend/database/setup.sql again in Supabase (SQL Editor).");
        return res.status(500).json({
            success: false,
            message: "The database needs updating. Run backend/database/setup.sql again in Supabase."
        });
    }
    console.error(error);
    res.status(500).json({
        success: false,
        message: "Something went wrong on the server. Please try again."
    });
}

// Hospital names exactly as saved in the database.
async function findHospitalByName(name) {
    const { data, error } = await supabaseAdmin
        .from("hospitals")
        .select("id, name, join_code");

    if (error) {
        // the join_code column is missing: the database is from before join codes
        if (error.code === "42703" || /join_code/.test(error.message || "")) {
            const outdated = new Error("database-outdated");
            outdated.outdated = true;
            throw outdated;
        }
        throw error;
    }

    const wanted = cleanText(name).toLowerCase();

    return (data || []).find(
        (hospital) => hospital.name.toLowerCase() === wanted
    ) || null;
}


// ======================================================
// IS THE SERVER RUNNING?
// ======================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "BOOK N MEET backend is running"
    });
});


// ======================================================
// SIGN UP
// ======================================================

app.post("/api/signup", async (req, res) => {

    try {

        const name = cleanText(req.body.name, 80);
        const email = cleanText(req.body.email, 120).toLowerCase();
        const contact = cleanText(req.body.contact, 20);
        const role = req.body.role;
        const password = req.body.password;

        if (!name || !email || !password || !contact || !role) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled."
            });
        }

        if (!/^[A-Za-z\s]+$/.test(name)) {
            return res.status(400).json({
                success: false,
                message: "Name can contain only alphabets and spaces."
            });
        }

        if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Email must be a valid address ending in @gmail.com."
            });
        }

        if (!/^\d{10}$/.test(contact)) {
            return res.status(400).json({
                success: false,
                message: "Contact number must contain exactly 10 digits."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: PASSWORD_RULE_MESSAGE
            });
        }

        if (role !== "patient" && role !== "staff") {
            return res.status(400).json({
                success: false,
                message: "Invalid role."
            });
        }

        // Staff must pick a hospital that really exists
        let hospitalName = null;

        if (role === "staff") {

            const hospital = await findHospitalByName(req.body.hospital);

            if (!hospital) {
                return res.status(400).json({
                    success: false,
                    message: "Please select your hospital from the list."
                });
            }

            if (!joinCodeMatches(hospital, req.body.joinCode)) {
                return res.status(400).json({
                    success: false,
                    message: WRONG_CODE_MESSAGE
                });
            }

            hospitalName = hospital.name;
        }

        // Create the login (email + password) in Supabase Auth
        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { name, contact, role }
        });

        if (authError) {

            console.error(authError);

            const alreadyUsed = /already|registered|exists/i.test(authError.message || "");

            return res.status(400).json({
                success: false,
                message: alreadyUsed
                    ? "An account with this email already exists. Please log in instead."
                    : authError.message
            });
        }

        const user = authData.user;

        // Save the person's details
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: user.id,
                name,
                email,
                contact,
                role,
                hospital: hospitalName
            })
            .select()
            .single();

        // If that failed, remove the login again so no half
        // account is left behind.
        if (profileError) {
            console.error(profileError);
            await supabaseAdmin.auth.admin.deleteUser(user.id);
            return res.status(500).json({
                success: false,
                message: "Account could not be completed. Please try again."
            });
        }

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: publicUser(profile)
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// LOG IN
// ======================================================

app.post("/api/login", async (req, res) => {

    try {

        const email = cleanText(req.body.email, 120).toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const {
            data: authData,
            error: authError
        } = await newAuthClient().auth.signInWithPassword({ email, password });

        if (authError) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "This account has no profile. Please sign up again."
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            session: sessionDetails(authData.session),
            user: publicUser(profile)
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// STAY LOGGED IN
// A log-in lasts one hour. The website calls this to get
// a fresh one without asking for the password again.
// ======================================================

app.post("/api/refresh", async (req, res) => {

    try {

        const refreshToken = req.body.refresh_token;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            });
        }

        const { data, error } = await newAuthClient().auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error || !data.session) {
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            });
        }

        res.json({
            success: true,
            session: sessionDetails(data.session)
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// CONTINUE WITH GOOGLE
//
// The website sends the "credential" it received from
// Google. Supabase checks it with Google and signs the
// person in. (The Google provider must be enabled in the
// Supabase dashboard - see SETUP-GUIDE.md.)
// ======================================================

app.post("/api/google-login", async (req, res) => {

    try {

        const credential = req.body.credential;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google sign-in information is missing."
            });
        }

        const {
            data: authData,
            error: authError
        } = await newAuthClient().auth.signInWithIdToken({
            provider: "google",
            token: credential
        });

        if (authError || !authData.user || !authData.session) {
            console.error(authError);
            return res.status(401).json({
                success: false,
                message: "Google sign-in failed. Check that Google is enabled in Supabase."
            });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        // First time: the website asks for contact number, role and hospital
        if (!profile) {
            return res.json({
                success: true,
                needsProfile: true,
                session: sessionDetails(authData.session),
                user: {
                    id: authData.user.id,
                    email: authData.user.email
                }
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            session: sessionDetails(authData.session),
            user: publicUser(profile)
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// FINISH A NEW GOOGLE ACCOUNT
// (save contact number, role and hospital)
// ======================================================

app.post("/api/google-complete", async (req, res) => {

    try {

        const accessToken = req.body.access_token;

        const { data: userData, error: userError } = accessToken
            ? await supabaseAdmin.auth.getUser(accessToken)
            : { data: null, error: true };

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message: "Please sign in with Google again."
            });
        }

        const user = userData.user;
        const contact = cleanText(req.body.contact, 20);
        const role = req.body.role;

        if (!/^\d{10}$/.test(contact)) {
            return res.status(400).json({
                success: false,
                message: "Contact number must contain exactly 10 digits."
            });
        }

        if (role !== "patient" && role !== "staff") {
            return res.status(400).json({
                success: false,
                message: "Invalid role."
            });
        }

        let hospitalName = null;

        if (role === "staff") {

            const hospital = await findHospitalByName(req.body.hospital);

            if (!hospital) {
                return res.status(400).json({
                    success: false,
                    message: "Please select your hospital from the list."
                });
            }

            if (!joinCodeMatches(hospital, req.body.joinCode)) {
                return res.status(400).json({
                    success: false,
                    message: WRONG_CODE_MESSAGE
                });
            }

            hospitalName = hospital.name;
        }

        const name =
            (user.user_metadata &&
                (user.user_metadata.full_name || user.user_metadata.name)) ||
            user.email.split("@")[0];

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: user.id,
                name: cleanText(name, 80),
                email: user.email.trim().toLowerCase(),
                contact,
                role,
                hospital: hospitalName
            })
            .select()
            .single();

        if (profileError) {
            console.error(profileError);
            return res.status(500).json({
                success: false,
                message: "Your profile could not be saved."
            });
        }

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: publicUser(profile)
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// FORGOT PASSWORD
// Supabase emails a link that opens reset-password.html
// ======================================================

app.post("/api/forgot-password", async (req, res) => {

    try {

        const email = cleanText(req.body.email, 120).toLowerCase();
        const redirectTo = req.body.redirectTo;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const { error } = await newAuthClient().auth.resetPasswordForEmail(
            email,
            redirectTo ? { redirectTo } : undefined
        );

        if (error) {
            console.error(error);
        }

        // Same answer whether or not the account exists,
        // so nobody can use this to check who has an account.
        res.json({
            success: true,
            message: "If an account exists, a reset link has been sent."
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// SET A NEW PASSWORD
// (called by reset-password.html after the email link)
// ======================================================

app.post("/api/reset-password", async (req, res) => {

    try {

        const accessToken = req.body.access_token;
        const password = req.body.password;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "This reset link is not valid. Please request a new one."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: PASSWORD_RULE_MESSAGE
            });
        }

        const { data: userData, error: userError } =
            await supabaseAdmin.auth.getUser(accessToken);

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message: "This reset link has expired. Please request a new one."
            });
        }

        const { error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(
                userData.user.id,
                { password }
            );

        if (updateError) {
            console.error(updateError);
            return res.status(400).json({
                success: false,
                message: updateError.message
            });
        }

        res.json({
            success: true,
            message: "Password updated. You can log in now."
        });
    }

    catch (error) {
        serverError(res, error);
    }
});


// ======================================================
// EVERYTHING ELSE (hospitals, doctors, appointments...)
// ======================================================

require("./data")(app, {
    supabaseAdmin,
    cleanText,
    publicUser,
    serverError
});


// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log("   BOOK N MEET BACKEND");
    console.log("======================================");
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("======================================");
    console.log("");
});
