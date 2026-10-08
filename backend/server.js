const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const {
    createClient
} = require("@supabase/supabase-js");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


// ======================================================
// SUPABASE CLIENTS
// ======================================================

const supabasePublic = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);


// Server-only client
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
// PASSWORD RULE
// (the same rule is shown on the sign up page)
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


// ======================================================
// TEST ROUTE
// ======================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "BOOK N MEET backend is running"
    });

});


// ======================================================
// SIGNUP
// ======================================================

app.post("/api/signup", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            contact,
            role,
            hospital
        } = req.body;


        // ----------------------------------------------
        // VALIDATION
        // ----------------------------------------------

        if (
            !name ||
            !email ||
            !password ||
            !contact ||
            !role
        ) {

            return res.status(400).json({
                success: false,
                message: "All required fields must be filled."
            });

        }


        // Email validation

        if (!email.toLowerCase().endsWith("@gmail.com")) {

            return res.status(400).json({
                success: false,
                message: "Email must end with @gmail.com."
            });

        }


        // Contact validation

        if (!/^\d{10}$/.test(contact)) {

            return res.status(400).json({
                success: false,
                message: "Contact number must contain exactly 10 digits."
            });

        }


        // Password validation

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: PASSWORD_RULE_MESSAGE
            });
        }


        // Role validation

        if (
            role !== "patient" &&
            role !== "staff"
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid role."
            });

        }


        // Staff must have hospital

        if (
            role === "staff" &&
            (!hospital || hospital.trim() === "")
        ) {

            return res.status(400).json({
                success: false,
                message: "Hospital is required for staff accounts."
            });

        }


        // ==================================================
        // CREATE SUPABASE AUTH USER
        // ==================================================

        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.admin.createUser({

            email: email.trim().toLowerCase(),

            password: password,

            email_confirm: true,

            user_metadata: {
                name: name.trim(),
                contact: contact.trim(),
                role: role
            }

        });


        if (authError) {

            console.error(authError);

            return res.status(400).json({
                success: false,
                message: authError.message
            });

        }


        const user = authData.user;


        // ==================================================
        // CREATE PROFILE
        // ==================================================

        const {
            data: profile,
            error: profileError
        } = await supabaseAdmin
            .from("profiles")
            .insert({

                id: user.id,

                name: name.trim(),

                email: email.trim().toLowerCase(),

                contact: contact.trim(),

                role: role,

                hospital:
                    role === "staff"
                        ? hospital.trim()
                        : null

            })
            .select()
            .single();


        // If profile creation failed,
        // remove Auth account so signup doesn't leave
        // an incomplete account.

        if (profileError) {

            console.error(profileError);


            await supabaseAdmin.auth.admin.deleteUser(
                user.id
            );


            return res.status(500).json({
                success: false,
                message:
                    "Account could not be completed. Please try again."
            });

        }


        // ==================================================
        // SUCCESS
        // ==================================================

        res.status(201).json({

            success: true,

            message: "Account created successfully.",

            user: {
                id: user.id,
                email: user.email
            },

            profile: profile

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});


// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });

        }


        // ==================================================
        // AUTHENTICATE
        // ==================================================

        const {

            data: authData,

            error: authError

        } = await supabasePublic.auth.signInWithPassword({

            email:
                email.trim().toLowerCase(),

            password

        });


        if (authError) {

            console.error(authError);

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        const user = authData.user;

        const session = authData.session;


        // ==================================================
        // GET PROFILE
        // ==================================================

        const {

            data: profile,

            error: profileError

        } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();


        if (profileError) {

            console.error(profileError);

            return res.status(500).json({

                success: false,

                message:
                    "User profile could not be found."

            });

        }


        // ==================================================
        // RETURN LOGIN RESULT
        // ==================================================

        res.json({

            success: true,

            message: "Login successful.",

            access_token:
                session.access_token,

            refresh_token:
                session.refresh_token,

            user: {

                id: user.id,

                email: user.email,

                name: profile.name,

                contact: profile.contact,

                role: profile.role,

                hospital: profile.hospital

            }

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }

});


