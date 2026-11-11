// Runs once after all tests: deletes everything the tests created
// (test accounts, their bookings and notifications, test doctors).

const { admin, EMAIL_PREFIX } = require("./common");

module.exports = async function () {
    try {
        const db = admin();

        // Test accounts
        const testUsers = [];
        for (let page = 1; page < 50; page++) {
            const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) throw error;
            testUsers.push(...data.users.filter((u) => String(u.email || "").startsWith(EMAIL_PREFIX)));
            if (data.users.length < 1000) break;
        }
        const userIds = testUsers.map((u) => u.id);

        // Their bookings (+ the notifications those bookings made)
        const { data: bookings } = await db.from("bookings").select("id")
            .or(`email.like.${EMAIL_PREFIX}%,id.like.test_%` + (userIds.length ? `,patient_user_id.in.(${userIds.join(",")})` : ""));
        const bookingIds = (bookings || []).map((b) => b.id);

        for (const id of bookingIds) {
            await db.from("staff_notifications").delete().or(`id.eq.booking-${id},id.like.cancel-${id}-%`);
            await db.from("patient_notifications").delete().like("id", `%${id}%`);
        }
        if (bookingIds.length) await db.from("bookings").delete().in("id", bookingIds);

        // Test doctors and their schedules
        await db.from("doctor_schedules").delete().like("doctor_id", "test_%");
        await db.from("doctors").delete().like("id", "test_%");

        for (const id of userIds) await db.auth.admin.deleteUser(id);

        console.log(`\nCleaned up: ${userIds.length} test accounts, ${bookingIds.length} test bookings.`);
    } catch (error) {
        console.log("\nCould not clean up test data: " + error.message);
    }

    if (globalThis.__BNM_SERVER__) globalThis.__BNM_SERVER__.kill();
};
