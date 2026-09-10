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

        const passwordValid =
            /^[A-Z](?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/
                .test(password);


        if (!passwordValid) {

            return res.status(400).json({
                success: false,
                message:
                    "Password must start with a capital letter, contain a digit and a special character, and be at least 10 characters."
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
    process.env.PORT || 5000;


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