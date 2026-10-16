# ElderCare

Caring for those who cared for us.

ElderCare is an Android app that helps senior citizens manage their daily care and keeps their family and helpers connected. Seniors get a simple, large-text app for medicines, meals and emergencies. Family members can look after them from anywhere and step in when they are needed.

## Why ElderCare

Many seniors in India live alone or spend most of the day by themselves while their children work in other cities. Common problems include:

- Forgetting to take medicines on time, or not noticing when stock is running out
- No quick way to call for help in an emergency
- Difficulty with errands such as buying medicines, paying bills or getting blood tests
- Low awareness of government schemes meant for senior citizens
- Apps that are too complex, with small text and English-only screens

ElderCare addresses these in one app, designed around how seniors actually use phones and connected to the family through the cloud.

## User Roles

Every account chooses one role at sign-up. Each role has its own home screen and navigation.

| Role | Who it is for | Main screens |
|---|---|---|
| Senior | The senior citizen, with large text and simple buttons | Home (SOS, next medicine), Medicines, Food Plan, Audio, Schemes, Records |
| Family Member | Relatives looking after the senior, even from another city | Overview (alerts and SOS), Helpers, Medicines, Food, Records, Settings |
| Helper | A trusted person who runs errands for seniors | Home (new requests), My Tasks, Settings |

## Features

### Senior Home Screen

- A greeting based on the time of day (good morning, afternoon or evening)
- The next medicine due, with its dosage and time
- A large SOS button for emergencies
- A Call Family button that opens the phone dialer with a family member's number ready
- The status of the latest helper booking
- An A+ button to make text larger

### Medicine Reminders

- Family members add medicines with:
  - Name and dosage
  - One or more daily times
  - Total stock and minimum stock level
  - Expiry date
  - Number of days to keep reminding
- Seniors see today's doses and mark each one as taken
- Each dose shows its current state:
  - **Upcoming**: before the scheduled time
  - **Due now**: from the scheduled time up to 60 minutes after
  - **Missed**: more than 60 minutes late and still not taken
  - **Taken**: marked as taken by the senior
- The senior gets a notification when a dose is due
- Family members are notified when a dose is missed
- Stock alerts for low stock and out of stock, with a reminder to refill
- Expiry alerts for medicines that expire within 7 days or have already expired
- Family members can edit a medicine, update its stock or delete it

### Emergency SOS

- When the senior presses SOS, the app captures their current location and alerts their family
- Family members see a full-screen alert with an alarm, the senior's name and an Open in Maps button for their location
- The alert goes to family members one at a time. If the current person does not respond within 60 seconds, it moves on to the next person
- A family member can tap I'm Responding to let the senior know help is coming, or call the senior directly
- The senior's screen shows who is being notified and who is on the way
- The senior can tap I'm OK to cancel the alert if it was pressed by mistake

### Linking Family to a Senior

- A family member links to a senior by entering the senior's 10-digit phone number
- The app checks that the number belongs to a registered senior before linking
- Linked family members are added to the senior's emergency contacts automatically, so they receive SOS alerts
- A family member can link more than one senior and see them all in Settings

### Book a Helper

- Family members can book a trusted helper for one or more tasks at once:
  - Buy medicines (with the quantity needed)
  - Get groceries
  - Pay bills
  - Doctor appointment
  - Blood test or lab work
  - Pharmacy run
  - Accompany the senior
  - Other tasks
- Each booking includes a date, time, the senior's home address and an optional note
- Helpers see new bookings on their home screen and can accept or decline them
- Helpers can call the senior directly from the booking
- A booking moves through clear stages: booked, accepted, in progress and completed
- The helper uploads a photo as proof when a task is done, and the family can view it
- After completion, the family can rate the helper from 1 to 5 stars and leave a review
- Ratings shown are real averages from completed bookings only

### Healthy Recipes

- About 30 senior-friendly Indian recipes, each with ingredients, serving size and step-by-step instructions
- Filter by:
  - **Meal**: breakfast, lunch, evening snack or dinner
  - **Cooking time**: under 15, 30 or 45 minutes
  - **Diet**: vegetarian, eggetarian or non-vegetarian
- Save allergies once (for example milk, eggs, peanuts, nuts or fish). Any recipe containing them is hidden automatically, including common Indian names for the same ingredient, such as dahi, paneer and ghee for milk
- Recipe names and instructions are available in English and Hindi

### Government Scheme Navigator

- The senior answers four quick questions: age, gender, whether they have a BPL or ration card, and whether they already receive a pension
- The app then shows which schemes they are likely eligible for, and explains why
- All schemes can also be browsed and searched, grouped by category: Pension, Health, Finance and Legal
- Each scheme has a short plain-language description and a link to apply on the official website
- Covers schemes such as the Senior Citizens Savings Scheme, Jeevan Pramaan, Ayushman Bharat, Pradhan Mantri Jan Dhan Yojana and the Elderline 14567 helpline

### Health Records

- Family members upload medical documents by taking a photo or choosing a file
- Record types include prescription, lab report, blood test, X-ray or scan, discharge summary, doctor's note, vaccination, insurance and bill or invoice
- Each record can include the doctor's name
- Photos are compressed before upload to save mobile data
- The senior can view all records uploaded by their family

### Audio Rooms

One-tap access to YouTube collections chosen for seniors:

