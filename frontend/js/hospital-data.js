/*
  BOOK N MEET - shared hospital data and helper functions.

  Used by:
    hospitals.html  (hospital information page)
    search.html     (search results page)

  Load js/seed-doctors.js BEFORE this file. It holds the doctors of
  Lalitha Hospital and Avideep Mother and Children Hospital.

  NOTE: for Trinity, Gowthami and Neokidz the address, phone, email,
  timings, facilities, founded year, qualification, languages and
  "about" text are SAMPLE details. Replace them with the real
  information of each hospital / doctor.
*/

const hospitals = {

    trinity: {
        name: "Trinity Hospital",
        location: "📍 Tadepalligudem",
        rating: "★★★★★ 4.8",
        description: "A multi-speciality hospital providing quality healthcare and experienced doctors.",
        image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80",
        about: "Trinity Hospital is a multi-speciality hospital serving Tadepalligudem and nearby towns. It brings heart, brain, bone and general medical care under one roof, with modern operation theatres, a full diagnostic lab and a team that focuses on clear communication with patients and their families.",
        founded: "2008",
        beds: "150",
        address: "K.N. Road, Tadepalligudem, West Godavari, Andhra Pradesh 534101",
        phone: "+91 90000 00001",
        email: "info@trinityhospital.example",
        timings: "Mon - Sat: 8:00 AM - 9:00 PM, Sun: 9:00 AM - 1:00 PM",
        emergency: "24x7 emergency and ambulance available",
        /* Real services list for Trinity (given by the hospital listing). */
        facilities: [
            "Emergency Care","Ambulance Service","Outpatient Services",
            "Diagnostic Imaging","Pharmacy Services","Orthopaedics",
            "Neurology","Anaesthesiology","Laboratory Services",
            "General Surgery","Physician"
        ],
        specialities: ["Cardiology","Neurology","General Medicine","Orthopedics"],
        doctors: [
            {
                name:"Dr. Ananya Rao",
                speciality:"Cardiologist",
                experience:"12 years experience",
                qualification:"MBBS, MD (General Medicine), DM (Cardiology)",
                languages:"Telugu, English, Hindi",
                about:"Treats heart conditions such as high blood pressure, chest pain and heart rhythm problems, with a focus on prevention and long-term heart health.",
                rating:"★★★★★ 4.9",
                review:"Very attentive and explains the treatment clearly. Patients appreciate her caring approach.",
                image:"https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Rahul Verma",
                speciality:"Neurologist",
                experience:"10 years experience",
                qualification:"MBBS, MD (General Medicine), DM (Neurology)",
                languages:"English, Hindi, Telugu",
                about:"Cares for patients with headaches, migraine, epilepsy, stroke and nerve-related problems, and is known for detailed check-ups.",
                rating:"★★★★★ 4.8",
                review:"Professional doctor with excellent communication and detailed diagnosis.",
                image:"https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Kiran Kumar",
                speciality:"Orthopedic Specialist",
                experience:"9 years experience",
                qualification:"MBBS, MS (Orthopaedics)",
                languages:"Telugu, English",
                about:"Treats bone, joint and muscle problems including fractures, back pain, arthritis and sports injuries.",
                rating:"★★★★★ 4.7",
                review:"Patients appreciate the practical advice and friendly consultation.",
                image:"https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=300&q=80"
            }
        ]
    },

    gowthami: {
        name: "Gowthami Hospital",
        location: "📍 Tadepalligudem",
        rating: "★★★★★ 4.7",
        description: "Modern healthcare facilities with specialists across multiple departments.",
        image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
        about: "Gowthami Hospital offers family healthcare with a strong focus on women, children and skin care. The hospital has a maternity wing, a newborn care unit and day-care procedure rooms, and is known for a calm and friendly environment.",
        founded: "2012",
        beds: "100",
        address: "Subba Rao Peta, Tadepalligudem, West Godavari, Andhra Pradesh 534101",
        phone: "+91 90000 00002",
        email: "care@gowthamihospital.example",
        timings: "Mon - Sat: 9:00 AM - 8:00 PM, Sun: 10:00 AM - 1:00 PM",
        emergency: "24x7 emergency and maternity care available",
        facilities: ["24x7 Emergency","Maternity Ward","Newborn Care Unit (NICU)","Operation Theatres","Diagnostic Lab","Pharmacy","Ambulance","Parking"],
        specialities: ["Dermatology","Gynecology","Pediatrics","General Medicine"],
        doctors: [
            {
                name:"Dr. Priya Sharma",
                speciality:"Dermatologist",
                experience:"11 years experience",
                qualification:"MBBS, MD (Dermatology)",
                languages:"English, Hindi, Telugu",
                about:"Treats skin, hair and nail problems such as acne, eczema, allergies and hair fall.",
                rating:"★★★★★ 4.8",
                review:"Known for careful diagnosis and clear skin-care guidance.",
                image:"https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Sneha Reddy",
                speciality:"Pediatrician",
                experience:"8 years experience",
                qualification:"MBBS, MD (Pediatrics)",
                languages:"Telugu, English",
                about:"Looks after babies, children and teenagers - vaccinations, growth check-ups, fevers and common childhood illnesses.",
                rating:"★★★★★ 4.7",
                review:"Friendly with children and provides clear instructions to parents.",
                image:"https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Meera Rao",
                speciality:"Gynecologist",
                experience:"10 years experience",
                qualification:"MBBS, MS (Obstetrics & Gynaecology)",
                languages:"Telugu, English, Hindi",
                about:"Provides pregnancy care, delivery and treatment for women's health concerns at every stage of life.",
                rating:"★★★★★ 4.8",
                review:"Patients value her supportive consultation and detailed explanations.",
                image:"https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=300&q=80"
            }
        ]
    },

    neokidz: {
        name: "Neokidz ENT",
        location: "📍 Tadepalligudem",
        rating: "★★★★★ 4.6",
        description: "Specialized healthcare services with a focus on ENT and children's healthcare.",
        image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=800&q=80",
        about: "Neokidz ENT is a speciality centre for ear, nose and throat care, children's health and eye care. It has hearing-test and eye-test rooms, a child-friendly waiting area and a day-care unit for small procedures.",
        founded: "2016",
        beds: "40",
        address: "Housing Board Colony, Tadepalligudem, West Godavari, Andhra Pradesh 534101",
        phone: "+91 90000 00003",
        email: "hello@neokidzent.example",
        timings: "Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed",
        emergency: "Emergency care during working hours only",
        facilities: ["Hearing Test Room","Eye Test Room","Day-care Procedures","Children's Play Area","Diagnostic Lab","Pharmacy","Parking"],
        specialities: ["ENT","Pediatrics","Ophthalmology"],
        doctors: [
            {
                name:"Dr. Vikram Rao",
                speciality:"ENT Specialist",
                experience:"9 years experience",
                qualification:"MBBS, MS (ENT)",
                languages:"Telugu, English, Hindi",
                about:"Treats ear, nose and throat problems such as sinus trouble, tonsil infections and hearing loss.",
                rating:"★★★★★ 4.7",
                review:"Patients appreciate his detailed explanations and efficient treatment.",
                image:"https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Arjun Kumar",
                speciality:"Pediatrician",
                experience:"7 years experience",
                qualification:"MBBS, DCH (Child Health)",
                languages:"Telugu, English",
                about:"Cares for newborns and children, including vaccinations, nutrition advice and common infections.",
                rating:"★★★★★ 4.6",
                review:"A patient and friendly doctor who makes children comfortable.",
                image:"https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=300&q=80"
            },
            {
                name:"Dr. Nisha Patel",
                speciality:"Ophthalmologist",
                experience:"8 years experience",
                qualification:"MBBS, MS (Ophthalmology)",
                languages:"English, Hindi, Telugu",
                about:"Provides eye check-ups, glasses prescriptions and treatment for cataract, dry eyes and eye infections.",
                rating:"★★★★★ 4.7",
                review:"Known for careful eye examinations and easy-to-understand advice.",
                image:"https://images.unsplash.com/photo-1618498082410-b4aa22193b38?auto=format&fit=crop&w=300&q=80"
            }
        ]
    },

    /*
      The two hospitals below use REAL details taken from their
      Google listings. Details that were not available (founded year,
      beds, email, some doctor experience / languages)
      are left empty and are simply not shown on the page.
    */

    lalitha: {
        name: "Lalitha Hospital",
        location: "📍 Tadepalligudem",
        rating: "★★★★★ 4.9 (160 reviews)",
        description: "Private hospital open 24 hours, known for orthopaedic surgery, maternity care and general check-ups.",
        image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80",
        about: "Lalitha Hospital is a private hospital opposite the RTC bus stand in Tadepalligudem and is open 24 hours. It offers orthopaedic care including joint replacement, spine and disc surgery and fracture fixation, along with maternity care, high-risk pregnancy care, infertility treatment, laparoscopic and open surgery, emergency care, physical therapy, and in-house lab, X-ray, ultrasound scan and pharmacy services.",
        address: "Geethamandhir Road, Opposite RTC Bus Stand, In-gate, Ambedkar Nagar, Kadakatla, Tadepalligudem, Andhra Pradesh 534101",
        phone: "+91 91217 54595, 08818-222536",
        website: "https://www.facebook.com/lalithahosp",
        timings: "Open 24 hours",
        emergency: "24x7 emergency care available",
        facilities: [
            "Emergency Care","Outpatient Services","General Check-ups",
            "Joint Replacement Surgery","Spine and Disc Surgery",
            "Fracture Fixation & Surgery","PRP Injection Therapy","Physical Therapy",
            "Maternity Care","High-risk Pregnancy Care","Infertility Treatment",
            "Laparoscopy Surgery","Laparoscopic Treatment for Ovarian Cysts","Open Surgery",
            "Diagnostic Imaging","X-ray and Radiology","Ultrasound Scan",
            "Laboratory Services","Nursing Services","Pharmacy"
        ],
        specialities: ["Orthopedics","Gynecology","General Medicine"],
        reviews: [
            "Good hospitality. Nice staff. Caring doctors. Good environment.",
            "Doctor response and explanation is great."
        ],
        /* These doctors are listed in js/seed-doctors.js */
        doctors: listedDoctorsFor("Lalitha Hospital")
    },

    avideep: {
        name: "Avideep Mother and Children Hospital",
        location: "📍 Tadepalligudem",
        rating: "★★★★★ 4.9 (715 reviews)",
        description: "Mother and child hospital open 24 hours, with maternity, gynecology, pediatric and newborn intensive care.",
        image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80",
        about: "Avideep Mother and Children Hospital is on Railway Station Road in Tadepalligudem and is open 24 hours. It cares for mothers, newborns and children, with maternity and gynecology services, infertility treatment facilities, a children's specialist, vaccination, a newborn intensive care unit (NICU) with phototherapy, and a pediatric intensive care unit (PICU). It handles all types of newborn and pediatric emergencies and has its own lab and pharmacy.",
        address: "Railway Station Road, Railway Colony, Tadepalligudem, Andhra Pradesh 534101",
        phone: "+91 99599 58453",
        website: "https://avideephospital.com/",
        timings: "Open 24 hours",
        emergency: "24x7 newborn and pediatric emergency care",
        facilities: [
            /* Child care */
            "General Pediatrics",
            "NICU - Neonatal Intensive Care",
            "PICU - Pediatric Intensive Care Unit",
            "Phototherapy for Newborns",
            "Newborn Emergencies","Pediatric Emergencies",
            "Vaccination",
            "Child Psychology & Psychiatry",
            "Nutrition & Growth Monitoring",
            "Pediatric Allergy Care",
            "Developmental Pediatrics",
            /* Women care */
            "Pregnancy & Delivery Care",
            "High-Risk Pregnancy",
            "Laparoscopic Surgeries",
            "Infertility Treatment",
            "Menopause Care",
            "Gynecology Consultation",
            /* General */
            "Emergency Care","Outpatient Services",
            "Laboratory Services","Pharmacy"
        ],
        specialities: ["Gynecology","Pediatrics"],
        reviews: [
            "Doctor's treatment is good and staff coordination and overall service good.",
            "Everyone treats like a family. Very good doctor and nurses.",
            "Pleasant environment and good medication in Gynecology and Pediatrics."
        ],
        /* These doctors are listed in js/seed-doctors.js */
        doctors: listedDoctorsFor("Avideep Mother and Children Hospital")
    }
};


/* ---------- Shared helper functions ---------- */

/* Doctors from js/seed-doctors.js that belong to one hospital. */
function listedDoctorsFor(hospitalName){

    if(typeof BNM_SEED_DOCTORS === "undefined"){
        return [];
    }

    return BNM_SEED_DOCTORS.filter(function(doctor){
        return doctor.hospital === hospitalName;
    });
}

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
