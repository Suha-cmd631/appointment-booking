// API tests (Jest): appointment tokens, confirmation emails and doctor reviews.

const fs = require("fs");
const path = require("path");
const { createUser, getData, activeDoctor, bookingFor, save, api, ROOT } = require("../helpers/common");

const KEY = "bookNMeetBookings";
const HOSPITAL = "Trinity Hospital";
const EMAIL_LOG = path.join(ROOT, "test-report", "emails.log");

let patient, otherPatient, staff, doctor, first, second;

async function myBooking(user, id) {
    return (await getData(user.token)).bookNMeetBookings.find((b) => b.id === id);
}

beforeAll(async () => {
    patient = await createUser({ name: "Kavya Patient" });
    otherPatient = await createUser({ name: "Other Patient" });
    staff = await createUser({ role: "staff", hospital: HOSPITAL, name: "Trinity Staff" });
    doctor = await activeDoctor(HOSPITAL);
    first = bookingFor(patient, doctor, { patientName: "Kavya Patient", slot: "09:00 AM" });
    second = bookingFor(patient, doctor, { patientName: "Kavya Patient", date: first.date, slot: "09:30 AM" });
    await save(KEY, [first], patient.token);
    await save(KEY, [second], patient.token);
});

describe("Appointment token", () => {

    test("TC-API-49: Every booking gets a token like TRI-MMDD-01", async () => {
        const b = await myBooking(patient, first.id);
        const mmdd = first.date.slice(5, 7) + first.date.slice(8, 10);
        expect(b.token).toMatch(new RegExp("^TRI-" + mmdd + "-\\d{2,}$"));
    });

    test("TC-API-50: Two bookings never get the same token", async () => {
        const a = await myBooking(patient, first.id);
        const b = await myBooking(patient, second.id);
        expect(a.token).not.toBe(b.token);
    });

    test("TC-API-51: Other patients cannot see someone else's token", async () => {
        const seen = (await getData(otherPatient.token)).bookNMeetBookings.find((b) => b.id === first.id);
        expect(seen.token).toBeUndefined();
    });

    test("TC-API-52: The token's QR code picture is available", async () => {
        const token = (await myBooking(patient, first.id)).token;
        const res = await fetch(require("../helpers/common").API + "/api/qr/" + token);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toMatch(/image\/png/);
    });

    test("TC-API-53: A confirmation email with the token is sent on booking (when the tests start the server)", async () => {
        if (!fs.existsSync(EMAIL_LOG)) return; // server was already running: emails not recorded
        const token = (await myBooking(patient, first.id)).token;
        const log = fs.readFileSync(EMAIL_LOG, "utf8");
        expect(log).toContain("Appointment request received - Token " + token);
        expect(log).toContain(patient.email);
    });
});

describe("Doctor reviews", () => {

    test("TC-API-54: A patient cannot review before the visit is completed", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 5 }, patient.token);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/after your visit is completed/i);
    });

    test("TC-API-55: Staff accept and complete the visit", async () => {
        expect((await save(KEY, [{ id: first.id, status: "Upcoming" }], staff.token)).body.success).toBe(true);
        expect((await save(KEY, [{ id: first.id, status: "Completed" }], staff.token)).body.success).toBe(true);
        expect((await myBooking(patient, first.id)).status).toBe("Completed");
    });

    test("TC-API-56: A rating outside 1 to 5 is refused", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 6 }, patient.token);
        expect(res.status).toBe(400);
    });

    test("TC-API-57: Another patient cannot review this appointment", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 1 }, otherPatient.token);
        expect(res.status).toBe(403);
    });

    test("TC-API-58: Staff cannot write reviews", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 5 }, staff.token);
        expect(res.status).toBe(403);
    });

    test("TC-API-59: The patient can review the doctor after the visit", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 4, comment: "Very patient and kind." }, patient.token);
        expect(res.body.success).toBe(true);
    });

    test("TC-API-60: Everyone sees the review with only the patient's first name", async () => {
        const review = (await getData()).bookNMeetReviews.find((r) => r.doctorId === doctor.id && r.comment === "Very patient and kind.");
        expect(review.rating).toBe(4);
        expect(review.patientName).toBe("Kavya P.");
        expect(review.bookingId).toBeUndefined();
    });

    test("TC-API-61: The doctor's rating now comes from patient reviews", async () => {
        const d = (await getData()).bookNMeetDoctors.find((x) => x.id === doctor.id);
        expect(d.reviewCount).toBeGreaterThanOrEqual(1);
        expect(d.rating).toMatch(/\d\.\d \(\d+ reviews?\)/);
    });

    test("TC-API-62: Sending again updates the same review (one review per visit)", async () => {
        const res = await api("POST", "/api/reviews", { bookingId: first.id, rating: 5, comment: "Excellent." }, patient.token);
        expect(res.body.message).toMatch(/updated/i);
        const mine = (await getData(patient.token)).bookNMeetReviews.filter((r) => r.mine && r.bookingId === first.id);
        expect(mine.length).toBe(1);
        expect(mine[0].rating).toBe(5);
    });

    test("TC-API-63: The hospital is told about the new review", async () => {
        const notes = (await getData(staff.token)).bookNMeetNotifications;
        expect(notes.some((n) => /New review for/.test(n.title) && n.message.includes("Kavya Patient"))).toBe(true);
    });
});
