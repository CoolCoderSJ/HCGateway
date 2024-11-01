# HCGateway
HCGateway is a platform to let developers connect to the Health Connect API on Android via a REST API. You can view the documentation for the REST API [here](https://hcgateway.shuchir.dev/)

The platform consists of two parts:
- A REST API/server
- A mobile application that pings the server periodically

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
- The server encrypts the data using Fernet encryption, then stores it in a database hosted on a custom instance of Appwrite.
- The server exposes an API to let developers login and get the data for their users.

The platform allows two-way sync, which means you can make changes to your local Health Connect store remotely via REST api.

## Get Started
- There is a live instance hosted at https://api.hcgateway.shuchir.dev/ that you can use. You can also host your own instance. To learn more on Self Hosting, skip down to the Self Hosting section.
- You can install the mobile application through the APK file. You can find the latest APK file in the releases section of this repository, or by downloading the `app-release.apk` file from the root of this repository.
- The minimum requirement for the APK file is Android Oreo (8.0)
- Once you install the Android APK file, signup by entering a username and password
- Once you see a screen showing your user id, you have successfully signed up. Your data will sync in 2 hours. This is customizable. You also have the option to force a sync any time through the application.

## Database
### Users Structure
```
users {
    name: string
    password: string
}
```

### Parameters
- `name` - The username of the user
- `password` - The password of the user encrypted using Argon 2 format. The password is never stored as is, and cannot be retrieved through any API.

### Database Structure
```
user_id: string {
    type: string {
        $id: string
        $createdAt: datetime
        $updatedAt: datetime
        $permissions: object
        $databaseId: string
        $collectionId: string
        data: string
        id: string
        start: datetime
        end: datetime
        app: string
    }
}
```

### Parameters
- `$id` - The ID of the object
- `$createdAt` - The date and time the object was added to the database
- `$updatedAt` - The date and time the object was last updated
- `$permissions` - The permissions of the object- will always be []
- `$databaseId` - The ID of the database
- `$collectionId` - The ID of the collection
- `data` - The data of the object encrypted using Fernet. When asked for through the API, the data will be decrypted for you using the user's password found from the user id.
- `id` - The ID of the object- This is the same a  `$id`.
- `start` - The start date and time of the object
- `end` - The end date and time of the object. Might not be present for some objects.
- `app` - The app that the object was synced from.


## REST API
This documentation is also available at https://hcgateway.shuchir.dev/

The REST API is a simple Flask application that exposes the following endpoints:
- `/api/login` - Login a user and get the session ID.
    - Method: `POST`
    - Body Parameters:
        - `username` - The username of the user
        - `password` - The password of the user
    - Response:
        - `sessid` - The user ID of the user

- `/api/sync/<method>` - Dump data into the database. **This method is exclusive to the application, and should not be used otherwise.**
    - Method: `POST`
    - Body Parameters:
        - `user` - The user ID of the user
        - `data` - The data to be dumped. 

- `/api/sync/<method>` - Delete data from the database. **This method is exclusive to the application, and should not be used otherwise.** This method only removes data from the HCGateway database, and not from your local health connect store. This method is only used to clean the database after a local record has already been deleted.
    - Method: `DELETE`
    - Body Parameters:
        - `userid` - The user ID of the user
        - `uuid` - Can be a string or an array of strings and should be the uuid of the object to delete.

- `/api/fetch/<method>` - Get data from the database.
    - Method: `POST`
    - URL Parameters:
        - `method` - The method to use. The methods are listed above, next to each supported data type under the `How It Works` section. For example, to get all blood glucose data, you would use `/api/fetch/bloodGlucose`.
    - Body Parameters:
        - `userid` - The user ID of the user
        - `queries` - This is an optional parameter. You can filter your response if you'd like. The format is an array of strings, where each string is a query. The following are examples of queries-
            - `limit(num)` - Limit the number of results to `num`, where `num` is an integer. `num` must be less than or equal to 100, otherwise all results will be returned.
            - `equal("parameter", ["value"])` - parameter is the name of a parameter; all parameters are listed above, inside of the `type` structure. `value` is an array of values to filter by. For example, `equal("id2", ["id1", "id2"])` will return all objects that have an id of id1 or id2.
            - `notEqual("parameter", ["value"])` - `value` is an array of values to filter by. For example, `notEqual("id2", ["id1", "id2"])` will return all objects that do not have an id of id1 or id2.
            - `lessThan("parameter", ["value(s)"])` - `value` is the value to filter by. For example, `lessThan("id", "id1")` will return all objects that have an id less than id1.
            - `greaterThan("parameter", ["value(s)"])` - `value` is the value to filter by. For example, `greaterThan("id", "id1")` will return all objects that have an id greater than id1.
            - `lessThanEqual("parameter", ["value(s)"])` - `value` is the value to filter by. For example, `lessThanEqual("id", "id1")` will return all objects that have an id less than or equal to id1.
            - `greaterThanEqual("parameter", ["value(s)"])` - `value` is the value to filter by. For example, `greaterThanEqual("id", "id1")` will return all objects that have an id greater than or equal to id1.
            - `search("parameter", ["value"])` - `value` is the value to search for. For example, `search("id", "id1")` will return all objects that have an id that contains id1.
            - `orderDesc("parameter")` - This will order the results in descending order by the parameter. For example, `orderDesc("id")` will return all objects ordered by id in descending order.
            - `orderAsc("parameter")` - This will order the results in ascending order by the parameter. For example, `orderAsc("id")` will return all objects ordered by id in ascending order.
    - Response:
        - `data` - The data retrieved from the database

- `/api/push/<method>` - Insert data into your local Health Connect store. This method does not add the data to the HCGateway database. This method is only used to push data to your local Health Connect store. This is so you can sync + fetch to verify the record has been added.
    - Method: `PUT`
    - URL Parameters:
        - `method` - The method to use. The methods are listed above, next to each supported data type under the `How It Works` section. For example, to push blood glucose data, you would use `/api/push/bloodGlucose`. To update a record, push to this method with the same timestamp as the original record and HCGateway will simply update the existing record.
    - Body Parameters:
        - `userid` - The user ID of the user
        - `data` - The data to be pushed. This can be an object or an array of objects. The format of each object depends on the type of data being inserted. All object structures can be found directly from the [Health Connect documentation](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/package-summary#classes)

- `/api/delete/<method>` - Request deletion for a record. This method does not delete the record from the HCGateway database. This method is only used to request deletion of a record from your local Health Connect store. The app will delete it from the database using the sync method once it has deleted the record(s) locally.
    - Method: `DELETE`
    - URL Parameters:
        - `method` - The method to use. The methods are listed above, next to each supported data type under the `How It Works` section. For example, to delete blood glucose data, you would use `/api/delete/bloodGlucose`.
    - Body Parameters:
        - `userid` - The user ID of the user
        - `uuid` - The UUID of the record to delete. This can be a string or an array of strings.

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
Skip down to the Running with Docker section to learn how to run the server using Docker.

### Manual
#### Server
- You need Python 3 and NodeJS 18+ installed on your machine
- Install appwrite and make sure your instance is accessible from the machine running the HCGateway server. You can find more at https://appwrite.io/
- Clone this repository
- `cd` into the api/ folder
- run `pip install -r requirements.txt`
- rename `.env.example` to `.env` and fill in the values
- Visit the firebase console > project settings > Service accounts and click generate new private key
- Save the file as `service-account.json` in the `api/` folder
- run `python3 main.py` to start the server

#### Mobile Application
To run the mobile application:
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

---
## Running with Docker

 Running via docker is a great way to ensure that you dont run into env issues.
 
To run the HCGateway API using Docker, follow these steps:

1. **Prerequisites**\
    Ensure that you have Docker and Docker Compose installed on your system.

2. **Setting up Environment Variables**

   - You’ll need to configure environment variables before starting the services.
   - Copy the provided `.env.example` file to `.env` inside the `api/` directory and configure it as necessary.

3. **Running the Container (without Docker Compose)**\
    You can run the container directly using the `docker run` command if you prefer not to use Docker Compose:

   ```bash
   docker run -itd \
     -p 6644:6644 \
     --name hcgateway_api \
     --env-file ./api/.env \
     ghcr.io/coolcodersj/hcgateway:latest
   ```

4. **Running the Containers with Docker Compose**\
    The project uses Docker Compose for easier container orchestration. To run the API using Docker Compose, run the following command:
    ```bash
   docker-compose up -d
   ```

6. **Port Configuration**\
    The API is exposed on port `6644`. You can access the API at:

   ```
   http://localhost:6644
   ```
   
7. **Container Management**

   - The container will automatically restart on failures due to the `restart: always` policy.
   - To stop the container, use:

     ```bash
     docker-compose down
     ```

9. **Additional Notes**

   - The Dockerfile uses a Python 3.13 slim image as the base, with all necessary dependencies installed via `requirements.txt`.
   - If any changes are made to the `Dockerfile` or dependencies, rerun the command with the `--build` flag to rebuild the images.
