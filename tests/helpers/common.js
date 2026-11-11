// Shared helpers for all BOOK N MEET tests.
// The tests talk to the real server (npm run dev) and the real
// Supabase database from backend/.env. Every test account, booking
// and doctor they create is deleted again at the end.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const API = process.env.API_URL || "http://localhost:5050";
const SITE = process.env.SITE_URL || "http://localhost:5501";
const PASSWORD = "Test@1234";

// Every test email starts with this, so they are easy to clean up
const EMAIL_PREFIX = "bnmtest.";
const RUN = Date.now().toString(36);
let counter = 0;

function testEmail(label) {
    counter += 1;
    return `${EMAIL_PREFIX}${label}.${RUN}${counter}@gmail.com`;
}

function testId(label) {
    counter += 1;
    return `test_${label}_${RUN}${counter}`;
}

// A date far in the future (yyyy-mm-dd), so tests never clash with real bookings
function futureDate(extraDays = 0) {
    const d = new Date(Date.now() + (200 + extraDays + Math.floor(Math.random() * 100)) * 86400000);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function dateAfterDays(n) {
    const d = new Date(Date.now() + n * 86400000);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Call the server. Returns { status, body }.
async function api(method, urlPath, body, token) {
    const response = await fetch(API + urlPath, {
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await response.json(); } catch (e) { json = null; }
    return { status: response.status, body: json };
}

// Read backend/.env (keys stay on this computer)
function readEnv() {
    const file = path.join(ROOT, "backend", ".env");
    const env = {};
    if (!fs.existsSync(file)) return env;
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
    return env;
}

// Direct database access, only for reading join codes and cleaning up
let adminClient = null;
function admin() {
    if (adminClient) return adminClient;
    const env = { ...readEnv(), ...process.env };
    const { createClient } = require(path.join(ROOT, "backend", "node_modules", "@supabase", "supabase-js"));
    const url = String(env.SUPABASE_URL || "").replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
    adminClient = createClient(url, env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    return adminClient;
}

async function joinCode(hospitalName) {
    const { data, error } = await admin().from("hospitals").select("join_code").eq("name", hospitalName).single();
    if (error) throw error;
    return data.join_code;
}

// Make an account and log in. Returns { email, token, user }.
async function createUser({ role = "patient", hospital, name = "Test Patient" } = {}) {
    const email = testEmail(role);
    const body = { name, email, contact: "9876543210", password: PASSWORD, role };
    if (role === "staff") {
        body.hospital = hospital;
        body.joinCode = await joinCode(hospital);
    }
    const signup = await api("POST", "/api/signup", body);
    if (signup.status !== 201) throw new Error("Signup failed: " + JSON.stringify(signup.body));
    const login = await api("POST", "/api/login", { email, password: PASSWORD });
    if (login.status !== 200) throw new Error("Login failed: " + JSON.stringify(login.body));
    return { email, token: login.body.session.access_token, user: login.body.user, login: login.body };
}

// Everything the website can see (hospitals, doctors, bookings ...)
async function getData(token) {
    const res = await api("GET", "/api/sync", null, token);
    return res.body.data;
}

async function activeDoctor(hospitalName) {
    const data = await getData();
    const doctor = data.bookNMeetDoctors.find((d) => d.hospital === hospitalName && !d.removed);
    if (!doctor) throw new Error("No doctor found at " + hospitalName);
    return doctor;
}

function bookingFor(patient, doctor, overrides = {}) {
    return {
        id: testId("booking"),
        patientName: "Test Patient",
        phone: "9876543210",
        email: patient.email,
        hospital: doctor.hospital,
        doctor: doctor.name,
        doctorId: doctor.id,
        speciality: doctor.speciality,
        age: "30",
        date: futureDate(),
        slot: "10:30 AM",
        ...overrides
    };
}

function save(key, upserts, token, deletes) {
    return api("POST", "/api/sync", { key, upserts, deletes }, token);
}

module.exports = {
    ROOT, API, SITE, PASSWORD, EMAIL_PREFIX,
    testEmail, testId, futureDate, dateAfterDays,
    api, admin, joinCode, createUser, getData, activeDoctor, bookingFor, save
};
