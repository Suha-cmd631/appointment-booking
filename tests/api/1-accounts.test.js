// API tests (Jest): sign up and log in rules.

const { api, testEmail, joinCode, PASSWORD } = require("../helpers/common");

const patient = {
    name: "Test Patient",
    email: testEmail("patient"),
    contact: "9876543210",
    password: PASSWORD,
    role: "patient"
};

describe("Server", () => {

    test("TC-API-01: Server is running", async () => {
        const res = await api("GET", "/api/health");
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("Sign up", () => {

    test("TC-API-02: Patient can sign up with valid details", async () => {
        const res = await api("POST", "/api/signup", patient);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test("TC-API-03: Sign up with empty fields is refused", async () => {
        const res = await api("POST", "/api/signup", { email: testEmail("empty") });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required fields/i);
    });

    test("TC-API-04: Email that is not @gmail.com is refused", async () => {
        const res = await api("POST", "/api/signup", { ...patient, email: "someone@yahoo.com" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/gmail/i);
    });

    test("TC-API-05: Weak password is refused", async () => {
        const res = await api("POST", "/api/signup", { ...patient, email: testEmail("weak"), password: "abc123" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/8 characters/i);
    });

    test("TC-API-06: Contact number that is not 10 digits is refused", async () => {
        const res = await api("POST", "/api/signup", { ...patient, email: testEmail("phone"), contact: "12345" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/10 digits/i);
    });

    test("TC-API-07: Name with numbers is refused", async () => {
        const res = await api("POST", "/api/signup", { ...patient, email: testEmail("name"), name: "Ravi123" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/alphabets/i);
    });

    test("TC-API-08: Same email cannot sign up twice", async () => {
        const res = await api("POST", "/api/signup", patient);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test("TC-API-09: Staff sign up without a join code is refused", async () => {
        const res = await api("POST", "/api/signup", {
            ...patient, email: testEmail("staff"), role: "staff", hospital: "Trinity Hospital"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/code/i);
    });

    test("TC-API-10: Staff sign up with a wrong join code is refused", async () => {
        const res = await api("POST", "/api/signup", {
            ...patient, email: testEmail("staff"), role: "staff", hospital: "Trinity Hospital", joinCode: "WRONG1"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/code/i);
    });

    test("TC-API-11: Staff can sign up with the correct join code (small letters work too)", async () => {
        const code = await joinCode("Trinity Hospital");
        const res = await api("POST", "/api/signup", {
            ...patient, name: "Test Staff", email: testEmail("staff"), role: "staff",
            hospital: "Trinity Hospital", joinCode: code.toLowerCase()
        });
        expect(res.status).toBe(201);
    });

    test("TC-API-12: Staff sign up with a hospital that does not exist is refused", async () => {
        const res = await api("POST", "/api/signup", {
            ...patient, email: testEmail("staff"), role: "staff", hospital: "Fake Hospital", joinCode: "ABC123"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/hospital/i);
    });
});

describe("Log in", () => {

    test("TC-API-13: Log in with the correct password works", async () => {
        const res = await api("POST", "/api/login", { email: patient.email, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.session.access_token).toBeTruthy();
        expect(res.body.user.role).toBe("patient");
        expect(res.body.user.email).toBe(patient.email);
    });

    test("TC-API-14: Log in with a wrong password is refused", async () => {
        const res = await api("POST", "/api/login", { email: patient.email, password: "Wrong@1234" });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid email or password/i);
    });

    test("TC-API-15: Log in with empty fields is refused", async () => {
        const res = await api("POST", "/api/login", {});
        expect(res.status).toBe(400);
    });

    test("TC-API-16: A fake login token is refused", async () => {
        const res = await api("GET", "/api/sync", null, "fake-token");
        expect(res.status).toBe(401);
    });
});
