/*
  BOOK N MEET - hospitals and shared helper functions

  Used by:
    hospitals.html  (hospital information page)
    search.html     (search results page)

  The hospitals and their doctors now come from the database.
  js/sync.js keeps a copy in the browser ("bookNMeetHospitals" and
  "bookNMeetDoctors"); this file reads that copy.

  To change a hospital's details: admin Settings page (staff of that
  hospital). To add or remove doctors: admin Doctors page.
*/

/* Hospitals by id, e.g. hospitals.trinity */
const hospitals = {};

function loadHospitalsFromCopy(){

    let saved = {};

    try{
        saved = JSON.parse(localStorage.getItem("bookNMeetHospitals")) || {};
    }catch(error){
        saved = {};
    }

    Object.keys(hospitals).forEach(function(id){
        delete hospitals[id];
    });

    Object.keys(saved).forEach(function(id){
        hospitals[id] = { ...saved[id], doctors: [] };
    });
}

loadHospitalsFromCopy();

/* Keep the list fresh when the server sends changes. */
window.addEventListener("storage", function(event){
    if(event.key === "bookNMeetHospitals"){
        loadHospitalsFromCopy();
    }
});


/* ---------- Shared helper functions ---------- */

function cleanHospitalName(name){
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function hospitalKey(name){
    let value = cleanHospitalName(name);

    value = value
        .replace(/\bgoutami\b/g, "gowthami")
        .replace(/\bhospital\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    return value;
}

function hospitalNamesMatch(first, second){
    const a = hospitalKey(first);
    const b = hospitalKey(second);

    if(!a || !b){
        return false;
    }

    return (
        a === b ||
        a.includes(b) ||
        b.includes(a)
    );
}

function cleanSpeciality(name){
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function specialityKey(name){
    const s = cleanSpeciality(name);

    const map = {
        "pediatrician":"pediatrics",
        "pediatrics":"pediatrics",
        "cardiologist":"cardiology",
        "cardiology":"cardiology",
        "neurologist":"neurology",
        "neurology":"neurology",
        "dermatologist":"dermatology",
        "dermatology":"dermatology",
        "gynecologist":"gynecology",
        "gynecology":"gynecology",
        "ophthalmologist":"ophthalmology",
        "ophthalmology":"ophthalmology",
        "orthopedic specialist":"orthopedics",
        "orthopedist":"orthopedics",
        "orthopedics":"orthopedics",
        "ent specialist":"ent",
        "ent":"ent",
        "general physician":"general medicine",
        "general medicine":"general medicine"
    };

    return map[s] || s;
}

function specialityDisplayName(name){
    const key = specialityKey(name);

    const names = {
        "cardiology":"Cardiology",
        "neurology":"Neurology",
        "general medicine":"General Medicine",
        "orthopedics":"Orthopedics",
        "dermatology":"Dermatology",
        "gynecology":"Gynecology",
        "pediatrics":"Pediatrics",
        "ophthalmology":"Ophthalmology",
        "ent":"ENT"
    };

    if(names[key]){
        return names[key];
    }

    return String(name || "Specialist")
        .trim()
        .replace(/\b\w/g, function(letter){
            return letter.toUpperCase();
        });
}

function doctorMatchesSpeciality(doctor, selectedSpeciality){
    const selected = specialityKey(selectedSpeciality);

    const doctorKey = specialityKey(
        doctor.specialityKey ||
        doctor.speciality ||
        ""
    );

    return doctorKey === selected;
}

function getStoredDoctors(){
    try{
        const stored =
            JSON.parse(localStorage.getItem("bookNMeetDoctors")) || [];

        return Array.isArray(stored) ? stored : [];
    }catch(error){
        console.error("Unable to read bookNMeetDoctors:", error);
        return [];
    }
}

function getRemovedDoctorIds(){
    try{
        const removed = JSON.parse(
            localStorage.getItem("bookNMeetRemovedDoctors") || "[]"
        );

        return Array.isArray(removed)
            ? removed.map(String)
            : [];
    }catch(error){
        console.error("Unable to read removed doctors:", error);
        return [];
    }
}

function isDoctorRemoved(doctor){
    if(doctor.removed === true || doctor.status === "Removed"){
        return true;
    }

    const doctorId = doctor.id || doctor.doctorId;

    if(!doctorId){
        return false;
    }

    return getRemovedDoctorIds().includes(String(doctorId));
}

function getHospitalDoctors(hospital){
    /*
      Keep the doctors already present in this patient page,
      then add doctors created from admin/doctors.html.

      This means an admin-added doctor is visible to patients
      without removing the existing hospital doctors.
    */
    const existingDoctors = (hospital.doctors || [])
    .filter(function(doctor){

        // Do not show removed doctors
        if(isDoctorRemoved(doctor)){
            return false;
        }

        return true;
    })
    .map(function(doctor){

        return {
            ...doctor,
            hospital: doctor.hospital || hospital.name,
            hospitalName: doctor.hospitalName || hospital.name,
            specialityKey:
                doctor.specialityKey ||
                specialityKey(doctor.speciality || "")
        };

    });

    const storedDoctors = getStoredDoctors().filter(function(doctor){
        if(isDoctorRemoved(doctor)){
        return false;
    }
        const doctorHospital = cleanHospitalName(
            doctor.hospital || doctor.hospitalName || ""
        );

        return hospitalNamesMatch(
            doctorHospital,
            hospital.name
        );
    }).map(function(doctor){
        return {
            ...doctor,
            hospital: doctor.hospital || doctor.hospitalName || hospital.name,
            hospitalName:
                doctor.hospitalName ||
                doctor.hospital ||
                hospital.name,
            specialityKey:
                doctor.specialityKey ||
                specialityKey(doctor.speciality || "")
        };
    });

    /*
      Merge by hospital + doctor name + speciality so that
      the same doctor is not displayed twice.
    */
    const merged = [];
    const seen = new Set();

    existingDoctors.concat(storedDoctors).forEach(function(doctor){
        const key =
            cleanHospitalName(hospital.name) +
            "|" +
            cleanSpeciality(doctor.name) +
            "|" +
            specialityKey(doctor.specialityKey || doctor.speciality);

        if(!seen.has(key)){
            seen.add(key);
            merged.push(doctor);
        }
    });

    return merged;
}

function getHospitalSpecialities(hospital){
    const specialities = Array.isArray(hospital.specialities)
        ? hospital.specialities.slice()
        : [];

    /* Add specialities automatically from doctors added by admin. */
    getHospitalDoctors(hospital).forEach(function(doctor){
        const doctorSpeciality =
            doctor.specialityKey ||
            doctor.speciality ||
            "";

        if(!doctorSpeciality){
            return;
        }

        const displayName = specialityDisplayName(doctorSpeciality);
        const key = specialityKey(displayName);

        const alreadyExists = specialities.some(function(existing){
            return specialityKey(existing) === key;
        });

        if(!alreadyExists){
            specialities.push(displayName);
        }
    });

    return specialities;
}

function escapeHtml(value){
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
