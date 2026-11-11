// API tests (Jest): hospital staff - doctors, schedules, settings, join codes.

const { createUser, getData, save, api, testId, futureDate } = require("../helpers/common");

const HOSPITAL = "Trinity Hospital";
let staff, otherStaff, patient;
const doctorId = testId("doctor");

beforeAll(async () => {
    staff = await createUser({ role: "staff", hospital: HOSPITAL, name: "Trinity Staff" });
    otherStaff = await createUser({ role: "staff", hospital: "Gowthami Hospital", name: "Gowthami Staff" });
    patient = await createUser({ name: "Test Patient" });
});

describe("Doctors", () => {

    test("TC-API-36: A patient cannot add a doctor", async () => {
        const res = await save("bookNMeetDoctors", [{ id: testId("doctor"), name: "Dr. Fake", speciality: "ENT" }], patient.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/only hospital staff/i);
    });

    test("TC-API-37: Adding a doctor without a speciality is refused", async () => {
        const res = await save("bookNMeetDoctors", [{ id: testId("doctor"), name: "Dr. Test" }], staff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/speciality/i);
    });

    test("TC-API-38: Staff can add a doctor to their hospital", async () => {
        const res = await save("bookNMeetDoctors", [{
            id: doctorId, name: "Dr. Test Kumar", speciality: "Cardiology",
            experience: "5 years", qualification: "MBBS, MD"
        }], staff.token);
        expect(res.body.success).toBe(true);

        const added = (await getData()).bookNMeetDoctors.find((d) => d.id === doctorId);
        expect(added.name).toBe("Dr. Test Kumar");
        expect(added.hospital).toBe(HOSPITAL);
    });

    test("TC-API-39: Staff of another hospital cannot change that doctor", async () => {
        const res = await save("bookNMeetDoctors", [{ id: doctorId, name: "Dr. Changed", speciality: "ENT" }], otherStaff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/own hospital/i);
    });

    test("TC-API-40: Staff can mark the doctor busy for a time (schedule)", async () => {
        const res = await save("bookNMeetDoctorSchedules", [{
            id: testId("schedule"), doctorId, date: futureDate(),
            workingFrom: "09:00", workingTo: "17:00", status: "Busy", busyFrom: "11:00", busyTo: "12:00"
        }], staff.token);
        expect(res.body.success).toBe(true);
    });

    test("TC-API-41: A schedule whose end time is before its start time is refused", async () => {
        const res = await save("bookNMeetDoctorSchedules", [{
            id: testId("schedule"), doctorId, date: futureDate(),
            workingFrom: "17:00", workingTo: "09:00"
        }], staff.token);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/end time/i);
    });

    test("TC-API-42: Staff of another hospital cannot remove the doctor", async () => {
        const res = await save("bookNMeetRemovedDoctors", [doctorId], otherStaff.token);
        expect(res.body.success).toBe(false);
    });

    test("TC-API-43: Staff can remove the doctor", async () => {
        const res = await save("bookNMeetRemovedDoctors", [doctorId], staff.token);
        expect(res.body.success).toBe(true);
        const data = await getData();
        expect(data.bookNMeetRemovedDoctors).toContain(doctorId);
    });
});

describe("Hospital settings and join codes", () => {

    test("TC-API-44: A patient cannot change hospital details", async () => {
        const res = await api("PUT", "/api/staff/hospital", { appointmentDuration: 30, workingStart: "09:00", workingEnd: "17:00" }, patient.token);
        expect(res.status).toBe(403);
    });

    test("TC-API-45: An appointment length other than 15/30/45/60 minutes is refused", async () => {
        const res = await api("PUT", "/api/staff/hospital", { appointmentDuration: 20, workingStart: "09:00", workingEnd: "17:00" }, staff.token);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/15, 30, 45 or 60/);
    });

    test("TC-API-46: Working hours that end before they start are refused", async () => {
        const res = await api("PUT", "/api/staff/hospital", { appointmentDuration: 30, workingStart: "18:00", workingEnd: "09:00" }, staff.token);
        expect(res.status).toBe(400);
    });

    test("TC-API-47: Staff see their own hospital's join code", async () => {
        const hospitals = (await getData(staff.token)).bookNMeetHospitals;
        const mine = Object.values(hospitals).find((h) => h.name === HOSPITAL);
        expect(mine.joinCode).toMatch(/^[A-Z0-9]{4,}$/);
    });

    test("TC-API-48: Patients and other hospitals never see that join code", async () => {
        const forPatient = Object.values((await getData(patient.token)).bookNMeetHospitals);
        expect(forPatient.every((h) => !h.joinCode)).toBe(true);

        const forOther = Object.values((await getData(otherStaff.token)).bookNMeetHospitals)
            .find((h) => h.name === HOSPITAL);
        expect(forOther.joinCode).toBeUndefined();
    });
});
