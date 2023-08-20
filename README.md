# HCGateway
HCGateway is a platform to let developers connect to the Health Connect API on Android via a REST API.

The platform consists of two parts:
- A REST API/server
- A mobile application that pings the server periodically

## How it Works
- The mobile application pings the server every 2 hours to send data. The following data types are supported-
    - Basal Metabolic Rate
    - Blood Glucose
    - Blood Pressure
    - Body Fat
    - Distance
    - Exercise
    - Heart Rate
    - Height
    - Nutrition
    - Oxygen Saturation
    - Power
    - Sleep
    - Speed
    - Steps
    - Total Calories Burned
    - VO2 Max
    - Weight

Support for more types is planned for the future.

- Each sync takes approximatly 15 minutes
- The server encrypts the data using Fernet encryption, then stores it in a database hosted on a custom instance of Appwrite.
- The server exposes an API to let developers login and get the data for their users.

## Get Started
- There is a live instance hosted at https://api.hcgateway.shuchir.dev/ that you can use. You can also host your own instance. To learn more on Self Hosting, skip down to the Self Hosting section.
- You can install the mobile application through the APK file. You can find the latest APK file in the releases section of this repository, or by downloading the `app-release.apk` file from the root of this repository.
- The minimum requirement for the APK file is Android Oreo (8.0)
- Once you install the Android APK file, signup by entering a username and password
- Once you see a screen showing your user id, you have successfully signed up. Your data will sync in 2 hours. You can also force it to start now by going to Settings > Apps > HCGateway > Force Stop, then re-opening the app. This can be done for any time you want to force a sync.

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

- `/api/fetch/<method>` - Get data from the database.
    - Method: `POST`
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

## Mobile Application
The mobile application is a simple Android application that pings the server every 2 hours to send data. It starts a foreground service to do this, and the service will run even if the application is closed. The application is written in React Native.

## Self Hosting
You can self host the server and database. To do this, follow the steps below:
- You need Python 3 and NodeJS 16+ installed on your machine
- Install appwrite and make sure your instance is accessible from the machine running the HCGateway server. You can find more at https://appwrite.io/
- Clone this repository
- `cd` into the api/ folder
- run `pip install -r requirements.txt`
- rename `.env.example` to `.env` and fill in the values
- run `python3 main.py` to start the server
- in another window/tab, `cd` into the app/ folder
- Change lines 104, 112, and 154 of `app/App.js` to point to your HCGateway server
- run `npm install`
- run `npm run android` to start the application, or follow the instructions at https://medium.com/geekculture/react-native-generate-apk-debug-and-release-apk-4e9981a2ea51 to build an APK file.