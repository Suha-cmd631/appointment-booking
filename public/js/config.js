/*
  BOOK N MEET - settings

  This is the only file you need to edit to connect the website
  to the backend server and to Google sign-in.
  See SETUP-GUIDE.md in the project folder for the steps.
*/

window.BNM_CONFIG = {

    /*
      Address of the backend server (backend/server.js).
      - On your laptop (npm run dev, website on port 5501) the server
        is on port 5050 - the same number as PORT in backend/.env.
      - Online (Render) the server and the website share one address,
        so nothing needs changing here.
    */
    API_URL: (window.location.protocol === "file:" ||
              (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && window.location.port !== "5050"))
        ? "http://localhost:5050"
        : window.location.origin,

    /*
      Google Client ID for the "Continue with Google" button.
      Looks like: 1234567890-abcdefg.apps.googleusercontent.com
      Leave it empty ("") until you have created one.
    */
    GOOGLE_CLIENT_ID: ""
};
