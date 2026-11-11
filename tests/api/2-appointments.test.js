// API tests (Jest): booking, privacy, accepting and cancelling appointments.

const {
    createUser, getData, activeDoctor, bookingFor, save, dateAfterDays
} = require("../helpers/common");

const KEY = "bookNMeetBookings";
const HOSPITAL = "Trinity Hospital";

let patientA, patientB, trinityStaff, otherStaff, doctor, booking;

beforeAll(async () => {
    patientA = await createUser({ name: "Asha Patient" });
    patientB = await createUser({ name: "Bala Patient" });
    trinityStaff = await createUser({ role: "staff", hospital: HOSPITAL, name: "Trinity Staff" });
    otherStaff = await createUser({ role: "staff", hospital: "Gowthami Hospital", name: "Gowthami Staff" });
    doctor = await activeDoctor(HOSPITAL);
});

describe("Viewing without logging in", () => {

    test("TC-API-17: Visitors can see all 5 hospitals and their doctors", async () => {
        const data = await getData();
        const names = Object.values(data.bookNMeetHospitals).map((h) => h.name);
        expect(names).toEqual(expect.arrayContaining([
            "Trinity Hospital", "Gowthami Hospital", "Neokidz ENT",
            "Lalitha Hospital", "Avideep Mother and Children Hospital"
        ]));
        expect(data.bookNMeetDoctors.length).toBeGreaterThan(0);
    });

    test("TC-API-18: Visitors cannot save anything", async () => {
        const res = await save(KEY, [bookingFor(patientA, doctor)]);
        expect(res.status).toBe(401);
    });
});

describe("Booking an appointment", () => {

    test("TC-API-19: Patient can book a free slot (status becomes Pending)", async () => {
        booking = bookingFor(patientA, doctor, { patientName: "Asha Patient" });
        const res = await save(KEY, [booking], patientA.token);
        expect(res.body.success).toBe(true);

        const mine = (await getData(patientA.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(mine.status).toBe("Pending");
        expect(mine.patientName).toBe("Asha Patient");
    });

    test("TC-API-20: Another patient cannot book the same doctor, date and time", async () => {
        const res = await save(KEY, [{ ...bookingFor(patientB, doctor), date: booking.date, slot: booking.slot }], patientB.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/just booked/i);
    });

    test("TC-API-21: Booking a date in the past is refused", async () => {
        const res = await save(KEY, [bookingFor(patientA, doctor, { date: dateAfterDays(-3) })], patientA.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/future date/i);
    });

    test("TC-API-22: Booking with a wrong phone number is refused", async () => {
        const res = await save(KEY, [bookingFor(patientA, doctor, { phone: "12ab" })], patientA.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/phone/i);
    });

    test("TC-API-23: Booking without a time slot is refused", async () => {
        const res = await save(KEY, [bookingFor(patientA, doctor, { slot: "" })], patientA.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/time slot/i);
    });

    test("TC-API-24: Hospital staff cannot book appointments", async () => {
        const res = await save(KEY, [bookingFor(trinityStaff, doctor)], trinityStaff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/only patients/i);
    });
});

describe("Privacy", () => {

    test("TC-API-25: Other patients see only that the slot is taken, not the name or phone", async () => {
        const seen = (await getData(patientB.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(seen.slot).toBe(booking.slot);
        expect(seen.patientName).toBeUndefined();
        expect(seen.phone).toBeUndefined();
        expect(seen.email).toBeUndefined();
    });

    test("TC-API-26: Staff of the same hospital see the full details", async () => {
        const seen = (await getData(trinityStaff.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(seen.patientName).toBe("Asha Patient");
        expect(seen.phone).toBe("9876543210");
    });

    test("TC-API-27: Staff of another hospital do not see the patient details", async () => {
        const seen = (await getData(otherStaff.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(seen.patientName).toBeUndefined();
    });

    test("TC-API-28: The hospital gets a 'New appointment request' notification", async () => {
        const notes = (await getData(trinityStaff.token)).bookNMeetNotifications;
        expect(notes.some((n) => /New appointment request/.test(n.title) && n.message.includes("Asha Patient"))).toBe(true);
    });
});

describe("Changing an appointment", () => {

    test("TC-API-29: Staff of another hospital cannot accept it", async () => {
        const res = await save(KEY, [{ id: booking.id, status: "Upcoming" }], otherStaff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/own hospital/i);
    });

    test("TC-API-30: Another patient cannot cancel it", async () => {
        const res = await save(KEY, [{ id: booking.id, status: "Canceled" }], patientB.token);
        expect(res.body.success).toBe(false);
    });

    test("TC-API-31: Staff of the same hospital can accept it (status becomes Upcoming)", async () => {
        const res = await save(KEY, [{ id: booking.id, status: "Upcoming" }], trinityStaff.token);
        expect(res.body.success).toBe(true);
        const mine = (await getData(patientA.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(mine.status).toBe("Upcoming");
    });

    test("TC-API-32: The patient can cancel their own appointment", async () => {
        const res = await save(KEY, [{ id: booking.id, status: "Canceled" }], patientA.token);
        expect(res.body.success).toBe(true);
        const mine = (await getData(patientA.token)).bookNMeetBookings.find((b) => b.id === booking.id);
        expect(mine.status).toBe("Canceled");
    });

    test("TC-API-33: The hospital is told about the cancellation", async () => {
        const notes = (await getData(trinityStaff.token)).bookNMeetNotifications;
        expect(notes.some((n) => /cancelled by patient/i.test(n.title) && n.message.includes("Asha Patient"))).toBe(true);
    });

    test("TC-API-34: After cancelling, the slot is free and can be booked again", async () => {
        const again = { ...bookingFor(patientB, doctor), date: booking.date, slot: booking.slot };
        const res = await save(KEY, [again], patientB.token);
        expect(res.body.success).toBe(true);
    });

    test("TC-API-35: Staff cannot set an unknown status", async () => {
        const res = await save(KEY, [{ id: booking.id, status: "Hacked" }], trinityStaff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/unknown appointment status/i);
    });
});
