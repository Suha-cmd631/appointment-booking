-- =====================================================================
--  BOOK N MEET - complete database setup
--
--  HOW TO USE: open your Supabase project -> SQL Editor -> New query,
--  paste this WHOLE file, press Run. It is safe to run again later.
--
--  Part 1 creates the tables. Part 2 adds the 5 hospitals and their
--  doctors (only if they are not there yet).
-- =====================================================================

-- ========================= PART 1: TABLES =========================

-- ---------------------------------------------------------------------
-- HOSPITALS
-- Details shown to patients + appointment slot settings.
-- Hospital staff edit their own hospital from the admin Settings page.
-- ---------------------------------------------------------------------
create table if not exists public.hospitals (
    id                   text primary key,          -- short name, e.g. 'trinity'
    name                 text not null unique,      -- e.g. 'Trinity Hospital'
    location             text,
    rating               text,
    description          text,
    image                text,
    about                text,
    founded              text,
    beds                 text,
    address              text,
    phone                text,
    email                text,
    website              text,
    timings              text,
    emergency            text,
    facilities           text[] not null default '{}',
    specialities         text[] not null default '{}',
    reviews              text[] not null default '{}',
    appointment_duration integer not null default 30,     -- minutes per slot
    working_start        text not null default '09:00',   -- 24-hour time
    working_end          text not null default '17:00',
    updated_at           timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- ACCOUNTS (one row per person who signs up)
-- The email + password themselves are kept by Supabase Auth.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    name        text not null,
    email       text not null,
    contact     text,
    role        text not null check (role in ('patient', 'staff')),
    hospital    text,                                  -- staff only: hospital name
    created_at  timestamptz not null default now()
);

-- added later: which notifications a patient has already read
alter table public.profiles
    add column if not exists read_notifications text[] not null default '{}';


