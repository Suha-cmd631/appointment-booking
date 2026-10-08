/*
  BOOK N MEET - doctors that are already listed for a hospital.

  These doctors belong to Lalitha Hospital and Avideep Mother and
  Children Hospital. This file does two things:

  1. hospitals.html and search.html show them to patients
     (through js/hospital-data.js).

  2. They are saved ONCE into the shared doctor list
     (localStorage "bookNMeetDoctors"), the same place where
     doctors added by hospital staff are saved. That is why the
     staff of these hospitals see them in the admin Doctors page
     and can set schedules for them or remove them.

  To change a doctor's details, edit the list below.
*/

const BNM_SEED_DOCTORS = [

    {
        id: "seed_lalitha_sai_prudhvi",
        hospital: "Lalitha Hospital",
        hospitalName: "Lalitha Hospital",
        name: "Dr. K. Sai Prudhvi",
        speciality: "Orthopedic Specialist",
        specialityKey: "orthopedics",
        qualification: "MBBS, MS (Ortho)",
        study: "MBBS, MS (Ortho)",
        experience: "",
        about: "Offers PRP (platelet rich plasma) injection therapy, an advanced treatment without an operation for long-term problems. Platelets are separated from the patient's own blood by a special method and injected into the affected area. Used for knee pain and cartilage wear, heel and foot pain, elbow pain, shoulder pain and muscle pains.",
        review: "Met Dr. Prudhvi sir and he gave treatment to my father (shoulder injection).",
        image: "images/doctor.png"
    },

    {
        id: "seed_lalitha_surekha",
        hospital: "Lalitha Hospital",
        hospitalName: "Lalitha Hospital",
        name: "Dr. K. Surekha",
        speciality: "Obstetrician & Gynecologist, Laparoscopic Surgeon, Infertility Specialist",
        specialityKey: "gynecology",
        qualification: "MBBS, MS (OBG), DMAS, F.ART",
        study: "MBBS, MS (OBG), DMAS, F.ART",
        experience: "",
        about: "Provides pregnancy and women's health care, infertility treatment and laparoscopic surgery, including advanced laparoscopic treatment for ovarian cysts.",
        image: "images/doctor.png"
    },

    {
        id: "seed_avideep_ashadeepthi",
        hospital: "Avideep Mother and Children Hospital",
        hospitalName: "Avideep Mother and Children Hospital",
        name: "Dr. A. Ashadeepthi",
        speciality: "Gynecologist & Laparoscopic, Fertility Specialist",
        specialityKey: "gynecology",
        qualification: "MBBS, MS, FMAS, DMAS",
        study: "MBBS, MS, FMAS, DMAS",
        experience: "9+ years experience in women's healthcare",
        about: "",
        review: "Dr. Asha is highly professional and takes the time to clearly explain the diagnosis and all available treatment options.",
        image: "images/doctor.png"
    },

    {
        id: "seed_avideep_avinash",
        hospital: "Avideep Mother and Children Hospital",
        hospitalName: "Avideep Mother and Children Hospital",
        name: "Dr. P. Avinash",
        speciality: "Pediatrician & Neonatologist",
        specialityKey: "pediatrics",
        qualification: "MBBS, MD, PALS, MCPE, PGPN",
        study: "MBBS, MD, PALS, MCPE, PGPN",
        experience: "10+ years experience in newborn & child care",
        about: "",
        review: "Deepthi madam and Avinash sir are very kind and friendly, and we feel free to clear any of our doubts.",
        image: "images/doctor.png"
    }
];


/*
  Save the doctors above into the shared doctor list, one time only.

  "bookNMeetSeededDoctors" remembers which ones were already saved,
  so a doctor removed by the hospital staff is never added back.
*/
(function(){

    const DOCTORS_KEY = "bookNMeetDoctors";
    const SEEDED_KEY = "bookNMeetSeededDoctors";

    function readList(key){
        try{
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        }catch(error){
            return [];
        }
    }

    try{
        const doctors = readList(DOCTORS_KEY);
        const seeded = readList(SEEDED_KEY).map(String);

        let changed = false;

        BNM_SEED_DOCTORS.forEach(function(doctor){

            if(seeded.includes(doctor.id)){
                return;
            }

            const alreadySaved = doctors.some(function(saved){
                return String(saved.id || saved.doctorId || "") === doctor.id;
            });

            if(!alreadySaved){
                doctors.push({
                    ...doctor,
                    description: doctor.about,
                    phone: "",
                    email: "",
                    status: "Available",
                    createdAt: new Date().toISOString()
                });
            }

            seeded.push(doctor.id);
            changed = true;
        });

        if(changed){
            localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors));
            localStorage.setItem(SEEDED_KEY, JSON.stringify(seeded));
        }

    }catch(error){
        console.error("Unable to save the listed doctors:", error);
    }

})();
