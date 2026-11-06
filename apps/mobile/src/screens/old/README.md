# Archived mobile screens

Previous authentication, landing, customer, staff, notification and demo screens are kept here
for reference. Their legacy routes and supporting view code remain archived with them.

The active application does not import this folder. Navigation uses the new authentication
screens and the separate customer home, appointments and appointment-detail screens.
Staff and offline-demo sessions retain the temporary account screen.
Payment and booking destinations in this archive are not registered in the active navigator.


Some exported helpers/types outside this folder are still imported by archived screens. They
carry a scoped `@lintignore` annotation for Knip until this archive is cleaned up. Keep these
exports while the archive is type-checked; this does not register the old routes in the app.
