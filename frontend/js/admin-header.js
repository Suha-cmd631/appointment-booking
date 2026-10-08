/*
  BOOK N MEET - shared behaviour of the admin menu bar

  Shows the red number on the bell (unread hospital notifications)
  and the staff member's initials on every admin page, so the menu
  bar looks the same everywhere.
*/

(function(){

    function clean(value){
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    function updateHeader(){

        let user = null;
        let notifications = [];

        try{
            user = JSON.parse(
                localStorage.getItem("bookNMeetCurrentUser") || "null"
            );
            notifications = JSON.parse(
                localStorage.getItem("bookNMeetNotifications") || "[]"
            );
        }catch(error){
            notifications = [];
        }

        /* Same initials in the round badge on every page (e.g. "LS"). */
        const initials = String((user && user.name) || "U")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(function(word){ return word.charAt(0).toUpperCase(); })
            .join("") || "U";

        document.querySelectorAll(".adm-avatar").forEach(function(avatar){
            if(avatar.textContent.trim() !== initials){
                avatar.textContent = initials;
            }
        });

        const hospital = clean(user && user.hospital);

        const unread = (Array.isArray(notifications) ? notifications : [])
            .filter(function(notification){
                return (
                    !notification.read &&
                    hospital &&
                    clean(notification.hospital) === hospital
                );
            }).length;

        document.querySelectorAll(".adm-badge").forEach(function(badge){
            badge.textContent = unread > 99 ? "99+" : unread;
            badge.style.display = unread === 0 ? "none" : "flex";
        });
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", updateHeader);
    }else{
        updateHeader();
    }

    window.addEventListener("storage", updateHeader);
    setInterval(updateHeader, 3000);

})();
