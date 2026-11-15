# CareSlot - booking concept demo

Concept site + clickable demo for a clinic booking system with three roles:
customers book doctors, doctors accept or auto-accept inside their own time windows,
and trainers/cleaners reset the room after every visit. Admin sees everything and exports CSV.

- `index.html` - story landing page ("The room is ready") with a scroll-driven 3D room (Three.js)
- `app.html` - live demo: sign up + email verification, booking / reschedule / cancel,
  doctor windows, room reset tasks, admin filters and CSV export, email outbox

The demo runs in the browser with sample data (localStorage). Demo accounts use password `demo1234`.
Production build: Laravel + MySQL with a REST API, real email delivery and hashed passwords on the server.

Photos: Unsplash. Video: Pexels.
