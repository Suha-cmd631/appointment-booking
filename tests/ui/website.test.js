// Selenium tests: a real Chrome window clicks through the website
// the way a patient and a hospital staff member would.

const { openBrowser, helpers } = require("../helpers/browser");
const { testEmail, createUser, futureDate, PASSWORD } = require("../helpers/common");

let driver, h;
const patientEmail = testEmail("uipatient");
const bookingDate = futureDate();
let booked = {};

beforeAll(async () => {
    driver = await openBrowser();
    h = helpers(driver);
});

afterAll(async () => {
    if (driver) await driver.quit();
});

afterEach(async () => {
    // Keep a picture of the screen after every test (test-report/screenshots)
    const name = expect.getState().currentTestName.match(/TC-UI-\d+/);
    if (driver && name) await h.screenshot(name[0]).catch(() => {});
});

describe("Login and sign up page", () => {

    test("TC-UI-01: The login page opens", async () => {
        await h.go("landing.html");
        expect(await driver.getTitle()).toMatch(/Book N Meet/i);
        expect(await (await h.visible("#loginForm")).isDisplayed()).toBe(true);
    });

    test("TC-UI-02: Empty login shows an error", async () => {
        await h.click("#loginBtn");
        await h.waitForText("#loginMsg", /enter your email and password/i);
    });

    test("TC-UI-03: Wrong password shows an error", async () => {
        await h.type("#liEmail", "nobody.bnm@gmail.com");
        await h.type("#liPassword", "Wrong@1234");
        await h.click("#loginBtn");
        await h.waitForText("#loginMsg", /invalid email or password/i);
    });

    test("TC-UI-04: Password rules turn green only when they are met", async () => {
        await h.click("#tabSignup");
        await h.type("#suPassword", "abc");
        expect(await (await h.el("#ruleCap")).getAttribute("class")).toMatch(/invalid/);
        await h.type("#suPassword", PASSWORD);
        for (const rule of ["#ruleLength", "#ruleCap", "#ruleDigit", "#ruleSpecial"]) {
            expect(await (await h.el(rule)).getAttribute("class")).toMatch(/\bvalid\b/);
        }
    });

    test("TC-UI-05: Hospital and join code fields appear only for Hospital Staff", async () => {
        expect(await (await h.el("#hospitalField")).getAttribute("class")).not.toMatch(/open/);
        await h.select("#suRole", "staff");
        expect(await (await h.el("#hospitalField")).getAttribute("class")).toMatch(/open/);
    });

    test("TC-UI-06: Staff cannot sign up without the join code (button stays off)", async () => {
        await h.type("#suName", "Ui Staff");
        await h.type("#suEmail", testEmail("uistaff"));
        await h.type("#suContact", "9876543210");
        await h.type("#suPassword", PASSWORD);
        await h.select("#suHospital", "Trinity Hospital");
        expect(await (await h.el("#signupBtn")).isEnabled()).toBe(false);
    });

    test("TC-UI-07: A patient can sign up", async () => {
        await h.go("landing.html");
        await h.click("#tabSignup");
        await h.type("#suName", "Ui Patient");
        await h.type("#suEmail", patientEmail);
        await h.type("#suContact", "9876543210");
        await h.type("#suPassword", PASSWORD);
        await h.select("#suRole", "patient");
        await h.click("#signupBtn");
        await h.waitForText("#signupMsg", /account created/i);
    });

    test("TC-UI-08: The patient can log in and reaches the home page", async () => {
        // After sign up the login form opens with the email filled in
        await driver.wait(async () => (await (await h.el("#liEmail")).getAttribute("value")) === patientEmail, 10000);
        await h.type("#liPassword", PASSWORD);
        await h.click("#loginBtn");
        await h.waitForPage("first.html");
    });
});

