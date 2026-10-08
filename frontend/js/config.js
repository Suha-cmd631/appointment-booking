/*
  BOOK N MEET - settings

  This is the only file you need to edit to connect the website
  to the backend server and to Google sign-in.
  See SETUP-GUIDE.md in the project folder for the steps.
*/

window.BNM_CONFIG = {

    /*
      Address of the backend server (backend/server.js).
      The port number here must be the same as PORT in backend/.env
    */
    API_URL: "http://localhost:5050",

    /*
      Google Client ID for the "Continue with Google" button.
      Looks like: 1234567890-abcdefg.apps.googleusercontent.com
      Leave it empty ("") until you have created one.
    */
    GOOGLE_CLIENT_ID: ""
};
