/*
  BOOK N MEET - connection between the pages and the server

  Every page loads this file in its <head> (right after js/config.js).

  How it works, in plain words:

  1. When a page opens, this file asks the server for everything the
     logged-in person may see (hospitals, doctors, schedules,
     appointments, notifications) and keeps a copy in the browser
     (localStorage), in the same shape the pages already use.

  2. When a page saves something (books an appointment, accepts it,
     adds a doctor...), this file notices the change and sends it to
     the server straight away. The server checks it and saves it in
     the database. If the server says no, the person sees why and the
     copy is put back to what the server has.

  3. Every few seconds the copy is refreshed, so a booking made by a
     patient appears on the hospital's pages without reloading.

  The database is the real store; the browser copy is only for speed.
*/

(function(){

    const API_URL = String(
        (window.BNM_CONFIG && window.BNM_CONFIG.API_URL) || ""
    ).replace(/\/+$/, "");

    const SESSION_KEY = "bookNMeetSession";
    const USER_KEY = "bookNMeetCurrentUser";

    /* Everything the server sends (and the browser keeps a copy of). */
    const MIRRORED_KEYS = [
        "bookNMeetHospitals",
        "bookNMeetHospitalSettings",
        "bookNMeetDoctors",
        "bookNMeetRemovedDoctors",
        "bookNMeetDoctorSchedules",
        "bookNMeetBookings",
        "bookNMeetNotifications",
        "bookNMeetPatientNotifications",
        "bookNMeetReadNotifications",
        "bookNMeetReviews",
        USER_KEY
    ];

    /* Changes to these are sent to the server. */
    const SAVED_KEYS = [
        "bookNMeetDoctors",
        "bookNMeetRemovedDoctors",
        "bookNMeetDoctorSchedules",
        "bookNMeetBookings",
        "bookNMeetNotifications",
        "bookNMeetPatientNotifications",
        "bookNMeetReadNotifications",
        USER_KEY
    ];

    /* For these, a record missing from the new list means "delete it". */
    const DELETABLE_KEYS = [
        "bookNMeetDoctorSchedules",
        "bookNMeetNotifications"
    ];

    /* Old browser-only data that is no longer used. */
    const OLD_KEYS = ["bookNMeetUsers", "bookNMeetSeededDoctors"];

    /* Pages that need someone to be logged in. */
    const STAFF_PAGES = [
        "admin.html", "appointments.html", "doctors.html", "patients.html",
        "doctor-schedule.html", "reports.html", "settings.html",
        "admin-notifications.html"
    ];
    const PATIENT_PAGES = ["booking.html", "profile.html", "notifications.html"];

    const page = (window.location.pathname.split("/").pop() || "").toLowerCase();

    const storage = window.localStorage;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    let writingCopy = false;     // true while this file itself updates the copy
    let serverReachable = true;


    // -------------------------------------------------
    // Small helpers
    // -------------------------------------------------

    function readJSON(key){
        try{
            return JSON.parse(storage.getItem(key));
        }catch(error){
            return null;
        }
    }

    function writeCopy(key, value){
        writingCopy = true;
        try{
            if(value === null || value === undefined){
                originalRemoveItem.call(storage, key);
            }else{
                originalSetItem.call(storage, key, JSON.stringify(value));
            }
        }finally{
            writingCopy = false;
        }
    }

    function getSession(){
        return readJSON(SESSION_KEY);
    }

    function clearLogin(){
        writingCopy = true;
        try{
            [SESSION_KEY].concat(MIRRORED_KEYS, OLD_KEYS).forEach(function(key){
                originalRemoveItem.call(storage, key);
            });
        }finally{
            writingCopy = false;
        }
    }

    /*
      Talk to the server.
      waitForAnswer = true  -> the page waits (used when saving and
                               when the page first opens)
      Returns { status, data }, or null when the server can't be reached.
    */
    function request(method, path, body, waitForAnswer, token){

        if(!API_URL){
            return waitForAnswer ? null : Promise.resolve(null);
        }

        const xhr = new XMLHttpRequest();
        let result = null;

        function finish(){
            try{
                const data = JSON.parse(xhr.responseText);
                if(data && typeof data.success === "boolean"){
                    result = { status: xhr.status, data: data };
                }
            }catch(error){
                result = null;
            }
            setServerReachable(result !== null);
            return result;
        }

        try{
            xhr.open(method, API_URL + path, !waitForAnswer);
            xhr.setRequestHeader("Content-Type", "application/json");
            if(token){
                xhr.setRequestHeader("Authorization", "Bearer " + token);
            }

            if(waitForAnswer){
                xhr.send(body ? JSON.stringify(body) : null);
                return finish();
            }

            return new Promise(function(resolve){
                xhr.onload = function(){ resolve(finish()); };
                xhr.onerror = function(){ setServerReachable(false); resolve(null); };
                xhr.ontimeout = xhr.onerror;
                xhr.timeout = 15000;
                xhr.send(body ? JSON.stringify(body) : null);
            });

        }catch(error){
            setServerReachable(false);
            return waitForAnswer ? null : Promise.resolve(null);
        }
    }

    /* A log-in lasts one hour; renew it a minute before it ends. */
    function currentToken(){

        const session = getSession();

        if(!session || !session.access_token){
            return null;
        }

        const expiresSoon =
            session.expires_at &&
            session.expires_at * 1000 - Date.now() < 60000;

        if(!expiresSoon){
            return session.access_token;
        }

        const answer = request("POST", "/api/refresh", {
            refresh_token: session.refresh_token
        }, true);

        if(answer && answer.data.success){
            writeCopy(SESSION_KEY, answer.data.session);
            return answer.data.session.access_token;
        }

        if(answer){
            // The server says the log-in is over
            loggedOut();
            return null;
        }

        // Server not reachable: try the old one anyway
        return session.access_token;
    }

    function loggedOut(){

        clearLogin();

        if(STAFF_PAGES.includes(page) || PATIENT_PAGES.includes(page)){
            window.location.replace("landing.html");
        }
    }


    // -------------------------------------------------
    // Getting the latest data from the server
    // -------------------------------------------------

    function applyData(data){

        const changed = [];

        MIRRORED_KEYS.forEach(function(key){

            if(!(key in data)){
                return;
            }

            const value = data[key];
            const before = storage.getItem(key);
            const after = value === null ? null : JSON.stringify(value);

            if(before !== after){
                writeCopy(key, value);
                changed.push(key);
            }
        });

        return changed;
    }

    /* Let the page know, the same way a change in another tab would. */
    function announce(keys){
        keys.forEach(function(key){
            try{
                window.dispatchEvent(new StorageEvent("storage", {
                    key: key,
                    newValue: storage.getItem(key),
                    storageArea: storage
                }));
            }catch(error){
                /* very old browser: pages still refresh on their own timers */
            }
        });
    }

    function handleAnswer(answer){

        if(!answer){
            return [];
        }

        if(answer.status === 401){
            loggedOut();
            return [];
        }

        if(answer.data.success && answer.data.data){
            return applyData(answer.data.data);
        }

        return [];
    }

    /* First load: the page waits for this, so it starts with fresh data.
       Returns the names of the lists that changed. */
    function loadNow(){

        // If the server did not answer a moment ago, don't make the
        // page wait again - use the saved copy and try in the background.
        let downSince = 0;
        try{ downSince = Number(sessionStorage.getItem("bnmServerDownAt")) || 0; }catch(error){}

        if(downSince && Date.now() - downSince < 20000){
            serverReachable = false;
            return [];
        }

        const changed = handleAnswer(request("GET", "/api/sync", null, true, currentToken()));

        try{
            if(serverReachable) sessionStorage.removeItem("bnmServerDownAt");
            else sessionStorage.setItem("bnmServerDownAt", String(Date.now()));
        }catch(error){}

        return changed;
    }

    /* Regular refresh in the background. */
    let refreshing = false;

    function refreshInBackground(){

        if(refreshing || document.hidden){
            return;
        }

        refreshing = true;

        const token = currentToken();

        request("GET", "/api/sync", null, false, token).then(function(answer){
            refreshing = false;
            announce(handleAnswer(answer));
        });
    }


    // -------------------------------------------------
    // Sending a page's change to the server
    // -------------------------------------------------

    function idOf(item){
        return item && item.id !== undefined && item.id !== null ? String(item.id) : null;
    }

    /* Work out what changed between the old and the new list. */
    function findChanges(key, before, after){

        if(key === USER_KEY){

            if(!after || typeof after !== "object"){
                return null;
            }

            const old = before || {};
            const differs = ["name", "contact", "contactNumber", "email"].some(function(field){
                return after[field] !== undefined && after[field] !== old[field];
            });

            return differs ? { upserts: [after], deletes: [] } : null;
        }

        if(!Array.isArray(after)){
            return null;
        }

        // Lists of plain ids (read notifications, removed doctors)
        if(key === "bookNMeetReadNotifications" || key === "bookNMeetRemovedDoctors"){
            const oldIds = new Set((Array.isArray(before) ? before : []).map(String));
            const added = after.map(String).filter(function(id){ return !oldIds.has(id); });
            return added.length ? { upserts: added, deletes: [] } : null;
        }

        // Lists of records with an id
        const oldById = new Map();

        (Array.isArray(before) ? before : []).forEach(function(item){
            const id = idOf(item);
            if(id !== null) oldById.set(id, item);
        });

        const upserts = [];
        const seen = new Set();

        after.forEach(function(item){

            const id = idOf(item);

            if(id === null){
                return;
            }

            seen.add(id);

            const old = oldById.get(id);

            if(!old){
                upserts.push(item);
                return;
            }

            if(JSON.stringify(old) === JSON.stringify(item)){
                return;
            }

            // The page edited an old copy of this record (the server's
            // version changed in the meantime): skip, the server's
            // newer version wins.
            if(item._v !== undefined && old._v !== undefined && item._v !== old._v){
                return;
            }

            upserts.push(item);
        });

        const deletes = DELETABLE_KEYS.includes(key)
            ? Array.from(oldById.keys()).filter(function(id){ return !seen.has(id); })
            : [];

        return upserts.length || deletes.length ? { upserts: upserts, deletes: deletes } : null;
    }

    function saveToServer(key, changes){

        const token = currentToken();

        if(!token){
            return {
                ok: false,
                message: "You are not logged in any more. Please log in again."
            };
        }

        const answer = request("POST", "/api/sync", {
            key: key,
            upserts: changes.upserts,
            deletes: changes.deletes
        }, true, token);

        if(!answer){
            return {
                ok: false,
                message: "Cannot reach the server, so this change was not saved. Please check your internet connection and try again."
            };
        }

        if(answer.status === 401){
            loggedOut();
            return { ok: false, message: answer.data.message };
        }

        return {
            ok: answer.data.success,
            message: answer.data.message
        };
    }

    /*
      Watch the page's saves.
      A change the server refuses is undone, and the page is stopped
      (so it does not show "saved!" for something that was not saved).
    */
    Storage.prototype.setItem = function(key, value){

        if(this !== storage || writingCopy || !SAVED_KEYS.includes(key)){
            return originalSetItem.call(this, key, value);
        }

        const before = readJSON(key);
        let after;

        try{
            after = JSON.parse(value);
        }catch(error){
            return originalSetItem.call(this, key, value);
        }

        const changes = findChanges(key, before, after);

        originalSetItem.call(this, key, value);

        if(!changes || !getSession()){
            return;
        }

        const result = saveToServer(key, changes);

        // Always take the server's version after a save, and tell the
        // page about anything that came back different
        const changed = loadNow().filter(function(changedKey){
            return changedKey !== key || !result.ok;
        });
        if(changed.length){
            setTimeout(function(){ announce(changed); }, 0);
        }

        if(!result.ok){
            window.alert(result.message || "This change could not be saved.");
            throw new Error("BOOK N MEET: change not saved - " + (result.message || ""));
        }
    };

    /* Logging out (any page removes the current user) clears everything. */
    Storage.prototype.removeItem = function(key){

        if(this === storage && !writingCopy && (key === USER_KEY || key === SESSION_KEY)){
            clearLogin();
            return;
        }

        return originalRemoveItem.call(this, key);
    };


    // -------------------------------------------------
    // Small notice when the server cannot be reached
    // -------------------------------------------------

    function setServerReachable(reachable){

        serverReachable = reachable;

        if(reachable){
            try{ sessionStorage.removeItem("bnmServerDownAt"); }catch(error){}
        }

        const show = function(){

            let note = document.getElementById("bnmOfflineNote");

            if(reachable){
                if(note) note.remove();
                return;
            }

            if(note || page === "landing.html" || page === "" || !document.body){
                return;
            }

            note = document.createElement("div");
            note.id = "bnmOfflineNote";
            note.setAttribute("role", "status");
            note.textContent = "Can't reach the server - showing the last saved data.";
            note.style.cssText =
                "position:fixed;left:16px;bottom:16px;z-index:2000;" +
                "padding:10px 14px;border-radius:10px;" +
                "background:#fff7e6;border:1px solid #f3dca8;color:#7a5200;" +
                "font:600 12px Arial,Helvetica,sans-serif;" +
                "box-shadow:0 6px 18px rgba(0,0,0,0.12);";
            document.body.appendChild(note);
        };

        if(document.body){
            show();
        }else{
            document.addEventListener("DOMContentLoaded", show, { once: true });
        }
    }


    // -------------------------------------------------
    // Used by the login page and by pages that save
    // directly (hospital details on the Settings page)
    // -------------------------------------------------

    window.BNMSync = {

        apiUrl: API_URL,

        isServerReachable: function(){ return serverReachable; },

        /* After a successful log in */
        logIn: function(session, user){
            clearLogin();
            writeCopy(SESSION_KEY, session);
            writeCopy(USER_KEY, user);
            loadNow();
        },

        logOut: function(){
            clearLogin();
            window.location.href = "landing.html";
        },

        /* Ask the server directly (returns a Promise) */
        call: function(method, path, body){
            return request(method, path, body, false, currentToken());
        },

        refreshNow: function(){
            announce(loadNow());
        }
    };


    // -------------------------------------------------
    // Start
    // -------------------------------------------------

    OLD_KEYS.forEach(function(key){ originalRemoveItem.call(storage, key); });

    loadNow();

    // Someone opened a staff page without being staff (or a patient
    // page without being logged in): send them to the login page.
    const user = readJSON(USER_KEY);

    if(serverReachable){
        if(STAFF_PAGES.includes(page) && (!user || user.role !== "staff")){
            window.location.replace("landing.html");
        }
        if(PATIENT_PAGES.includes(page) && !user){
            window.location.replace("landing.html");
        }
    }

    setInterval(refreshInBackground, 5000);

    document.addEventListener("visibilitychange", function(){
        if(!document.hidden) refreshInBackground();
    });

})();
