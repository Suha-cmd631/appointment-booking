# BOOK N MEET - setup guide

Everything the website saves (accounts, hospitals, doctors, doctor
schedules, appointments, notifications, hospital settings) is stored in
your **Supabase database**. The **backend server** (`backend` folder) is
the only thing that talks to the database, and it checks every change:

- Patients can book, see their own appointments and edit their own profile.
- Hospital staff can only see and change their own hospital: its
  appointments, doctors, schedules, notifications and details.
- People who are not logged in can only see hospitals, doctors and which
  time slots are already taken (never other patients' names or numbers).

So the site needs two things running: **the server** and **the website**.


## 1. One-time setup

### a) Supabase keys

You need the three keys of your Supabase project. Whoever created the
project finds them in Supabase under **Project Settings -> API Keys**
(and the project URL under **Project Settings -> Data API**).

1. In the `backend` folder, make a copy of `.env.example` and name the
   copy `.env`.
2. Open `.env` and paste the three values. Leave `PORT=5050`.

Keep `.env` private. It is listed in `backend/.gitignore`, so it is never
uploaded to GitHub.

### b) Create the tables

1. In Supabase open **SQL Editor -> New query**.
2. Open `backend/database/setup.sql`, copy everything, paste it, press **Run**.

This creates all the tables and adds the 5 hospitals with their doctors.
It is safe to run again (nothing is added twice, nothing is deleted).

### c) Install the server

Open a terminal in the `backend` folder and run:

```
npm install
```


## 2. Every time you work on the project

In a terminal in the main `appointment-booking` folder type:

```
npm run dev
```

This starts the server and the website together and opens the home
page (`landing.html`) in your browser. From there you move through all
pages with the menu. Leave the terminal open; press **Ctrl + C** to stop.

(Stop VS Code's Live Server first if it is running - both use port 5501.)

If the server is not running, pages show a small yellow note
"Can't reach the server - showing the last saved data", and nothing can
be saved until the server is back.

The port number in `backend/.env` and in `frontend/js/config.js` must be
the same (5050). Port 5000 is avoided because macOS uses it for AirPlay.


## 3. First accounts and staff join codes

Every hospital has a secret **join code**. Anyone signing up as
**Hospital Staff** must type their hospital's code, so strangers cannot
make a staff account and see patients' details.

- **See the codes (first time):** in the `backend` folder run
  `node check-accounts.js`. It lists every account and every hospital's code.
- **After that:** any staff member sees their own hospital's code on the
  admin **Settings** page and can give it to new colleagues.
- **Change a code:** Supabase -> Table Editor -> `hospitals` -> `join_code`.

Then:

- **Hospital staff:** Sign up -> Role "Hospital Staff" -> choose the
  hospital -> type the join code.
- **Patients:** Sign up -> Role "Patient" (no code needed).

If you ran `setup.sql` before join codes existed, run it once more
(Supabase -> SQL Editor). It only adds what is missing.


## 4. Optional: "Continue with Google"

The button is already on the login and sign up forms. It needs a free
**Google Client ID**, which only you can create.

1. Go to https://console.cloud.google.com, create a project, open
   **Google Auth Platform** and fill in the app name and your email.
2. Open **Clients -> Create client -> Web application**.
3. Under **Authorized JavaScript origins** add `http://localhost:5501`
   and `http://127.0.0.1:5501`.
4. Under **Authorized redirect URIs** add the callback address shown on
   Supabase's Google provider page (step 6).
5. Click **Create**; copy the **Client ID** and **Client secret**.
6. In Supabase open **Authentication -> Sign In / Providers -> Google**,
   turn it on, paste both values and save.
7. Paste the Client ID into `frontend/js/config.js`:

   ```js
   GOOGLE_CLIENT_ID: "1234567890-abcdefg.apps.googleusercontent.com"
   ```


## 5. Optional: "Forgot your password?"

Supabase sends the reset email. Allow the page the email link opens:
in Supabase open **Authentication -> URL Configuration** and under
**Redirect URLs** add `http://127.0.0.1:5501/**` and `http://localhost:5501/**`.


## Password rules

At least 8 characters, a capital letter, a digit and a special character.


## Where things are

| What | File |
| --- | --- |
| Database tables + the 5 hospitals and their doctors | `backend/database/setup.sql` |
| Server: accounts (sign up, log in, Google, password reset) | `backend/server.js` |
| Server: hospitals, doctors, schedules, appointments, notifications | `backend/data.js` |
| `npm run dev` (starts server + website, opens browser) | `backend/dev.js` |
| Server address and Google Client ID | `frontend/js/config.js` |
| Connection between every page and the server | `frontend/js/sync.js` |
| Shared hospital/doctor helper functions | `frontend/js/hospital-data.js` |
| Patient notifications and the bell dot | `frontend/js/patient-notifications.js` |
| Admin menu bar look / behaviour | `frontend/css/admin-common.css`, `frontend/js/admin-header.js` |
| Link between patient site and admin site | `frontend/js/site-links.js` |

Hospital details are changed by that hospital's staff on the admin
**Settings** page. Doctors are added and removed on the admin **Doctors** page.