// ======================================================
// LOGGED-IN USER DETAILS SENT TO THE WEBSITE
// ======================================================

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

        const { credential } = req.body;

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
                message:
                    "Google sign-in failed. Check that Google is enabled in Supabase."
            });
        }

        const user = authData.user;

        // Does this person already have a profile?
        const {
            data: profile,
            error: profileError
        } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {

            console.error(profileError);

            return res.status(500).json({
                success: false,
                message: "User profile could not be loaded."
            });
        }

        // First time: the website must ask for
        // contact number, role and hospital.
        if (!profile) {
            return res.json({
                success: true,
                needsProfile: true,
                access_token: authData.session.access_token,
                user: {
                    id: user.id,
                    email: user.email
                }
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            user: publicUser(profile)
        });
    }

    catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});


// ======================================================
// FINISH A NEW GOOGLE ACCOUNT
// (save contact number, role and hospital)
// ======================================================

app.post("/api/google-complete", async (req, res) => {

    try {

        const {
            access_token,
            contact,
            role,
            hospital
        } = req.body;

        if (!access_token) {
            return res.status(401).json({
                success: false,
                message: "Please sign in with Google again."
            });
        }

        // Find out who this is from their sign-in token
        const {
            data: userData,
            error: userError
        } = await supabaseAdmin.auth.getUser(access_token);

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message: "Please sign in with Google again."
            });
        }

        const user = userData.user;

        if (!/^\d{10}$/.test(String(contact || ""))) {
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

        if (
            role === "staff" &&
            (!hospital || String(hospital).trim() === "")
        ) {
            return res.status(400).json({
                success: false,
                message: "Hospital is required for staff accounts."
            });
        }

        const name =
            (user.user_metadata &&
                (user.user_metadata.full_name ||
                    user.user_metadata.name)) ||
            user.email.split("@")[0];

        const {
            data: profile,
            error: profileError
        } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: user.id,
                name: String(name).trim(),
                email: user.email.trim().toLowerCase(),
                contact: String(contact).trim(),
                role: role,
                hospital:
                    role === "staff"
                        ? String(hospital).trim()
                        : null
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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});


// ======================================================
// FORGOT PASSWORD
// Supabase emails a link that opens reset-password.html
// ======================================================

app.post("/api/forgot-password", async (req, res) => {

    try {

        const { email, redirectTo } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const { error } =
            await newAuthClient().auth.resetPasswordForEmail(
                String(email).trim().toLowerCase(),
                redirectTo ? { redirectTo: redirectTo } : undefined
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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});


// ======================================================
// SET A NEW PASSWORD
// (called by reset-password.html after the email link)
// ======================================================

app.post("/api/reset-password", async (req, res) => {

    try {

        const { access_token, password } = req.body;

        if (!access_token) {
            return res.status(401).json({
                success: false,
                message:
                    "This reset link is not valid. Please request a new one."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: PASSWORD_RULE_MESSAGE
            });
        }

        const {
            data: userData,
            error: userError
        } = await supabaseAdmin.auth.getUser(access_token);

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message:
                    "This reset link has expired. Please request a new one."
            });
        }

        const { error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(
                userData.user.id,
                { password: password }
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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});


// ======================================================
// GET PROFILE
// ======================================================

app.get("/api/profile/:id", async (req, res) => {

    try {

        const userId = req.params.id;


        const {

            data,

            error

        } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();


        if (error) {

            return res.status(404).json({

                success: false,

                message: "Profile not found."

            });

        }


        res.json({

            success: true,

            profile: data

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Server error."

        });

    }

});


// ======================================================
// START SERVER
// ======================================================

const PORT =
    process.env.PORT || 5050;


app.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("   BOOK N MEET BACKEND");
    console.log("======================================");
    console.log(
        `Server running on http://localhost:${PORT}`
    );
    console.log("======================================");
    console.log("");

});