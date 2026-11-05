// ======================================================
// BOOK N MEET - DATA (hospitals, doctors, schedules,
// appointments, notifications)
//
// How the website uses this:
//
//   GET  /api/sync   -> everything the logged-in person is allowed
//                       to see, in the same shape the pages already
//                       use. The website keeps a copy in the browser
//                       and asks again every few seconds.
//
//   POST /api/sync   -> a change made on a page (new appointment,
//                       status changed, doctor added...). Every
//                       change is checked here before it is saved:
//                       patients can only book and see their own
//                       appointments, staff can only change their
//                       own hospital.
//
//   PUT  /api/staff/hospital -> staff edit their hospital's details
//                               (admin Settings page).
// ======================================================

module.exports = function (app, { supabaseAdmin, cleanText, publicUser, serverError }) {

    // --------------------------------------------------
    // Allowed values
    // --------------------------------------------------

    const BOOKING_STATUSES = ["Pending", "Upcoming", "Completed", "Missed", "Canceled", "Cancelled"];
    const ACTIVE_STATUSES = ["Pending", "Upcoming"];
    const SLOT_LENGTHS = [15, 30, 45, 60];

    const KEYS = {
        hospitals: "bookNMeetHospitals",
        settings: "bookNMeetHospitalSettings",
        doctors: "bookNMeetDoctors",
        removedDoctors: "bookNMeetRemovedDoctors",
        schedules: "bookNMeetDoctorSchedules",
        bookings: "bookNMeetBookings",
        staffNotifications: "bookNMeetNotifications",
        patientNotifications: "bookNMeetPatientNotifications",
        readNotifications: "bookNMeetReadNotifications",
        currentUser: "bookNMeetCurrentUser"
    };


    // --------------------------------------------------
    // Small helpers
    // --------------------------------------------------

    class Refused extends Error {}

    function refuse(message) {
        throw new Refused(message);
    }

    function norm(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/goutami/g, "gowthami");
    }

    function cleanId(value) {
        const id = String(value == null ? "" : value).trim();
        if (!id || id.length > 80 || !/^[A-Za-z0-9_.:-]+$/.test(id)) {
            refuse("Invalid record id.");
        }
        return id;
    }

    function isTime(value) {
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
    }

    function isSlot(value) {
        return /^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(String(value || ""));
    }

    function isDate(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
            !isNaN(new Date(value + "T00:00:00").getTime());
    }

    function localDate(offsetDays) {
        const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    function textArray(value, maxItems) {
        if (!Array.isArray(value)) return [];
        return value
            .map((item) => cleanText(item, 120))
            .filter(Boolean)
            .slice(0, maxItems || 50);
    }

    async function run(query) {
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    function now() {
        return new Date().toISOString();
    }


    // --------------------------------------------------
    // Who is asking?
    // The website sends the log-in token in the
    // "Authorization" header. Answers are remembered for
    // 30 seconds so the regular refresh stays fast.
    // --------------------------------------------------

    const userCache = new Map();

    async function getRequestUser(req) {

        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";

        if (!token) return null;

        const cached = userCache.get(token);
        if (cached && cached.until > Date.now()) return cached.profile;

        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data.user) return false;      // token expired / invalid

        const profile = await run(
            supabaseAdmin.from("profiles").select("*").eq("id", data.user.id).maybeSingle()
        );

        if (!profile) return false;

        userCache.set(token, { profile, until: Date.now() + 30000 });

        if (userCache.size > 500) {
            userCache.delete(userCache.keys().next().value);
        }

        return profile;
    }

    function forgetUser(profileId) {
        for (const [token, entry] of userCache) {
            if (entry.profile.id === profileId) userCache.delete(token);
        }
    }


    // --------------------------------------------------
    // Hospitals (cached for 10 seconds; they rarely change)
    // --------------------------------------------------

    let hospitalCache = null;

    async function getHospitals() {
        if (hospitalCache && hospitalCache.until > Date.now()) return hospitalCache.rows;
        const rows = await run(supabaseAdmin.from("hospitals").select("*").order("name"));
        hospitalCache = { rows, until: Date.now() + 10000 };
        return rows;
    }

    async function hospitalByName(name) {
        const wanted = norm(name);
        return (await getHospitals()).find((h) => norm(h.name) === wanted) || null;
    }

    async function staffHospital(user) {
        if (!user || user.role !== "staff") return null;
        return hospitalByName(user.hospital);
    }


    // --------------------------------------------------
    // Database rows  ->  the shapes the pages use
    // --------------------------------------------------

    function hospitalOut(h) {
        return {
            id: h.id,
            name: h.name,
            location: h.location || "",
            rating: h.rating || "",
            description: h.description || "",
            image: h.image || "",
            about: h.about || "",
            founded: h.founded || "",
            beds: h.beds || "",
            address: h.address || "",
            phone: h.phone || "",
            email: h.email || "",
            website: h.website || "",
            timings: h.timings || "",
            emergency: h.emergency || "",
            facilities: h.facilities || [],
            specialities: h.specialities || [],
            reviews: h.reviews || [],
            appointmentDuration: h.appointment_duration,
            workingStart: h.working_start,
            workingEnd: h.working_end,
            doctors: []
        };
    }

    function settingsOut(h) {
        return {
            hospitalName: h.name,
            hospitalAddress: h.address || "",
            email: h.email || "",
            contactNumber: h.phone || "",
            appointmentDuration: h.appointment_duration,
            workingStart: h.working_start,
            workingEnd: h.working_end,
            updatedAt: h.updated_at
        };
    }

    function doctorOut(d, hospitalName, showContact) {
        return {
            ...(d.extra || {}),
            id: d.id,
            name: d.name,
            speciality: d.speciality,
            specialityKey: d.speciality_key || d.speciality,
            experience: d.experience || "",
            qualification: d.qualification || "",
            study: d.qualification || "",
            languages: d.languages || "",
            about: d.about || "",
            description: d.about || "",
            phone: showContact ? (d.phone || "") : "",
            email: showContact ? (d.email || "") : "",
            rating: d.rating || "",
            review: d.review || "",
            image: d.image || "",
            hospital: hospitalName,
            hospitalName: hospitalName,
            status: d.removed ? "Removed" : (d.status || "Available"),
            available: d.available,
            removed: d.removed,
            removedAt: d.removed_at,
            createdAt: d.created_at,
            _v: d.updated_at
        };
    }

    function scheduleOut(s, hospitalName) {
        return {
            key: s.schedule_key || (s.doctor_id + "__" + s.date),
            id: s.id,
            doctorId: s.doctor_id,
            doctorName: s.doctor_name || "",
            speciality: s.speciality || "",
            hospital: hospitalName,
            date: s.date,
            workingFrom: s.working_from,
            workingTo: s.working_to,
            status: s.status,
            busyFrom: s.busy_from || "",
            busyTo: s.busy_to || "",
            availableAgainFrom: s.available_again_from || "",
            updatedAt: s.updated_at,
            _v: s.updated_at
        };
    }

    // Other people's appointments: only what is needed to
    // grey out taken time slots - no names or phone numbers.
    function bookingSlotOnly(b, hospitalName) {
        return {
            id: b.id,
            hospital: hospitalName,
            doctor: b.doctor_name,
            doctorId: b.doctor_id,
            date: b.date,
            slot: b.slot,
            status: b.status,
            _v: b.updated_at
        };
    }

    function bookingOut(b, hospitalName) {
        return {
            id: b.id,
            patientName: b.patient_name,
            phone: b.phone,
            email: b.email,
            bookedByEmail: b.booked_by_email || "",
            bookedByName: b.booked_by_name || "",
            hospital: hospitalName,
            doctor: b.doctor_name,
            doctorId: b.doctor_id,
            speciality: b.speciality || "",
            date: b.date,
            age: b.age || "",
            slot: b.slot,
            status: b.status,
            doctorUnavailable: b.doctor_unavailable,
            scheduleConflictNotified: b.schedule_conflict_notified,
            bookedAt: b.booked_at || b.created_at,
            _v: b.updated_at
        };
    }

    function staffNotificationOut(n, hospitalName) {
        return {
            id: n.id,
            type: n.type || "system",
            title: n.title,
            message: n.message || "",
            hospital: hospitalName,
            timestamp: n.created_at,
            read: n.read
        };
    }

    function patientNotificationOut(n, hospitalName) {
        return {
            id: n.id,
            patientEmail: n.patient_email,
            patientName: n.patient_name || "",
            type: n.type || "notice",
            title: n.title,
            message: n.message || "",
            hospital: hospitalName || "",
            doctor: n.doctor || "",
            date: n.date || "",
            bookedSlot: n.booked_slot || "",
            availableAgain: n.available_again || "",
            timestamp: n.created_at,
            read: n.read
        };
    }


    // ==================================================
    // GET /api/sync
    // ==================================================

    app.get("/api/sync", async (req, res) => {

        try {

            const user = await getRequestUser(req);

            if (user === false) {
                return res.status(401).json({
                    success: false,
                    code: "session_expired",
                    message: "Please log in again."
                });
            }

            const hospitals = await getHospitals();
            const nameOf = {};
            hospitals.forEach((h) => { nameOf[h.id] = h.name; });

            const myHospital = await staffHospital(user);
            const isPatient = user && user.role === "patient";

            const [doctors, schedules, activeBookings] = await Promise.all([
                run(supabaseAdmin.from("doctors").select("*").order("created_at")),
                run(supabaseAdmin.from("doctor_schedules").select("*").gte("date", localDate(-30))),
                run(supabaseAdmin
                    .from("bookings")
                    .select("id, hospital_id, doctor_id, doctor_name, date, slot, status, updated_at")
                    .in("status", ACTIVE_STATUSES)
                    .gte("date", localDate(-1)))
            ]);

            // Appointments: slot information for everyone, full
            // details only for the patient who booked them or the
            // hospital they were booked at.
            const bookingsById = new Map();

            activeBookings.forEach((b) => {
                bookingsById.set(b.id, bookingSlotOnly(b, nameOf[b.hospital_id]));
            });

            let fullBookings = [];

            if (isPatient) {
                fullBookings = await run(supabaseAdmin
                    .from("bookings").select("*").eq("patient_user_id", user.id));
            }
            else if (myHospital) {
                fullBookings = await run(supabaseAdmin
                    .from("bookings").select("*").eq("hospital_id", myHospital.id));
            }

            fullBookings.forEach((b) => {
                bookingsById.set(b.id, bookingOut(b, nameOf[b.hospital_id]));
            });

            const bookings = Array.from(bookingsById.values())
                .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

            // Notifications
            let staffNotifications = [];
            let patientNotifications = [];
            let readNotifications = [];

            if (myHospital) {

                staffNotifications = (await run(supabaseAdmin
                    .from("staff_notifications").select("*")
                    .eq("hospital_id", myHospital.id)
                    .order("created_at", { ascending: false })
                    .limit(300)))
                    .reverse()
                    .map((n) => staffNotificationOut(n, myHospital.name));

                patientNotifications = (await run(supabaseAdmin
                    .from("patient_notifications").select("*")
                    .eq("hospital_id", myHospital.id)
                    .order("created_at")
                    .limit(300)))
                    .map((n) => patientNotificationOut(n, myHospital.name));
            }

            if (isPatient) {

                const emails = new Set([String(user.email).toLowerCase()]);
                fullBookings.forEach((b) => b.email && emails.add(String(b.email).toLowerCase()));

                patientNotifications = (await run(supabaseAdmin
                    .from("patient_notifications").select("*")
                    .in("patient_email", Array.from(emails))
                    .order("created_at")
                    .limit(500)))
                    .map((n) => patientNotificationOut(n, nameOf[n.hospital_id]));

                readNotifications = user.read_notifications || [];
            }

            // Hospital settings, in the old page shape
            const settings = { hospitalSettings: {} };
            hospitals.forEach((h) => { settings.hospitalSettings[norm(h.name)] = settingsOut(h); });

            const hospitalsOut = {};
            hospitals.forEach((h) => {
                hospitalsOut[h.id] = hospitalOut(h);
                // Only that hospital's own staff see its join code
                if (myHospital && myHospital.id === h.id) {
                    hospitalsOut[h.id].joinCode = h.join_code || "";
                }
            });

            res.json({
                success: true,
                data: {
                    [KEYS.hospitals]: hospitalsOut,
                    [KEYS.settings]: settings,
                    [KEYS.doctors]: doctors.map((d) =>
                        doctorOut(d, nameOf[d.hospital_id], myHospital && myHospital.id === d.hospital_id)),
                    [KEYS.removedDoctors]: doctors.filter((d) => d.removed).map((d) => d.id),
                    [KEYS.schedules]: schedules.map((s) => scheduleOut(s, nameOf[s.hospital_id])),
                    [KEYS.bookings]: bookings,
                    [KEYS.staffNotifications]: staffNotifications,
                    [KEYS.patientNotifications]: patientNotifications,
                    [KEYS.readNotifications]: readNotifications,
                    [KEYS.currentUser]: user ? publicUser(user) : null
                }
            });
        }

        catch (error) {
            serverError(res, error);
        }
    });


    // ==================================================
    // POST /api/sync - save changes made on a page
    // ==================================================

    const handlers = {};

    app.post("/api/sync", async (req, res) => {

        try {

            const user = await getRequestUser(req);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    code: "session_expired",
                    message: "Please log in again to save changes."
                });
            }

            const key = req.body.key;
            const handler = handlers[key];

            if (!handler) {
                return res.status(400).json({
                    success: false,
                    message: "This kind of change cannot be saved."
                });
            }

            const upserts = Array.isArray(req.body.upserts) ? req.body.upserts.slice(0, 500) : [];
            const deletes = Array.isArray(req.body.deletes) ? req.body.deletes.slice(0, 500) : [];

            const errors = [];

            for (const item of upserts) {
                try {
                    await handler.upsert(user, item || {});
                }
                catch (error) {
                    if (!(error instanceof Refused)) console.error(error);
                    errors.push(error instanceof Refused
                        ? error.message
                        : "Could not save the change. Please try again.");
                }
            }

            for (const id of deletes) {
                try {
                    if (handler.remove) await handler.remove(user, id);
                }
                catch (error) {
                    if (!(error instanceof Refused)) console.error(error);
                    errors.push(error instanceof Refused
                        ? error.message
                        : "Could not delete. Please try again.");
                }
            }

            if (handler.afterAll) await handler.afterAll(user, upserts);

            res.json({
                success: errors.length === 0,
                message: errors[0] || "Saved.",
                errors
            });
        }

        catch (error) {
            serverError(res, error);
        }
    });


    // --------------------------------------------------
    // Appointments
    // --------------------------------------------------

    handlers[KEYS.bookings] = {

        async upsert(user, item) {

            const id = cleanId(item.id);

            const existing = await run(
                supabaseAdmin.from("bookings").select("*").eq("id", id).maybeSingle()
            );

            // ---- a new appointment ----
            if (!existing) {

                if (user.role !== "patient") {
                    refuse("Only patients can book appointments.");
                }

                const hospital = await hospitalByName(item.hospital);
                if (!hospital) refuse("Please choose a hospital again.");

                const doctors = await run(supabaseAdmin
                    .from("doctors").select("*")
                    .eq("hospital_id", hospital.id)
                    .eq("removed", false));

                const doctor = doctors.find((d) =>
                    (item.doctorId && d.id === item.doctorId) || norm(d.name) === norm(item.doctor));

                if (!doctor) refuse("This doctor is no longer available. Please choose another doctor.");

                const patientName = cleanText(item.patientName, 80);
                const phone = cleanText(item.phone, 20);
                const email = cleanText(item.email, 120).toLowerCase();

                if (!patientName) refuse("Please enter the patient name.");
                if (!/^\d{10}$/.test(phone)) refuse("Please enter a valid 10-digit phone number.");
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) refuse("Please enter a valid email.");
                if (!isDate(item.date) || item.date < localDate(0)) refuse("Please choose today or a future date.");
                if (!isSlot(item.slot)) refuse("Please select a time slot.");

                const { error } = await supabaseAdmin.from("bookings").insert({
                    id,
                    hospital_id: hospital.id,
                    doctor_id: doctor.id,
                    doctor_name: doctor.name,
                    patient_user_id: user.id,
                    booked_by_email: user.email,
                    booked_by_name: user.name,
                    patient_name: patientName,
                    phone,
                    email,
                    age: cleanText(item.age, 3),
                    speciality: cleanText(item.speciality, 80),
                    date: item.date,
                    slot: item.slot,
                    status: "Pending",
                    booked_at: cleanText(item.bookedAt, 40) || null
                });

                if (error) {
                    if (error.code === "23505") {
                        refuse("Sorry, this time slot was just booked by someone else. Please choose another slot.");
                    }
                    throw error;
                }

                // Tell the hospital
                await supabaseAdmin.from("staff_notifications").insert({
                    id: "booking-" + id,
                    hospital_id: hospital.id,
                    type: "appointment",
                    title: "New appointment request",
                    message: patientName + " requested an appointment with " + doctor.name +
                        " on " + item.date + " at " + item.slot + "."
                });

                return;
            }

            // ---- a change to an existing appointment ----
            const myHospital = await staffHospital(user);
            const changes = {};

            if (myHospital && existing.hospital_id === myHospital.id) {

                if (item.status !== undefined && item.status !== existing.status) {
                    if (!BOOKING_STATUSES.includes(item.status)) refuse("Unknown appointment status.");
                    changes.status = item.status;
                }

                if (typeof item.doctorUnavailable === "boolean" &&
                    item.doctorUnavailable !== existing.doctor_unavailable) {
                    changes.doctor_unavailable = item.doctorUnavailable;
                }

                if (typeof item.scheduleConflictNotified === "boolean" &&
                    item.scheduleConflictNotified !== existing.schedule_conflict_notified) {
                    changes.schedule_conflict_notified = item.scheduleConflictNotified;
                }
            }
            else if (user.role === "patient" && existing.patient_user_id === user.id) {

                // Patients may only cancel their own appointment that has
                // not happened yet. (Other differences, like an updated
                // email, are handled by the profile update and ignored here.)
                if (["Canceled", "Cancelled"].includes(item.status) &&
                    existing.status !== "Canceled" && existing.status !== "Cancelled") {

                    if (!ACTIVE_STATUSES.includes(existing.status) || existing.date < localDate(0)) {
                        refuse("This appointment can no longer be cancelled.");
                    }

                    changes.status = "Canceled";

                    // Tell the hospital
                    await supabaseAdmin.from("staff_notifications").insert({
                        id: "cancel-" + id + "-" + Date.now(),
                        hospital_id: existing.hospital_id,
                        type: "cancelled",
                        title: "Appointment cancelled by patient",
                        message: existing.patient_name + " cancelled the appointment with " +
                            existing.doctor_name + " on " + existing.date + " at " + existing.slot + "."
                    });
                }
            }
            else {
                refuse("You can only change appointments of your own hospital.");
            }

            if (Object.keys(changes).length === 0) return;

            changes.updated_at = now();

            const { error } = await supabaseAdmin.from("bookings").update(changes).eq("id", id);

            if (error) {
                if (error.code === "23505") {
                    refuse("Another appointment already uses this time slot.");
                }
                throw error;
            }
        }
    };


    // --------------------------------------------------
    // Doctors (staff of that hospital only)
    // --------------------------------------------------

    const DOCTOR_EXTRA_FIELDS = [
        "availabilityDate", "busyFrom", "busyTo", "availableAgainFrom",
        "workingFrom", "workingTo", "scheduleUpdatedAt"
    ];

    async function requireStaffHospital(user) {
        const hospital = await staffHospital(user);
        if (!hospital) refuse("Only hospital staff can make this change.");
        return hospital;
    }

    handlers[KEYS.doctors] = {

        async upsert(user, item) {

            const hospital = await requireStaffHospital(user);
            const id = cleanId(item.id);

            const existing = await run(
                supabaseAdmin.from("doctors").select("*").eq("id", id).maybeSingle()
            );

            if (existing && existing.hospital_id !== hospital.id) {
                refuse("You can only change doctors of your own hospital.");
            }

            const name = cleanText(item.name || item.doctorName, 80);
            const speciality = cleanText(item.speciality || item.specialty, 80);

            if (!name) refuse("Please enter the doctor's name.");
            if (!speciality) refuse("Please choose the doctor's speciality.");

            const extra = { ...((existing && existing.extra) || {}) };
            DOCTOR_EXTRA_FIELDS.forEach((field) => {
                if (item[field] !== undefined) extra[field] = cleanText(item[field], 40);
            });

            const removed =
                item.removed === true || item.status === "Removed" || item.status === "Deleted";

            const row = {
                name,
                speciality,
                speciality_key: cleanText(item.specialityKey || speciality, 80),
                experience: cleanText(item.experience, 80),
                qualification: cleanText(item.qualification || item.study, 120),
                languages: cleanText(item.languages, 120),
                about: cleanText(item.about || item.description, 1000),
                phone: cleanText(item.phone, 20),
                email: cleanText(item.email, 120),
                image: cleanText(item.image, 500) || null,
                status: removed ? "Removed" : (cleanText(item.status, 20) || "Available"),
                available: item.available !== false,
                removed: removed || (existing ? existing.removed : false),
                extra,
                updated_at: now()
            };

            if (row.removed && !(existing && existing.removed)) row.removed_at = now();

            if (existing) {
                await run(supabaseAdmin.from("doctors").update(row).eq("id", id));
            }
            else {
                await run(supabaseAdmin.from("doctors").insert({
                    ...row,
                    id,
                    hospital_id: hospital.id
                }));
            }
        }
    };

    handlers[KEYS.removedDoctors] = {

        // The list of removed doctor ids: a new id means "remove this doctor".
        async upsert(user, id) {

            const hospital = await requireStaffHospital(user);
            const doctorId = cleanId(id);

            const doctor = await run(
                supabaseAdmin.from("doctors").select("*").eq("id", doctorId).maybeSingle()
            );

            if (!doctor) return;
            if (doctor.hospital_id !== hospital.id) refuse("You can only remove doctors of your own hospital.");
            if (doctor.removed) return;

            await run(supabaseAdmin.from("doctors").update({
                removed: true,
                removed_at: now(),
                status: "Removed",
                updated_at: now()
            }).eq("id", doctorId));
        }
    };


    // --------------------------------------------------
    // Doctor schedules (staff of that hospital only)
    // --------------------------------------------------

    handlers[KEYS.schedules] = {

        async upsert(user, item) {

            const hospital = await requireStaffHospital(user);
            const id = cleanId(item.id);
            const doctorId = cleanId(item.doctorId);

            const doctor = await run(
                supabaseAdmin.from("doctors").select("*").eq("id", doctorId).maybeSingle()
            );

            if (!doctor || doctor.hospital_id !== hospital.id) {
                refuse("You can only set schedules for doctors of your own hospital.");
            }

            if (!isDate(item.date)) refuse("Please choose a valid date.");
            if (!isTime(item.workingFrom) || !isTime(item.workingTo) || item.workingFrom >= item.workingTo) {
                refuse("Working hours: the end time must be after the start time.");
            }

            const status = item.status === "Busy" ? "Busy" : "Available";

            if (status === "Busy" &&
                (!isTime(item.busyFrom) || !isTime(item.busyTo) || item.busyFrom >= item.busyTo)) {
                refuse("Busy time: the end time must be after the start time.");
            }

            const row = {
                id,
                schedule_key: cleanText(item.key, 120) || (doctorId + "__" + item.date),
                doctor_id: doctorId,
                hospital_id: hospital.id,
                doctor_name: doctor.name,
                speciality: doctor.speciality,
                date: item.date,
                working_from: item.workingFrom,
                working_to: item.workingTo,
                status,
                busy_from: status === "Busy" ? item.busyFrom : null,
                busy_to: status === "Busy" ? item.busyTo : null,
                available_again_from:
                    status === "Busy" && isTime(item.availableAgainFrom) ? item.availableAgainFrom : null,
                updated_at: now()
            };

            // One schedule per doctor per day
            await run(supabaseAdmin
                .from("doctor_schedules")
                .delete()
                .eq("doctor_id", doctorId)
                .eq("date", item.date)
                .neq("id", id));

            await run(supabaseAdmin.from("doctor_schedules").upsert(row, { onConflict: "id" }));
        },

        async remove(user, id) {
            const hospital = await requireStaffHospital(user);
            await run(supabaseAdmin
                .from("doctor_schedules")
                .delete()
                .eq("id", cleanId(id))
                .eq("hospital_id", hospital.id));
        }
    };


    // --------------------------------------------------
    // Staff notifications
    // --------------------------------------------------

    handlers[KEYS.staffNotifications] = {

        async upsert(user, item) {

            // Patients' pages may still try to add a "new booking"
            // alert; the server already adds that one itself.
            if (user.role !== "staff") return;

            const hospital = await requireStaffHospital(user);
            const id = cleanId(item.id);

            const existing = await run(
                supabaseAdmin.from("staff_notifications").select("*").eq("id", id).maybeSingle()
            );

            if (existing) {
                if (existing.hospital_id !== hospital.id) refuse("Not allowed.");
                if (typeof item.read === "boolean" && item.read !== existing.read) {
                    await run(supabaseAdmin.from("staff_notifications")
                        .update({ read: item.read }).eq("id", id));
                }
                return;
            }

            await run(supabaseAdmin.from("staff_notifications").insert({
                id,
                hospital_id: hospital.id,
                type: cleanText(item.type, 30) || "system",
                title: cleanText(item.title, 120) || "Notification",
                message: cleanText(item.message, 500),
                read: item.read === true
            }));
        },

        async remove(user, id) {
            if (user.role !== "staff") return;
            const hospital = await requireStaffHospital(user);
            await run(supabaseAdmin
                .from("staff_notifications")
                .delete()
                .eq("id", cleanId(id))
                .eq("hospital_id", hospital.id));
        }
    };


    // --------------------------------------------------
    // Notices for patients (written by the Schedule page)
    // --------------------------------------------------

    handlers[KEYS.patientNotifications] = {

        async upsert(user, item) {

            if (user.role !== "staff") return;

            const hospital = await requireStaffHospital(user);
            const id = cleanId(item.id);

            const existing = await run(
                supabaseAdmin.from("patient_notifications").select("id").eq("id", id).maybeSingle()
            );

            if (existing) return;

            const patientEmail = cleanText(item.patientEmail, 120).toLowerCase();

            // Only patients who booked at this hospital
            const booking = await run(supabaseAdmin
                .from("bookings").select("id")
                .eq("hospital_id", hospital.id)
                .ilike("email", patientEmail)
                .limit(1));

            if (!patientEmail || booking.length === 0) {
                refuse("This patient has no appointment at your hospital.");
            }

            await run(supabaseAdmin.from("patient_notifications").insert({
                id,
                hospital_id: hospital.id,
                patient_email: patientEmail,
                patient_name: cleanText(item.patientName, 80),
                type: cleanText(item.type, 30),
                title: cleanText(item.title, 120) || "Hospital notice",
                message: cleanText(item.message, 500),
                doctor: cleanText(item.doctor, 80),
                date: cleanText(item.date, 20),
                booked_slot: cleanText(item.bookedSlot, 20),
                available_again: cleanText(item.availableAgain, 20)
            }));
        }
    };


    // --------------------------------------------------
    // Which notifications a patient has read
    // (the whole list is sent each time)
    // --------------------------------------------------

    handlers[KEYS.readNotifications] = {

        async upsert() {
            // individual ids are collected in afterAll
        },

        async afterAll(user, ids) {

            const merged = new Set((user.read_notifications || []).map(String));
            ids.forEach((id) => merged.add(cleanText(id, 100)));

            const list = Array.from(merged).filter(Boolean).slice(-1000);

            await run(supabaseAdmin.from("profiles")
                .update({ read_notifications: list })
                .eq("id", user.id));

            user.read_notifications = list;
        }
    };


    // --------------------------------------------------
    // The logged-in person's own details
    // (profile page "Edit Profile", admin Settings page)
    // --------------------------------------------------

    handlers[KEYS.currentUser] = {

        async upsert(user, item) {

            const changes = {};

            const name = cleanText(item.name, 80);
            const contact = cleanText(item.contact || item.contactNumber, 20);
            const email = cleanText(item.email, 120).toLowerCase();

            if (name && name !== user.name) {
                if (!/^[A-Za-z\s.]+$/.test(name)) refuse("Name can contain only alphabets and spaces.");
                changes.name = name;
            }

            if (contact && contact !== user.contact) {
                if (!/^\d{10}$/.test(contact)) refuse("Contact number must contain exactly 10 digits.");
                changes.contact = contact;
            }

            if (email && email !== user.email) {

                if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)) {
                    refuse("Please enter a valid Gmail address.");
                }

                const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                    email,
                    email_confirm: true
                });

                if (error) {
                    refuse(/already|registered|exists/i.test(error.message || "")
                        ? "Another account already uses this email."
                        : error.message);
                }

                changes.email = email;
            }

            if (Object.keys(changes).length === 0) return;

            await run(supabaseAdmin.from("profiles").update(changes).eq("id", user.id));

            // Keep "booked by" on this person's appointments up to date
            const bookingChanges = { updated_at: now() };
            if (changes.email) bookingChanges.booked_by_email = changes.email;
            if (changes.name) bookingChanges.booked_by_name = changes.name;

            if (changes.email || changes.name) {
                await run(supabaseAdmin.from("bookings")
                    .update(bookingChanges)
                    .eq("patient_user_id", user.id));
            }

            forgetUser(user.id);
        }
    };


    // ==================================================
    // PUT /api/staff/hospital - hospital details + slot
    // settings, edited on the admin Settings page
    // ==================================================

    app.put("/api/staff/hospital", async (req, res) => {

        try {

            const user = await getRequestUser(req);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    code: "session_expired",
                    message: "Please log in again."
                });
            }

            const hospital = await staffHospital(user);

            if (!hospital) {
                return res.status(403).json({
                    success: false,
                    message: "Only hospital staff can change hospital details."
                });
            }

            const b = req.body || {};
            const duration = Number(b.appointmentDuration);

            if (!SLOT_LENGTHS.includes(duration)) {
                return res.status(400).json({
                    success: false,
                    message: "Appointment duration must be 15, 30, 45 or 60 minutes."
                });
            }

            if (!isTime(b.workingStart) || !isTime(b.workingEnd) || b.workingStart >= b.workingEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Working hours end time must be later than start time."
                });
            }

            if (b.phone && !/^[0-9+\s,\-()]{6,40}$/.test(String(b.phone))) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid phone number."
                });
            }

            // Only the fields that were sent are changed
            const textFields = {
                location: 80, description: 300, about: 2000, image: 500,
                founded: 10, beds: 10, address: 300, phone: 40, email: 120,
                website: 200, timings: 200, emergency: 200
            };

            const changes = {
                appointment_duration: duration,
                working_start: b.workingStart,
                working_end: b.workingEnd,
                updated_at: now()
            };

            Object.keys(textFields).forEach((field) => {
                if (b[field] !== undefined) changes[field] = cleanText(b[field], textFields[field]);
            });

            if (b.facilities !== undefined) changes.facilities = textArray(b.facilities, 60);

            const saved = await run(supabaseAdmin
                .from("hospitals")
                .update(changes)
                .eq("id", hospital.id)
                .select()
                .single());

            hospitalCache = null;

            res.json({
                success: true,
                message: "Hospital details saved.",
                hospital: { ...hospitalOut(saved), joinCode: saved.join_code || "" }
            });
        }

        catch (error) {
            serverError(res, error);
        }
    });
};
