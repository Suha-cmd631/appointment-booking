/*
  BOOK N MEET - link between the patient site and the admin site

  Hospital staff can look at both sites without logging out:

    - on admin pages   -> a "View Patient Site" button in the bottom-right corner
    - on patient pages -> an "Admin Dashboard" link in the top menu

  Patients never see these links.
*/

(function(){

    let user = null;

    try{
        user = JSON.parse(
            localStorage.getItem("bookNMeetCurrentUser") || "null"
        );
    }catch(error){
        user = null;
    }

    if(!user || user.role !== "staff"){
        return;
    }

    const ADMIN_PAGES = [
        "admin.html",
        "appointments.html",
        "doctors.html",
        "patients.html",
        "doctor-schedule.html",
        "reports.html",
        "settings.html",
        "admin-notifications.html"
    ];

    const page = window.location.pathname.split("/").pop() || "";
    const onAdminSite = ADMIN_PAGES.includes(page);

    function addLink(){

        if(document.querySelector("[data-site-link]")){
            return;
        }

        const link = document.createElement("a");

        link.setAttribute("data-site-link", "");

        if(onAdminSite){

            /*
              Admin pages: a small button fixed in the bottom-right
              corner (the admin menu bar has no room for one more link).
            */
            link.href = "first.html";
            link.textContent = "View Patient Site →";
            link.title = "See the website the way patients see it";

            link.style.cssText =
                "position:fixed; right:22px; bottom:22px; z-index:50;" +
                "padding:11px 18px; border-radius:999px;" +
                "background:#12345b; color:#ffffff;" +
                "font:600 13px Arial, Helvetica, sans-serif;" +
                "text-decoration:none;" +
                "box-shadow:0 8px 22px rgba(18,52,91,0.28);";

            document.body.appendChild(link);
            return;
        }

        /* Patient pages: one more link in the top menu. */
        const menu = document.querySelector("header nav, nav");

        if(!menu){
            return;
        }

        link.href = "admin.html";
        link.textContent = "Admin Dashboard";
        link.title = "Go back to your hospital dashboard";

        menu.appendChild(link);
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", addLink);
    }else{
        addLink();
    }

})();