- **Devotional**: morning bhajans, Krishna bhajans, Ganesh aarti, Hanuman Chalisa
- **Music**: old Hindi songs, Kishore Kumar, Lata Mangeshkar, Mohammed Rafi
- **Health**: gentle yoga, pranayama breathing exercises, walking and stretching
- **Talks and stories**: Hindi motivational talks, Sandeep Maheshwari, Gaur Gopal Das, Hindi stories
- **News**: Hindi news live and DD News

### Designed for Seniors

- Large text by default, with a button to make it even bigger
- A simple mode with large buttons and clear icons
- Bottom navigation with labels on every button
- Full support for English and Hindi, which can be changed at any time
- A one-time permission screen that explains in plain words why location and notifications are needed

## How It Works

### Sign-up and login

Users sign up with their name, 10-digit phone number, password and role. Behind the scenes, the phone number is used to create a Firebase Authentication account, so users only need to remember their phone number and password. Each phone number is also registered with its role, which is how family members find a senior by phone number.

### Cloud sync

Accounts, SOS alerts, helper bookings, proof photos and linked family members are stored in Cloud Firestore. The app listens for changes, so when a senior presses SOS or a helper accepts a booking, the other phones update within seconds.

### Offline support

Medicines, recipes and other data are also saved on the device, so the senior can still see them on a weak or missing internet connection.

## Tech Stack

| Layer | Technology |
|---|---|
| User interface | HTML, CSS and vanilla JavaScript (no framework) |
| Android app | Capacitor 8 |
| Native features | Capacitor Geolocation, Local Notifications and Browser plugins |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| File storage | Firebase Storage for helper proof photos |
| Icons | Font Awesome |

## Project Structure

```
eldercare-apk/
  www/                         The web app that runs inside the Android app
    index.html                 Single page containing all screens
    manifest.json              App name, colours and icons
    service-worker.js          Caching for offline use
    css/
      variables.css            Colours, spacing and font sizes
      base.css                 Base layout and typography
      components.css           Buttons, cards, forms and other shared parts
      login.css                Login and sign-up screens
      senior.css               Senior screens
      caregiver.css            Helper screens
      fixes.css                Device-specific layout fixes
    js/
      firebase-config.js       Firebase project settings
      app.js                   App start-up, screens, bookings and records
      auth.js                  Login, sign-up, roles and senior linking
      roles.js                 Navigation for each role
      medicines.js             Medicine list, dose status, reminders and stock alerts
      sos.js                   Emergency SOS and family alerts
      caregiver.js             Helper screens, task status and proof uploads
      food.js                  Healthy recipes, filters and allergy matching
      schemes.js               Government scheme navigator and eligibility
      language.js              English and Hindi switching
      locales-inline.js        Built-in translations
      ui.js                    Notifications and shared UI helpers
    locales/                   Translation files
    data/
      schemes.json             Government scheme details
      dietData.json            Food guidance data
    assets/                    Logo and app icons
  android/                     Native Android project generated by Capacitor
  capacitor.config.json        App ID (com.eldercare.app), app name and web folder
  firestore.rules              Firestore security rules
  package.json                 Project dependencies
```

## Getting Started

### Requirements

- Node.js (LTS version)
- Android Studio
- JDK 17
- A Firebase project
- An Android phone or emulator running Android 6.0 or later

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/Prekshakothari12/eldercare-apk.git
cd eldercare-apk
npm install
```

### 2. Set up Firebase

1. Go to the Firebase Console and create a new project.
2. Add a **Web app** to the project and copy the configuration it shows.
3. Paste the configuration into `www/js/firebase-config.js`.
4. Open **Authentication**, go to **Sign-in method**, and enable **Email/Password** and **Anonymous**.
5. Open **Firestore Database** and create a database.
6. In Firestore, go to the **Rules** tab, paste the contents of `firestore.rules` and click **Publish**.
7. Optional: enable **Storage** so helper proof photos are stored there.

### 3. Build and run on Android

```bash
npx cap sync android
npx cap open android
```

The first command copies the web app from `www` into the Android project. The second opens the Android project in Android Studio.

In Android Studio:

1. Wait for Gradle to finish syncing.
2. Connect an Android phone with USB debugging turned on, or start an emulator.
3. Click **Run**.

### 4. Create an APK

In Android Studio, go to **Build**, then **Build App Bundle(s) / APK(s)**, then **Build APK(s)**.

The debug APK is saved at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

This file can be copied to any Android phone and installed directly. To publish on the Google Play Store, create a signed release build using **Build**, then **Generate Signed Bundle / APK**.

## Development Workflow

1. Make changes to files inside the `www` folder.
2. Run `npx cap sync android` to copy the changes into the Android project.
3. Run the app again from Android Studio to test.

Do not edit files inside `android/app/src/main/assets/public` directly. That folder is replaced with the contents of `www` every time `npx cap sync` runs.

### Testing the full flow

To test how the roles work together, use two phones, or a phone and an emulator:

1. Create a **Senior** account on the first device.
2. Create a **Family Member** account on the second device and link it using the senior's phone number.
3. Press SOS on the senior's device and check that the alert appears on the family device.
4. Book a helper from the family device, then log in as a **Helper** to accept and complete the task.

## Android Permissions

| Permission | Why it is needed |
|---|---|
| Internet | Sync data with family members through Firebase |
| Location (fine and coarse) | Share the senior's location during an SOS only |
| Notifications | Show medicine reminders and SOS alerts |
| Exact alarms | Deliver medicine reminders at the correct time |
| Run at startup | Restore scheduled reminders after the phone restarts |
| Vibrate | Vibrate the phone for reminders and SOS alerts |