-- ---------------------------------------------------------------------
-- DOCTORS
-- ---------------------------------------------------------------------
create table if not exists public.doctors (
    id              text primary key,
    hospital_id     text not null references public.hospitals (id) on delete cascade,
    name            text not null,
    speciality      text not null,
    speciality_key  text,
    experience      text,
    qualification   text,
    languages       text,
    about           text,
    phone           text,
    email           text,
    rating          text,
    review          text,
    image           text,
    status          text not null default 'Available',
    available       boolean not null default true,
    removed         boolean not null default false,    -- kept for old bookings
    removed_at      timestamptz,
    extra           jsonb not null default '{}',       -- today's schedule summary etc.
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists doctors_hospital_idx on public.doctors (hospital_id);


-- ---------------------------------------------------------------------
-- DOCTOR SCHEDULES (one row per doctor per day, set on the Schedule page)
-- ---------------------------------------------------------------------
create table if not exists public.doctor_schedules (
    id                    text primary key,
    schedule_key          text,
    doctor_id             text not null references public.doctors (id) on delete cascade,
    hospital_id           text not null references public.hospitals (id) on delete cascade,
    doctor_name           text,
    speciality            text,
    date                  date not null,
    working_from          text not null default '09:00',
    working_to            text not null default '17:00',
    status                text not null default 'Available' check (status in ('Available', 'Busy')),
    busy_from             text,
    busy_to               text,
    available_again_from  text,
    updated_at            timestamptz not null default now(),
    unique (doctor_id, date)
);


-- ---------------------------------------------------------------------
-- APPOINTMENTS
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
    id                          text primary key,
    hospital_id                 text not null references public.hospitals (id),
    doctor_id                   text references public.doctors (id),
    doctor_name                 text not null,
    patient_user_id             uuid references auth.users (id) on delete set null,
    booked_by_email             text,
    booked_by_name              text,
    patient_name                text not null,
    phone                       text not null,
    email                       text not null,
    age                         text,
    speciality                  text,
    date                        date not null,
    slot                        text not null,          -- e.g. '10:30 AM'
    status                      text not null default 'Pending'
                                check (status in ('Pending', 'Upcoming', 'Completed', 'Missed', 'Canceled', 'Cancelled')),
    doctor_unavailable          boolean not null default false,
    schedule_conflict_notified  boolean not null default false,
    booked_at                   text,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

create index if not exists bookings_hospital_idx on public.bookings (hospital_id, date);
create index if not exists bookings_patient_idx  on public.bookings (patient_user_id);

-- the same doctor cannot have two active appointments in the same slot
create unique index if not exists bookings_one_per_slot
    on public.bookings (doctor_id, date, slot)
    where status in ('Pending', 'Upcoming');


-- ---------------------------------------------------------------------
-- NOTIFICATIONS FOR HOSPITAL STAFF
-- ---------------------------------------------------------------------
create table if not exists public.staff_notifications (
    id           text primary key,
    hospital_id  text not null references public.hospitals (id) on delete cascade,
    type         text,
    title        text not null,
    message      text,
    read         boolean not null default false,
    created_at   timestamptz not null default now()
);

create index if not exists staff_notifications_hospital_idx
    on public.staff_notifications (hospital_id, created_at desc);


-- ---------------------------------------------------------------------
-- NOTICES FOR PATIENTS (for example "doctor unavailable at your time")
-- Appointment status updates are worked out from the bookings table.
-- ---------------------------------------------------------------------
create table if not exists public.patient_notifications (
    id               text primary key,
    hospital_id      text references public.hospitals (id) on delete cascade,
    patient_email    text not null,
    patient_name     text,
    type             text,
    title            text not null,
    message          text,
    doctor           text,
    date             text,
    booked_slot      text,
    available_again  text,
    read             boolean not null default false,
    created_at       timestamptz not null default now()
);

create index if not exists patient_notifications_email_idx
    on public.patient_notifications (lower(patient_email));


-- ---------------------------------------------------------------------
-- SECURITY: only the server (secret key) may use these tables
-- ---------------------------------------------------------------------
alter table public.hospitals              enable row level security;
alter table public.profiles               enable row level security;
alter table public.doctors                enable row level security;
alter table public.doctor_schedules       enable row level security;
alter table public.bookings               enable row level security;
alter table public.staff_notifications    enable row level security;
alter table public.patient_notifications  enable row level security;

grant all on all tables in schema public to service_role;


-- ===================== PART 2: HOSPITALS AND DOCTORS =====================

-- Seed data: the 5 hospitals and their doctors (from the old js/hospital-data.js and js/seed-doctors.js).
-- Safe to run more than once: existing rows are left as they are.

insert into public.hospitals (id, name, location, rating, description, image, about, founded, beds, address, phone, email, website, timings, emergency, facilities, specialities, reviews)
values ('trinity',
        'Trinity Hospital',
        '📍 Tadepalligudem',
        '★★★★★ 4.8',
        'A multi-speciality hospital providing quality healthcare and experienced doctors.',
        'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80',
        'Trinity Hospital is a multi-speciality hospital serving Tadepalligudem and nearby towns. It brings heart, brain, bone and general medical care under one roof, with modern operation theatres, a full diagnostic lab and a team that focuses on clear communication with patients and their families.',
        '2008',
        '150',
        'K.N. Road, Tadepalligudem, West Godavari, Andhra Pradesh 534101',
        '+91 90000 00001',
        'info@trinityhospital.example',
        null,
        'Mon - Sat: 8:00 AM - 9:00 PM, Sun: 9:00 AM - 1:00 PM',
        '24x7 emergency and ambulance available',
        array['Emergency Care', 'Ambulance Service', 'Outpatient Services', 'Diagnostic Imaging', 'Pharmacy Services', 'Orthopaedics', 'Neurology', 'Anaesthesiology', 'Laboratory Services', 'General Surgery', 'Physician'],
        array['Cardiology', 'Neurology', 'General Medicine', 'Orthopedics'],
        '{}')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('trinity_ananya_rao', 'trinity', 'Dr. Ananya Rao', 'Cardiologist', 'cardiology', '12 years experience', 'MBBS, MD (General Medicine), DM (Cardiology)', 'Telugu, English, Hindi', 'Treats heart conditions such as high blood pressure, chest pain and heart rhythm problems, with a focus on prevention and long-term heart health.', '★★★★★ 4.9', 'Very attentive and explains the treatment clearly. Patients appreciate her caring approach.', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('trinity_rahul_verma', 'trinity', 'Dr. Rahul Verma', 'Neurologist', 'neurology', '10 years experience', 'MBBS, MD (General Medicine), DM (Neurology)', 'English, Hindi, Telugu', 'Cares for patients with headaches, migraine, epilepsy, stroke and nerve-related problems, and is known for detailed check-ups.', '★★★★★ 4.8', 'Professional doctor with excellent communication and detailed diagnosis.', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('trinity_kiran_kumar', 'trinity', 'Dr. Kiran Kumar', 'Orthopedic Specialist', 'orthopedics', '9 years experience', 'MBBS, MS (Orthopaedics)', 'Telugu, English', 'Treats bone, joint and muscle problems including fractures, back pain, arthritis and sports injuries.', '★★★★★ 4.7', 'Patients appreciate the practical advice and friendly consultation.', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.hospitals (id, name, location, rating, description, image, about, founded, beds, address, phone, email, website, timings, emergency, facilities, specialities, reviews)
values ('gowthami',
        'Gowthami Hospital',
        '📍 Tadepalligudem',
        '★★★★★ 4.7',
        'Modern healthcare facilities with specialists across multiple departments.',
        'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
        'Gowthami Hospital offers family healthcare with a strong focus on women, children and skin care. The hospital has a maternity wing, a newborn care unit and day-care procedure rooms, and is known for a calm and friendly environment.',
        '2012',
        '100',
        'Subba Rao Peta, Tadepalligudem, West Godavari, Andhra Pradesh 534101',
        '+91 90000 00002',
        'care@gowthamihospital.example',
        null,
        'Mon - Sat: 9:00 AM - 8:00 PM, Sun: 10:00 AM - 1:00 PM',
        '24x7 emergency and maternity care available',
        array['24x7 Emergency', 'Maternity Ward', 'Newborn Care Unit (NICU)', 'Operation Theatres', 'Diagnostic Lab', 'Pharmacy', 'Ambulance', 'Parking'],
        array['Dermatology', 'Gynecology', 'Pediatrics', 'General Medicine'],
        '{}')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('gowthami_priya_sharma', 'gowthami', 'Dr. Priya Sharma', 'Dermatologist', 'dermatology', '11 years experience', 'MBBS, MD (Dermatology)', 'English, Hindi, Telugu', 'Treats skin, hair and nail problems such as acne, eczema, allergies and hair fall.', '★★★★★ 4.8', 'Known for careful diagnosis and clear skin-care guidance.', 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('gowthami_sneha_reddy', 'gowthami', 'Dr. Sneha Reddy', 'Pediatrician', 'pediatrics', '8 years experience', 'MBBS, MD (Pediatrics)', 'Telugu, English', 'Looks after babies, children and teenagers - vaccinations, growth check-ups, fevers and common childhood illnesses.', '★★★★★ 4.7', 'Friendly with children and provides clear instructions to parents.', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('gowthami_meera_rao', 'gowthami', 'Dr. Meera Rao', 'Gynecologist', 'gynecology', '10 years experience', 'MBBS, MS (Obstetrics & Gynaecology)', 'Telugu, English, Hindi', 'Provides pregnancy care, delivery and treatment for women''s health concerns at every stage of life.', '★★★★★ 4.8', 'Patients value her supportive consultation and detailed explanations.', 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.hospitals (id, name, location, rating, description, image, about, founded, beds, address, phone, email, website, timings, emergency, facilities, specialities, reviews)
values ('neokidz',
        'Neokidz ENT',
        '📍 Tadepalligudem',
        '★★★★★ 4.6',
        'Specialized healthcare services with a focus on ENT and children''s healthcare.',
        'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=800&q=80',
        'Neokidz ENT is a speciality centre for ear, nose and throat care, children''s health and eye care. It has hearing-test and eye-test rooms, a child-friendly waiting area and a day-care unit for small procedures.',
        '2016',
        '40',
        'Housing Board Colony, Tadepalligudem, West Godavari, Andhra Pradesh 534101',
        '+91 90000 00003',
        'hello@neokidzent.example',
        null,
        'Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed',
        'Emergency care during working hours only',
        array['Hearing Test Room', 'Eye Test Room', 'Day-care Procedures', 'Children''s Play Area', 'Diagnostic Lab', 'Pharmacy', 'Parking'],
        array['ENT', 'Pediatrics', 'Ophthalmology'],
        '{}')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('neokidz_vikram_rao', 'neokidz', 'Dr. Vikram Rao', 'ENT Specialist', 'ent', '9 years experience', 'MBBS, MS (ENT)', 'Telugu, English, Hindi', 'Treats ear, nose and throat problems such as sinus trouble, tonsil infections and hearing loss.', '★★★★★ 4.7', 'Patients appreciate his detailed explanations and efficient treatment.', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('neokidz_arjun_kumar', 'neokidz', 'Dr. Arjun Kumar', 'Pediatrician', 'pediatrics', '7 years experience', 'MBBS, DCH (Child Health)', 'Telugu, English', 'Cares for newborns and children, including vaccinations, nutrition advice and common infections.', '★★★★★ 4.6', 'A patient and friendly doctor who makes children comfortable.', 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('neokidz_nisha_patel', 'neokidz', 'Dr. Nisha Patel', 'Ophthalmologist', 'ophthalmology', '8 years experience', 'MBBS, MS (Ophthalmology)', 'English, Hindi, Telugu', 'Provides eye check-ups, glasses prescriptions and treatment for cataract, dry eyes and eye infections.', '★★★★★ 4.7', 'Known for careful eye examinations and easy-to-understand advice.', 'https://images.unsplash.com/photo-1618498082410-b4aa22193b38?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into public.hospitals (id, name, location, rating, description, image, about, founded, beds, address, phone, email, website, timings, emergency, facilities, specialities, reviews)
values ('lalitha',
        'Lalitha Hospital',
        '📍 Tadepalligudem',
        '★★★★★ 4.9 (160 reviews)',
        'Private hospital open 24 hours, known for orthopaedic surgery, maternity care and general check-ups.',
        'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80',
        'Lalitha Hospital is a private hospital opposite the RTC bus stand in Tadepalligudem and is open 24 hours. It offers orthopaedic care including joint replacement, spine and disc surgery and fracture fixation, along with maternity care, high-risk pregnancy care, infertility treatment, laparoscopic and open surgery, emergency care, physical therapy, and in-house lab, X-ray, ultrasound scan and pharmacy services.',
        null,
        null,
        'Geethamandhir Road, Opposite RTC Bus Stand, In-gate, Ambedkar Nagar, Kadakatla, Tadepalligudem, Andhra Pradesh 534101',
        '+91 91217 54595, 08818-222536',
        null,
        'https://www.facebook.com/lalithahosp',
        'Open 24 hours',
        '24x7 emergency care available',
        array['Emergency Care', 'Outpatient Services', 'General Check-ups', 'Joint Replacement Surgery', 'Spine and Disc Surgery', 'Fracture Fixation & Surgery', 'PRP Injection Therapy', 'Physical Therapy', 'Maternity Care', 'High-risk Pregnancy Care', 'Infertility Treatment', 'Laparoscopy Surgery', 'Laparoscopic Treatment for Ovarian Cysts', 'Open Surgery', 'Diagnostic Imaging', 'X-ray and Radiology', 'Ultrasound Scan', 'Laboratory Services', 'Nursing Services', 'Pharmacy'],
        array['Orthopedics', 'Gynecology', 'General Medicine'],
        array['Good hospitality. Nice staff. Caring doctors. Good environment.', 'Doctor response and explanation is great.'])
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('seed_lalitha_sai_prudhvi', 'lalitha', 'Dr. K. Sai Prudhvi', 'Orthopedic Specialist', 'orthopedics', null, 'MBBS, MS (Ortho)', null, 'Offers PRP (platelet rich plasma) injection therapy, an advanced treatment without an operation for long-term problems. Platelets are separated from the patient''s own blood by a special method and injected into the affected area. Used for knee pain and cartilage wear, heel and foot pain, elbow pain, shoulder pain and muscle pains.', null, 'Met Dr. Prudhvi sir and he gave treatment to my father (shoulder injection).', 'images/doctor.png')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('seed_lalitha_surekha', 'lalitha', 'Dr. K. Surekha', 'Obstetrician & Gynecologist, Laparoscopic Surgeon, Infertility Specialist', 'gynecology', null, 'MBBS, MS (OBG), DMAS, F.ART', null, 'Provides pregnancy and women''s health care, infertility treatment and laparoscopic surgery, including advanced laparoscopic treatment for ovarian cysts.', null, null, 'images/doctor.png')
on conflict (id) do nothing;

insert into public.hospitals (id, name, location, rating, description, image, about, founded, beds, address, phone, email, website, timings, emergency, facilities, specialities, reviews)
values ('avideep',
        'Avideep Mother and Children Hospital',
        '📍 Tadepalligudem',
        '★★★★★ 4.9 (715 reviews)',
        'Mother and child hospital open 24 hours, with maternity, gynecology, pediatric and newborn intensive care.',
        'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
        'Avideep Mother and Children Hospital is on Railway Station Road in Tadepalligudem and is open 24 hours. It cares for mothers, newborns and children, with maternity and gynecology services, infertility treatment facilities, a children''s specialist, vaccination, a newborn intensive care unit (NICU) with phototherapy, and a pediatric intensive care unit (PICU). It handles all types of newborn and pediatric emergencies and has its own lab and pharmacy.',
        null,
        null,
        'Railway Station Road, Railway Colony, Tadepalligudem, Andhra Pradesh 534101',
        '+91 99599 58453',
        null,
        'https://avideephospital.com/',
        'Open 24 hours',
        '24x7 newborn and pediatric emergency care',
        array['General Pediatrics', 'NICU - Neonatal Intensive Care', 'PICU - Pediatric Intensive Care Unit', 'Phototherapy for Newborns', 'Newborn Emergencies', 'Pediatric Emergencies', 'Vaccination', 'Child Psychology & Psychiatry', 'Nutrition & Growth Monitoring', 'Pediatric Allergy Care', 'Developmental Pediatrics', 'Pregnancy & Delivery Care', 'High-Risk Pregnancy', 'Laparoscopic Surgeries', 'Infertility Treatment', 'Menopause Care', 'Gynecology Consultation', 'Emergency Care', 'Outpatient Services', 'Laboratory Services', 'Pharmacy'],
        array['Gynecology', 'Pediatrics'],
        array['Doctor''s treatment is good and staff coordination and overall service good.', 'Everyone treats like a family. Very good doctor and nurses.', 'Pleasant environment and good medication in Gynecology and Pediatrics.'])
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('seed_avideep_ashadeepthi', 'avideep', 'Dr. A. Ashadeepthi', 'Gynecologist & Laparoscopic, Fertility Specialist', 'gynecology', '9+ years experience in women''s healthcare', 'MBBS, MS, FMAS, DMAS', null, null, null, 'Dr. Asha is highly professional and takes the time to clearly explain the diagnosis and all available treatment options.', 'images/doctor.png')
on conflict (id) do nothing;

insert into public.doctors (id, hospital_id, name, speciality, speciality_key, experience, qualification, languages, about, rating, review, image)
values ('seed_avideep_avinash', 'avideep', 'Dr. P. Avinash', 'Pediatrician & Neonatologist', 'pediatrics', '10+ years experience in newborn & child care', 'MBBS, MD, PALS, MCPE, PGPN', null, null, null, 'Deepthi madam and Avinash sir are very kind and friendly, and we feel free to clear any of our doubts.', 'images/doctor.png')
on conflict (id) do nothing;


-- ===================== PART 3: STAFF JOIN CODES =====================
-- Every hospital gets its own secret code. Someone signing up as
-- "Hospital Staff" must type their hospital's code, so strangers cannot
-- make a staff account and see patients' details.
-- Where to see the codes: the admin Settings page (for staff of that
-- hospital), or run "node check-accounts.js" in the backend folder.
-- To change a code: Table Editor -> hospitals -> join_code.

alter table public.hospitals
    add column if not exists join_code text;

update public.hospitals
    set join_code = upper(substr(md5(random()::text || id), 1, 6))
    where join_code is null or join_code = '';


-- ===================== PART 4: TOKENS AND DOCTOR REVIEWS =====================
-- Token: every appointment gets a token like TRI-1112-07 (hospital,
-- month+day, queue number) that the patient shows at the hospital.
-- Reviews: after a Completed visit a patient can rate the doctor
-- (1 to 5 stars) and write a comment. One review per appointment.

alter table public.bookings
    add column if not exists token text;

create unique index if not exists bookings_token_key
    on public.bookings (token);

create table if not exists public.reviews (
    id               text primary key,                 -- 'review-' + booking id
    booking_id       text not null unique references public.bookings (id) on delete cascade,
    doctor_id        text not null references public.doctors (id) on delete cascade,
    hospital_id      text not null references public.hospitals (id) on delete cascade,
    patient_user_id  uuid references auth.users (id) on delete set null,
    patient_name     text,
    rating           integer not null check (rating between 1 and 5),
    comment          text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists reviews_doctor_idx on public.reviews (doctor_id, created_at desc);

alter table public.reviews enable row level security;
grant all on public.reviews to service_role;
