# HCGateway
HCGateway is a platform to let developers connect to the Health Connect API on Android via a REST API. You can view the documentation for the REST API [here](https://hcgateway.shuchir.dev/)

The platform consists of two parts:
- A REST API/server
- A mobile application that pings the server periodically

> [!NOTE]
> This project is still in development. The API may change without notice. The mobile application is also in development and may not work as expected. Please report any issues you find.

> [!IMPORTANT]
> The database was recently migrated from Appwrite to MongoDB. If you were using the Appwrite version, you will need to migrate your data to the new database. You can find the migration script in the `scripts/` folder. You will need to install the `appwrite` and `pymongo` libraries to run the script, then run the script with the following command: `python3 migrate_1.5.0.py`.

> [!WARNING]
> v1 routes for the server are now deprecated and will be removed by March 4th, 2025 (90 days) for security reasons. Please update your applications to use the v2 routes. You can find the documentation for the v2 routes [here](https://hcgateway.shuchir.dev/)

## How it Works
- The mobile application pings the server every 2 hours to send data. The following data types are supported-
    - Active Calories Burned (`activeCaloriesBurned`)
    - Basal Body Temperature (`basalBodyTemperature`)
    - Basal Metabolic Rate (`basalMetabolicRate`)
    - Blood Glucose (`bloodGlucose`)
    - Blood Pressure (`bloodPressure`)
    - Body Fat (`bodyFat`)
    - Body Temperature (`bodyTemperature`)
    - Bone Mass (`boneMass`)
    - Cervical Mucus (`cervicalMucus`)
    - Distance (`distance`)
    - Exercise (`exerciseSession`)
    - Elevation Gained (`elevationGained`)
    - Floors Climbed (`floorsClimbed`)
    - Heart Rate (`heartRate`)
    - Height (`height`)
    - Hydration (`hydration`)
    - Lean Body Mass (`leanBodyMass`)
    - Menstruation Flow (`menstruationFlow`)
    - Menstruation Period (`menstruationPeriod`)
    - Nutrition (`nutrition`)
    - Ovulation Test (`ovulationTest`)
    - Oxygen Saturation (`oxygenSaturation`)
    - Power (`power`)
    - Respiratory Rate (`respiratoryRate`)
    - Resting Heart Rate (`restingHeartRate`)
    - Sleep (`sleepSession`)
    - Speed (`speed`)
    - Steps (`steps`)
    - StepsCadence (`stepsCadence`)
    - Total Calories Burned (`totalCaloriesBurned`)
    - VO2 Max (`vo2Max`)
    - Weight (`weight`)
    - Wheelchair Pushes (`wheelchairPushes`)

Support for more types is planned for the future.

- Each sync takes approximatly 15 minutes
- The server encrypts the data using Fernet encryption, then stores it in a mongo database.
- The server exposes an API to let developers login and get the data for their users.

The platform allows two-way sync, which means you can make changes to your local Health Connect store remotely via REST api.

## Get Started
- There is a live instance hosted at https://api.hcgateway.shuchir.dev/ that you can use. You can also host your own instance. To learn more on Self Hosting, skip down to the Self Hosting section.
- You can install the mobile application through the APK file. You can find the latest APK file in the releases section of this repository.
- The minimum requirement for the APK file is Android Oreo (8.0)
- Once you install the Android APK file, signup by entering a username and password
- Once you see a screen showing your user id, you have successfully signed up. Your data will sync in 2 hours. This is customizable. You also have the option to force a sync any time through the application.

## Database
### Users Structure
```
users {
    _id: string
    username: string
    password: string
    fcmToken: string
    expiry: datetime
    token: string
    refresh: string
}
```
> [!NOTE]
> The password of the user encrypted using Argon 2 format. The password is never stored as is, and cannot be retrieved through any API.

### Database Structure
```
hcgateway_[user_id]: string {
    dataType: string {
        _id: string
        data: string
        id: string
        start: datetime
        end: datetime
        app: string
    }
}
```

### Parameters
- `$id` - The ID of the object. 
- `data` - The data of the object encrypted using Fernet. When asked for through the API, the data will be decrypted for you using the user's hashed password found from the user id.
- `id` - The ID of the object- This is the same as `_id` and is only kept for backward compatibility. May be removed in future versions.
- `start` - The start date and time of the object
- `end` - The end date and time of the object. Might not be present for some objects.
- `app` - The app package string that the object was synced from.


## REST API
The documentation for the REST API can be found at https://hcgateway.shuchir.dev/

## Mobile Application
The mobile application is a simple Android application that pings the server every 2 hours (customizable) to send data. It starts a foreground service to do this, and the service will run even if the application is closed. The application is written in React Native.

## Self Hosting
You can self host the server and database for full control. However, if you'd like to push from your own server, you must build the mobile application yourself. You can find the instructions to build the mobile application below. This is because the app is packaged with the firebase key, and cannot change it dynamically. Again, firebase is only necessary if you want to push from your own server.
### Firebase
Follow these steps to set up Firebase:
1. Create a new Firebase project at https://console.firebase.google.com/
2. Add an Android app to the project
3. Download the `google-services.json` file and place it in the `firebase/` folder as well as the `android/app/` folder

### Docker (recommended)
1. **Prerequisites**\
    Ensure that you have Docker and Docker Compose installed on your system.

2. **Setting up Environment Variables**

   - You’ll need to configure environment variables before starting the services.
   - Copy the provided `.env.example` file to `.env` inside the `api/` directory and configure it as necessary. When setting the `MONGO_URI` variable, the following format should be used: `mongodb://<username>:<password>@db:27017/hcgateway?authSource=admin`
   - Set the mongo DB username and password in the `docker-compose.yml` file as well.

3. **Running the Containers with Docker Compose**\
    The project uses Docker Compose for easier container orchestration. To run the API using Docker Compose, run the following command:
    ```bash
   docker-compose up -d
   ```
You can access the API at `http://localhost:6644`

### Manual
#### Server
- Prerequisites: Python 3, mongoDB
- Clone this repository
- `cd` into the api/ folder
- run `pip install -r requirements.txt`
- rename `.env.example` to `.env` and fill in the values
- Visit the firebase console > project settings > Service accounts and click generate new private key
- Save the file as `service-account.json` in the `api/` folder
- run `python3 main.py` to start the server

#### Mobile Application
- Prerequisites: Node.js 18+, npm, Android Studio (SDK, build-tools, platform-tools), Java 17
- in another window/tab, `cd` into the app/ folder
- run `npm install`
- If you wish to remove sentry:
```
yarn remove @sentry/react-native
npx @sentry/wizard -i reactNative -p android --uninstall
```
- If you wish to change sentry to your own instance:
    - Change the `dsn` in `App.js` to your own DSN
    - Change the server, org name, and project name in app.json
    - Change these details again in android/sentry.properties
    - Change the DSN in the AndroidManifest.xml
- run `npx patch-package` to apply a patch to the foreground service library
- run `npm run android` to start the application, or `cd android && ./gradlew assembleRelease` to build the APK file
    - It is also possible to now use eas build to build the APK file. You can find more at https://docs.expo.dev/build/eas-build/ **NOTE: This must be a local build, since you need to run patch-package before building the APK file.**
