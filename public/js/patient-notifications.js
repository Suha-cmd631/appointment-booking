/*
  BOOK N MEET - patient notifications (shared by all patient pages)

  A patient's notifications come from two places:

  1. Their appointments ("bookNMeetBookings").
     Whenever the hospital staff change an appointment
     (Pending -> Upcoming -> Completed / Missed / Cancelled),
     the patient gets a matching notification.

  2. Notices written by the hospital's Schedule page
     ("bookNMeetPatientNotifications"), for example when a doctor
     becomes unavailable at a time the patient already booked.

  This file also shows the red dot on the bell icon ONLY when
  there is something unread.
*/

(function(){

    const BOOKINGS_KEY = "bookNMeetBookings";
    const NOTICES_KEY = "bookNMeetPatientNotifications";
    const READ_KEY = "bookNMeetReadNotifications";
    const USER_KEY = "bookNMeetCurrentUser";

    function readList(key){
        try{
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        }catch(error){
            return [];
        }
    }

    function getCurrentUser(){
        try{
            return JSON.parse(localStorage.getItem(USER_KEY) || "null");
        }catch(error){
            return null;
        }
    }

    function clean(value){
        return String(value || "").trim().toLowerCase();
    }

    function escapeHtml(value){
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(dateString){

        if(!dateString){
            return "";
        }

        const date = new Date(dateString);

        if(isNaN(date.getTime())){
            return dateString;
        }

        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    /* What to say for each appointment status. */
    const STATUS_TEXT = {
        pending:   { type: "pending",   icon: "⏳", title: "Appointment pending",   text: "is waiting for the hospital to confirm." },
        upcoming:  { type: "upcoming",  icon: "📅", title: "Appointment confirmed", text: "has been confirmed by the hospital." },
        completed: { type: "completed", icon: "✓",  title: "Appointment completed", text: "has been marked as completed." },
        missed:    { type: "missed",    icon: "⚠️", title: "Appointment missed",    text: "was marked as missed." },
        canceled:  { type: "canceled",  icon: "✕",  title: "Appointment cancelled", text: "has been cancelled." }
    };

    /* Different spellings of the same status. */
    const STATUS_NAMES = {
        pending: "pending",
        upcoming: "upcoming",
        confirmed: "upcoming",
        completed: "completed",
        complete: "completed",
        missed: "missed",
        miss: "missed",
        cancelled: "canceled",
        canceled: "canceled",
        cancel: "canceled"
    };

    /* Appointments booked from the logged-in account. */
    function getMyBookings(user){

        const userEmail = clean(user.email);
        const userName = clean(user.name);

        return readList(BOOKINGS_KEY).filter(function(booking){

            const bookedByEmail = clean(
                booking.bookedByEmail ||
                booking.createdByEmail ||
                booking.accountEmail
            );

            const bookedByName = clean(booking.bookedByName);

            return (
                (userEmail && bookedByEmail === userEmail) ||
                (!bookedByEmail && userName && bookedByName === userName)
            );
        });
    }

    /* Every notification for the logged-in patient, newest first. */
    function list(){

        const user = getCurrentUser();

        if(!user){
            return [];
        }

        const readIds = readList(READ_KEY).map(String);
        const myBookings = getMyBookings(user);
        const notifications = [];

        myBookings.forEach(function(booking){

            const statusName =
                STATUS_NAMES[clean(booking.status || "Pending")];

            const status = STATUS_TEXT[statusName];

            if(!status){
                return;
            }

            notifications.push({
                id: String(booking.id) + "_" + status.type,
                type: status.type,
                icon: status.icon,
                title: status.title,
                html:
                    "<strong>" + escapeHtml(booking.patientName || "Patient") +
                    "</strong>'s appointment with <strong>" +
                    escapeHtml(booking.doctor || "the doctor") +
                    "</strong> at <strong>" +
                    escapeHtml(booking.hospital || "the hospital") +
                    "</strong> " + status.text,
                when:
                    "Appointment: " + formatDate(booking.date) +
                    (booking.slot ? " • " + booking.slot : ""),
                time: Number(booking.id) || 0
            });
        });

        /* Notices from the hospital (for example "doctor unavailable"). */
        const myEmails = [clean(user.email)];

        myBookings.forEach(function(booking){
            if(booking.email){
                myEmails.push(clean(booking.email));
            }
        });

        readList(NOTICES_KEY).forEach(function(notice){

            const noticeEmail = clean(notice.patientEmail);

            if(!noticeEmail || !myEmails.includes(noticeEmail)){
                return;
            }

            notifications.push({
                id: "notice_" + notice.id,
                type: "missed",
                icon: "⚠️",
                title: notice.title || "Hospital notice",
                html: escapeHtml(notice.message || ""),
                when:
                    (notice.hospital ? notice.hospital + " • " : "") +
                    formatDate(notice.date) +
                    (notice.bookedSlot ? " • " + notice.bookedSlot : ""),
                time: Date.parse(notice.timestamp) || 0
            });
        });

        notifications.sort(function(a, b){
            return b.time - a.time;
        });

        notifications.forEach(function(notification){
            notification.read = readIds.includes(notification.id);
        });

        return notifications;
    }

    function unreadCount(){
        return list().filter(function(notification){
            return !notification.read;
        }).length;
    }

    function markRead(notificationId){

        const readIds = readList(READ_KEY).map(String);

        if(!readIds.includes(String(notificationId))){
            readIds.push(String(notificationId));
            localStorage.setItem(READ_KEY, JSON.stringify(readIds));
        }

        updateBell();
    }

    /* Red dot on the bell: only when something is unread. */
    function updateBell(){

        const hasUnread = unreadCount() > 0;

        document.querySelectorAll(".notification-dot")
            .forEach(function(dot){
                dot.style.display = hasUnread ? "" : "none";
            });
    }

    window.BNMPatientNotifications = {
        list: list,
        unreadCount: unreadCount,
        markRead: markRead,
        updateBell: updateBell,
        getCurrentUser: getCurrentUser
    };

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", updateBell);
    }else{
        updateBell();
    }

    /* Refresh when the hospital changes something. */
    window.addEventListener("storage", updateBell);
    setInterval(updateBell, 3000);

})();