describe("Patient: find and book a doctor", () => {

    test("TC-UI-09: Home page shows the top hospitals", async () => {
        await driver.wait(async () => (await h.all("#topHospitals > *")).length > 0, 10000);
        expect((await h.all("#topHospitals > *")).length).toBeGreaterThan(0);
    });

    test("TC-UI-10: Searching without a speciality shows a warning", async () => {
        await h.click(".search-btn");
        expect(await h.acceptAlert()).toMatch(/select a speciality/i);
    });

    test("TC-UI-11: Searching by speciality shows matching hospitals", async () => {
        await h.select("#speciality", "Cardiology");
        await h.setValue("#date", bookingDate);
        await h.type("#age", "30");
        await h.click(".search-btn");
        await h.waitForPage("search.html");
        await driver.wait(async () => (await h.all(".result")).length > 0, 10000);
        expect(await h.text("#resultTitle")).toMatch(/Cardiology/);
    });

    test("TC-UI-12: Book Now opens the booking page with the hospital and doctor filled in", async () => {
        await h.click(".result .book-btn");
        await h.waitForPage("booking.html");
        booked.hospital = await h.text("#hospitalName");
        booked.doctor = await h.text("#doctorName");
        expect(booked.hospital.length).toBeGreaterThan(2);
        expect(booked.doctor).toMatch(/Dr\./);
    });

    test("TC-UI-13: Booking without choosing a time slot shows an error", async () => {
        await h.type("#patientName", "Ui Patient");
        await h.type("#patientPhone", "9876543210");
        await h.type("#patientEmail", patientEmail);
        await h.click("#bookingForm .book-btn");
        await h.waitForText("#bookingMessage", /select an available time slot/i);
    });

    test("TC-UI-14: The patient picks a free slot and books the appointment", async () => {
        await driver.wait(async () => (await h.all(".slot-card:not(.busy-slot):not(.booked-slot):not(.outside-slot)")).length > 0, 10000);
        const free = (await h.all(".slot-card:not(.busy-slot):not(.booked-slot):not(.outside-slot)"))[0];
        booked.slot = (await (await free.findElement({ css: ".slot-time" })).getText()).trim();
        await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", free);
        await free.click();
        await h.click("#selectSlotBtn");
        await h.waitForText("#selectedSlot", new RegExp(booked.slot));
        await h.click("#bookingForm .book-btn");
        expect(await h.acceptAlert()).toMatch(/booked successfully/i);
        await h.waitForPage("first.html");
    });

    test("TC-UI-15: The appointment shows on the profile page as Pending", async () => {
        await h.go("profile.html");
        await driver.wait(async () => (await h.all(".appointment-card")).length > 0, 10000);
        const card = await h.text(".appointment-card");
        expect(card).toContain(booked.doctor);
        expect(card).toMatch(/Pending/i);
    });

    test("TC-UI-16: The patient can cancel the appointment", async () => {
        await h.click(".cancel-appointment-btn");
        expect(await h.acceptAlert()).toMatch(/cancel your appointment/i);
        await driver.wait(async () => /Cancel+ed/i.test(await h.text(".appointment-card")), 10000);
        expect((await h.all(".cancel-appointment-btn")).length).toBe(0);
    });

    test("TC-UI-17: A patient cannot open the hospital staff pages", async () => {
        await h.go("appointments.html");
        await driver.wait(async () => (await h.page()) !== "appointments.html", 10000);
        expect(await h.page()).not.toBe("appointments.html");
    });

    test("TC-UI-18: Logout takes the patient back to the login page", async () => {
        await h.go("profile.html");
        await h.click(".nav-actions button.login");
        await h.waitForPage("landing.html");
    });
});

describe("Hospital staff", () => {

    let staff;

    beforeAll(async () => {
        staff = await createUser({ role: "staff", hospital: "Trinity Hospital", name: "Ui Staff" });
    });

    test("TC-UI-19: Staff log in and reach the hospital dashboard", async () => {
        await h.go("landing.html");
        await h.type("#liEmail", staff.email);
        await h.type("#liPassword", PASSWORD);
        await h.click("#loginBtn");
        await h.waitForPage("admin.html");
        await h.waitForText("#staffHospital", /Trinity Hospital/);
    });

    test("TC-UI-20: The Settings page shows the hospital's staff join code", async () => {
        await h.go("settings.html");
        await driver.wait(async () => /^[A-Z0-9]{4,}$/.test(await (await h.el("#joinCode")).getAttribute("value")), 10000);
    });
});
