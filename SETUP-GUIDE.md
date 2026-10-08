# BOOK N MEET - setup guide

The website works in two ways:

- **Server off** - accounts are saved only in the browser you are using.
  Good for a quick demo. Google sign-in and "Forgot password" do not work.
- **Server on** - accounts are saved in your Supabase database, so they
  work on any computer. Google sign-in and "Forgot password" work.

Appointments, doctors, schedules and notifications are still saved in the
browser in both cases. Only accounts (sign up / log in) use the database.


## 1. Open the website

1. Open the project folder in VS Code.
2. Right-click `frontend/landing.html` and choose **Open with Live Server**.
3. The address looks like `http://127.0.0.1:5501/frontend/landing.html`.

Always open the site through Live Server. Do not double-click the file,
because Google sign-in does not work that way.


## 2. Turn the server on

You need the three keys of your Supabase project. Whoever created the
Supabase project can find them in **Project Settings -> API Keys**.

1. In the `backend` folder, make a copy of `.env.example` and name the
   copy `.env`.
2. Open `.env` and paste your three Supabase values. Leave `PORT=5050`.
3. Open a terminal in the `backend` folder and run:

   ```
   npm install
   npm start
   ```

4. You should see `Server running on http://localhost:5050`.
5. Reload the login page. New accounts are now saved in Supabase.

Keep the `.env` file private. It is already listed in `backend/.gitignore`
so it is not uploaded to GitHub.

The port number in `backend/.env` and in `frontend/js/config.js` must be
the same. (Port 5000 is avoided because macOS uses it for AirPlay.)

### The table the server needs

The server saves each account in a table called `profiles`. If it does
not exist yet in your Supabase project, open **SQL Editor** in Supabase
and run this once:

```sql
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  contact text,
  role text not null check (role in ('patient', 'staff')),
  hospital text,
  created_at timestamptz default now()
);
```


## 3. Turn on "Continue with Google"

The button is already on the login and sign up forms. It needs a free
**Google Client ID**, which only you can create.

### a) Create the Client ID

1. Go to https://console.cloud.google.com and sign in.
2. Create a project (any name, for example "Book N Meet").
3. Open **Google Auth Platform**. If it asks, fill in the app name and
   your email, choose **External**, and save.
4. Open **Clients -> Create client** and choose **Web application**.
5. Under **Authorized JavaScript origins** add both of these:
   - `http://localhost:5501`
   - `http://127.0.0.1:5501`
6. Under **Authorized redirect URIs** add the callback address shown on
   the Google provider page in Supabase (step b).
7. Click **Create**. Copy the **Client ID** and the **Client secret**.

### b) Tell Supabase about it

1. In Supabase open **Authentication -> Sign In / Providers -> Google**.
2. Turn it on and paste the Client ID and Client secret. Save.

### c) Tell the website about it

Open `frontend/js/config.js` and paste the Client ID between the quotes:

```js
GOOGLE_CLIENT_ID: "1234567890-abcdefg.apps.googleusercontent.com"
```

Reload the login page (with the server on). The Google button now opens
the Google account chooser. The first time someone uses it, the site asks
for their contact number, role and hospital.

If 5501 is not your Live Server port, use your own port number in step a5.


## 4. Turn on "Forgot your password?"

Supabase sends the reset email. You only need to allow the page the
email link opens:

1. In Supabase open **Authentication -> URL Configuration**.
2. Under **Redirect URLs** add:
   - `http://127.0.0.1:5501/**`
   - `http://localhost:5501/**`

The link in the email opens `reset-password.html`, where the person
types a new password.


## Password rules

A password needs at least 8 characters, a capital letter, a digit and a
special character. These rules let Chrome / Google Password Manager
suggest and save a strong password on the sign up form.


## Where things are

| What | File |
| --- | --- |
| Server address and Google Client ID | `frontend/js/config.js` |
| Hospitals and their details | `frontend/js/hospital-data.js` |
| Doctors of Lalitha and Avideep | `frontend/js/seed-doctors.js` |
| Patient notifications and the bell dot | `frontend/js/patient-notifications.js` |
| Link between patient site and admin site | `frontend/js/site-links.js` |
| Server (sign up, log in, Google, password reset) | `backend/server.js` |
