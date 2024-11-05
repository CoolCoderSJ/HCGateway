import { StyleSheet, Text, View, TextInput, Button, Switch } from 'react-native';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  initialize,
  requestPermission,
  readRecords,
  readRecord,
  insertRecords,
  deleteRecordsByUuids
} from 'react-native-health-connect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import {requestNotifications} from 'react-native-permissions';
import * as Sentry from '@sentry/react-native';
import messaging from '@react-native-firebase/messaging';
import {Notifications} from 'react-native-notifications';

const setObj = async (key, value) => { try { const jsonValue = JSON.stringify(value); await AsyncStorage.setItem(key, jsonValue) } catch (e) { console.log(e) } }
const setPlain = async (key, value) => { try { await AsyncStorage.setItem(key, value) } catch (e) { console.log(e) } }
const get = async (key) => { try { const value = await AsyncStorage.getItem(key); if (value !== null) { try { return JSON.parse(value) } catch { return value } } } catch (e) { console.log(e) } }
const delkey = async (key, value) => { try { await AsyncStorage.removeItem(key) } catch (e) { console.log(e) } }
const getAll = async () => { try { const keys = await AsyncStorage.getAllKeys(); return keys } catch (error) { console.error(error) } }

Notifications.setNotificationChannel({
  channelId: 'push-errors',
  name: 'Push Errors',
  importance: 5,
  description: 'Alerts for push errors',
  groupId: 'push-errors',
  groupName: 'Errors',
  enableLights: true,
  enableVibration: true,
  showBadge: true,
  vibrationPattern: [200, 1000, 500, 1000, 500],
})

let isSentryEnabled = true;
get('sentryEnabled')
  .then(res => {
    if (res != "false") {
      Sentry.init({
        dsn: 'https://e4a201b96ea602d28e90b5e4bbe67aa6@sentry.shuchir.dev/6',
        // enableSpotlight: __DEV__,
      });
      Toast.show({
        type: 'success',
        text1: "Sentry enabled from settings",
      });
    } else {
      isSentryEnabled = false;
      Toast.show({
        type: 'info',
        text1: "Sentry is disabled",
      });
    }
  })
  .catch(err => {
    console.log(err);
    Toast.show({
      type: 'error',
      text1: "Failed to check Sentry settings",
    });
  });
ReactNativeForegroundService.register();

const requestUserPermission = async () => {
  try {
    await messaging().requestPermission();
    const token = await messaging().getToken();
    console.log('Device Token:', token);
    return token;
  } catch (error) {
    console.log('Permission or Token retrieval error:', error);
  }
};

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage.data.op == "PUSH") handlePush(remoteMessage.data);
  if (remoteMessage.data.op == "DEL") handleDel(remoteMessage.data);
});

messaging().onMessage(remoteMessage => {
  if (remoteMessage.data.op == "PUSH") handlePush(remoteMessage.data);
  if (remoteMessage.data.op == "DEL") handleDel(remoteMessage.data);
});

let login;
let apiBase = 'https://api.hcgateway.shuchir.dev';
let lastSync = null;
let taskDelay = 7200 * 1000; // 2 hours

Toast.show({
  type: 'info',
  text1: "Loading API Base URL...",
  autoHide: false
})
get('apiBase')
.then(res => {
  if (res) {
    apiBase = res;
    Toast.hide();
    Toast.show({
      type: "success",
      text1: "API Base URL loaded",
    })
  }
  else {
    Toast.hide();
    Toast.show({
      type: "error",
      text1: "API Base URL not found. Using default server.",
    })
  }
})

get('login')
.then(res => {
  if (res) {
    login = res;
  }
})

get('lastSync')
.then(res => {
  if (res) {
    lastSync = res;
  }
})


const askForPermissions = async () => {
  const isInitialized = await initialize();

  const grantedPermissions = await requestPermission([
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'BasalBodyTemperature' },
    { accessType: 'read', recordType: 'BloodGlucose' },
    { accessType: 'read', recordType: 'BloodPressure' },
    { accessType: 'read', recordType: 'BasalMetabolicRate' },
    { accessType: 'read', recordType: 'BodyFat' },
    { accessType: 'read', recordType: 'BodyTemperature' },
    { accessType: 'read', recordType: 'BoneMass' },
    { accessType: 'read', recordType: 'CyclingPedalingCadence' },
    { accessType: 'read', recordType: 'CervicalMucus' },
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ElevationGained' },
    { accessType: 'read', recordType: 'FloorsClimbed' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Height' },
    { accessType: 'read', recordType: 'Hydration' },
    { accessType: 'read', recordType: 'LeanBodyMass' },
    { accessType: 'read', recordType: 'MenstruationFlow' },
    { accessType: 'read', recordType: 'MenstruationPeriod' },
    { accessType: 'read', recordType: 'Nutrition' },
    { accessType: 'read', recordType: 'OvulationTest' },
    { accessType: 'read', recordType: 'OxygenSaturation' },
    { accessType: 'read', recordType: 'Power' },
    { accessType: 'read', recordType: 'RespiratoryRate' },
    { accessType: 'read', recordType: 'RestingHeartRate' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'Speed' },
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'StepsCadence' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'Vo2Max' },
    { accessType: 'read', recordType: 'Weight' },
    { accessType: 'read', recordType: 'WheelchairPushes' },
    { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'write', recordType: 'BasalBodyTemperature' },
    { accessType: 'write', recordType: 'BloodGlucose' },
    { accessType: 'write', recordType: 'BloodPressure' },
    { accessType: 'write', recordType: 'BasalMetabolicRate' },
    { accessType: 'write', recordType: 'BodyFat' },
    { accessType: 'write', recordType: 'BodyTemperature' },
    { accessType: 'write', recordType: 'BoneMass' },
    { accessType: 'write', recordType: 'CyclingPedalingCadence' },
    { accessType: 'write', recordType: 'CervicalMucus' },
    { accessType: 'write', recordType: 'ExerciseSession' },
    { accessType: 'write', recordType: 'Distance' },
    { accessType: 'write', recordType: 'ElevationGained' },
    { accessType: 'write', recordType: 'FloorsClimbed' },
    { accessType: 'write', recordType: 'HeartRate' },
    { accessType: 'write', recordType: 'Height' },
    { accessType: 'write', recordType: 'Hydration' },
    { accessType: 'write', recordType: 'LeanBodyMass' },
    { accessType: 'write', recordType: 'MenstruationFlow' },
    { accessType: 'write', recordType: 'MenstruationPeriod' },
    { accessType: 'write', recordType: 'Nutrition' },
    { accessType: 'write', recordType: 'OvulationTest' },
    { accessType: 'write', recordType: 'OxygenSaturation' },
    { accessType: 'write', recordType: 'Power' },
    { accessType: 'write', recordType: 'RespiratoryRate' },
    { accessType: 'write', recordType: 'RestingHeartRate' },
    { accessType: 'write', recordType: 'SleepSession' },
    { accessType: 'write', recordType: 'Speed' },
    { accessType: 'write', recordType: 'Steps' },
    { accessType: 'write', recordType: 'StepsCadence' },
    { accessType: 'write', recordType: 'TotalCaloriesBurned' },
    { accessType: 'write', recordType: 'Vo2Max' },
    { accessType: 'write', recordType: 'Weight' },
    { accessType: 'write', recordType: 'WheelchairPushes' },
  ]);

  console.log(grantedPermissions);

  if (grantedPermissions.length < 68) {
    Toast.show({
      type: 'error',
      text1: "Permissions not granted",
      text2: "Please visit settings to grant all permissions."
    })
  }
};

const refreshTokenFunc = async () => {
  let refreshToken = await get('refreshToken');
  if (!refreshToken) return;
  try {
    let response = await axios.post(`${apiBase}/api/v2/refresh`, {
      refresh: refreshToken
    });
    if ('token' in response.data) {
      console.log(response.data);
      await setPlain('login', response.data.token)
      login = response.data.token;
      await setPlain('refreshToken', response.data.refresh);
      Toast.show({
        type: 'success',
        text1: "Token refreshed successfully",
      })
    }
    else {
      Toast.show({
        type: 'error',
        text1: "Token refresh failed",
        text2: response.data.error
      })
      login = null;
      delkey('login');
    }
  }

  catch (err) {
    Toast.show({
      type: 'error',
      text1: "Token refresh failed",
      text2: err.message
    })
    login = null;
    delkey('login');
  }
}

const sync = async () => {
  const isInitialized = await initialize();
  console.log("Syncing data...");
  let numRecords = 0;
  let numRecordsSynced = 0;
  Toast.show({
    type: 'info',
    text1: "Syncing data...",
  })
  await setPlain('lastSync', new Date().toISOString());
  lastSync = new Date().toISOString();

  let recordTypes = ["ActiveCaloriesBurned", "BasalBodyTemperature", "BloodGlucose", "BloodPressure", "BasalMetabolicRate", "BodyFat", "BodyTemperature", "BoneMass", "CyclingPedalingCadence", "CervicalMucus", "ExerciseSession", "Distance", "ElevationGained", "FloorsClimbed", "HeartRate", "Height", "Hydration", "LeanBodyMass", "MenstruationFlow", "MenstruationPeriod", "Nutrition", "OvulationTest", "OxygenSaturation", "Power", "RespiratoryRate", "RestingHeartRate", "SleepSession", "Speed", "Steps", "StepsCadence", "TotalCaloriesBurned", "Vo2Max", "Weight", "WheelchairPushes"]; 
  
  for (let i = 0; i < recordTypes.length; i++) {
      let records;
      try {
      records = await readRecords(recordTypes[i],
        {
          timeRangeFilter: {
            operator: "between",
            startTime: String(new Date(new Date().setDate(new Date().getDate() - 29)).toISOString()),
            endTime: String(new Date().toISOString())
          }
        }
      );

      records = records.records;
      }
      catch (err) {
        console.log(err)
        continue;
      }
      console.log(recordTypes[i]);
      numRecords += records.length;

      if (['SleepSession', 'Speed', 'HeartRate'].includes(recordTypes[i])) {
        console.log("INSIDE IF - ", recordTypes[i])
        for (let j=0; j<records.length; j++) {
          console.log("INSIDE FOR", j, recordTypes[i])
          setTimeout(async () => {
            try {
              let record = await readRecord(recordTypes[i], records[j].metadata.id);
              await axios.post(`${apiBase}/api/v2/sync/${recordTypes[i]}`, {
                data: record
              }, {
                headers: {
                  "Authorization": `Bearer ${login}`
                }
              })
            }
            catch (err) {
              console.log(err)
            }

            numRecordsSynced += 1;
            try {
            ReactNativeForegroundService.update({
              id: 1244,
              title: 'HCGateway Sync Progress',
              message: `HCGateway is currently syncing... [${numRecordsSynced}/${numRecords}]`,
              icon: 'ic_launcher',
              setOnlyAlertOnce: true,
              color: '#000000',
              progress: {
                max: numRecords,
                curr: numRecordsSynced,
              }
            })

            if (numRecordsSynced == numRecords) {
              ReactNativeForegroundService.update({
                id: 1244,
                title: 'HCGateway Sync Progress',
                message: `HCGateway is working in the background to sync your data.`,
                icon: 'ic_launcher',
                setOnlyAlertOnce: true,
                color: '#000000',
              })
            }
            }
            catch {}
          }, j*3000)
        }
      }

      else {
        await axios.post(`${apiBase}/api/v2/sync/${recordTypes[i]}`, {
          data: records
        }, {
          headers: {
            "Authorization": `Bearer ${login}`
          }
        });
        numRecordsSynced += records.length;
        try {
        ReactNativeForegroundService.update({
          id: 1244,
          title: 'HCGateway Sync Progress',
          message: `HCGateway is currently syncing... [${numRecordsSynced}/${numRecords}]`,
          icon: 'ic_launcher',
          setOnlyAlertOnce: true,
          color: '#000000',
          progress: {
            max: numRecords,
            curr: numRecordsSynced,
          }
        })

        if (numRecordsSynced == numRecords) {
          ReactNativeForegroundService.update({
            id: 1244,
            title: 'HCGateway Sync Progress',
            message: `HCGateway is working in the background to sync your data.`,
            icon: 'ic_launcher',
            setOnlyAlertOnce: true,
            color: '#000000',
          })
        }
        }
        catch {}
      }
  }
}

const handlePush = async (message) => {
  const isInitialized = await initialize();
  
  let data = JSON.parse(message.data);
  console.log(data);

  insertRecords(data)
  .then((ids) => {
    console.log("Records inserted successfully: ", { ids });
  })
  .catch((error) => {
    Notifications.postLocalNotification({
      body: "Error: " + error.message,
      title: `Push failed for ${data[0].recordType}`,
      silent: false,
      category: "Push Errors",
      fireDate: new Date(),
      android_channel_id: 'push-errors',
    });
  })
}

const handleDel = async (message) => {
  const isInitialized = await initialize();
  
  let data = JSON.parse(message.data);
  console.log(data);

  deleteRecordsByUuids(data.recordType, data.uuids, data.uuids)
  axios.delete(`${apiBase}/api/v2/sync/${data.recordType}`, {
    data: {
      uuid: data.uuids,
    },
    headers: {
      "Authorization": `Bearer ${login}`
    }
  })
}
  

export default function App() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const [form, setForm] = React.useState(null);

  const loginFunc = async () => {
    Toast.show({
      type: 'info',
      text1: "Logging in...",
      autoHide: false
    })

    try {
    let fcmToken = await requestUserPermission();
    form.fcmToken = fcmToken;
    let response = await axios.post(`${apiBase}/api/v2/login`, form);
    if ('token' in response.data) {
      console.log(response.data);
      await setPlain('login', response.data.token);
      login = response.data.token;
      await setPlain('refreshToken', response.data.refresh);
      forceUpdate();
      Toast.hide();
      Toast.show({
        type: 'success',
        text1: "Logged in successfully",
      })
      askForPermissions();
    }
    else {
      Toast.hide();
      Toast.show({
        type: 'error',
        text1: "Login failed",
        text2: response.data.error
      })
    }
    }

    catch (err) {
      Toast.hide();
      Toast.show({
        type: 'error',
        text1: "Login failed",
        text2: err.message
      })
    }
  }

  React.useEffect(() => {
    requestNotifications(['alert']).then(({status, settings}) => {
      console.log(status, settings)
    });

    get('login')
    .then(res => {
      if (res) {
        login = res;
        get('taskDelay')
        .then(res => {
          if (res) taskDelay = Number(res);
        })

        ReactNativeForegroundService.add_task(() => sync(), {
          delay: taskDelay,
          onLoop: true,
          taskId: 'hcgateway_sync',
          onError: e => console.log(`Error logging:`, e),
        });

        ReactNativeForegroundService.add_task(() => refreshTokenFunc(), {
          delay: 10800 * 1000,
          onLoop: true,
          taskId: 'refresh_token',
          onError: e => console.log(`Error logging:`, e),
        });

        ReactNativeForegroundService.start({
          id: 1244,
          title: 'HCGateway Sync Service',
          message: 'HCGateway is working in the background to sync your data.',
          icon: 'ic_launcher',
          setOnlyAlertOnce: true,
          color: '#000000',
        }).then(() => console.log('Foreground service started'));

        forceUpdate()
      }
    })
  }, [login])

  return (
    <View style={styles.container}>
      {login &&
        <View>
          <Text style={{ fontSize: 20, marginVertical: 10 }}>Your User ID is {login}. Do NOT share this with anyone.</Text>
          <Text style={{ fontSize: 17, marginVertical: 10 }}>Last Sync: {lastSync}</Text>

          <Text style={{ marginTop: 10, fontSize: 15 }}>API Base URL:</Text>
          <TextInput
            style={styles.input}
            placeholder="API Base URL"
            defaultValue={apiBase}
            onChangeText={text => {
              apiBase = text;
              setPlain('apiBase', text);
            }}
          />

          <Text style={{ marginTop: 10, fontSize: 15 }}>Sync Interval (in seconds) (defualt is 2 hours):</Text>
          <TextInput
            style={styles.input}
            placeholder="Sync Interval"
            keyboardType='numeric'
            defaultValue={(taskDelay / 1000).toString()}
            onChangeText={text => {
              taskDelay = Number(text) * 1000;
              setPlain('taskDelay', String(text * 1000));
              ReactNativeForegroundService.update_task(() => sync(), {
                delay: taskDelay,
              })
              Toast.show({
                type: 'success',
                text1: "Sync interval updated",
              })
            }}
          />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
            <Text style={{ fontSize: 15 }}>Enable Sentry:</Text>
            <Switch
              value={isSentryEnabled}
              onValueChange={async (value) => {
              if (value) {
                Sentry.init({
                dsn: 'https://e4a201b96ea602d28e90b5e4bbe67aa6@sentry.shuchir.dev/6',
                });
                Toast.show({
                type: 'success',
                text1: "Sentry enabled",
                });
                isSentryEnabled = true;
                forceUpdate();
              } else {
                Sentry.close();
                Toast.show({
                type: 'success',
                text1: "Sentry disabled",
                });
                isSentryEnabled = false;
                forceUpdate();
              }
              await setPlain('sentryEnabled', value.toString());
              }}
            />
            </View>

          <View style={{ marginTop: 20 }}>
            <Button
              title="Sync Now"
              onPress={() => {
                sync()
              }}
            />
          </View>

          <View style={{ marginTop: 100 }}>
            <Button
              title="Logout"
              onPress={() => {
                delkey('login');
                login = null;
                Toast.show({
                  type: 'success',
                  text1: "Logged out successfully",
                })
                forceUpdate();
              }}
            />
          </View>
        </View>
      }
      {!login &&
        <View>
          <Text style={{ 
            fontSize: 30,
            fontWeight: 'bold',
            textAlign: 'center',
           }}>Login</Text>

           <Text style={{ marginVertical: 10 }}>If you don't have an account, one will be made for you when logging in.</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            onChangeText={text => setForm({ ...form, username: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry={true}
            onChangeText={text => setForm({ ...form, password: text })}
          />
          <Text style={{ marginVertical: 10 }}>API Base URL:</Text>
          <TextInput
            style={styles.input}
            placeholder="API Base URL"
            defaultValue={apiBase}
            onChangeText={text => {
              apiBase = text;
              setPlain('apiBase', text);
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
            <Text style={{ fontSize: 15 }}>Enable Sentry:</Text>
            <Switch
              value={isSentryEnabled}
              defaultValue={isSentryEnabled}
              onValueChange={async (value) => {
                if (value) {
                  Sentry.init({
                    dsn: 'https://e4a201b96ea602d28e90b5e4bbe67aa6@sentry.shuchir.dev/6',
                  });
                  Toast.show({
                    type: 'success',
                    text1: "Sentry enabled",
                  });
                  isSentryEnabled = true;
                  forceUpdate();
                } else {
                  Sentry.close();
                  Toast.show({
                    type: 'success',
                    text1: "Sentry disabled",
                  });
                  isSentryEnabled = false;
                  forceUpdate();
                }
                await setPlain('sentryEnabled', value.toString());
              }} 
            />
          </View>

          <Button
            title="Login"
            onPress={() => {
              loginFunc()
            }}
          />
        </View>
      }

    <StatusBar style="dark" />
    <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    textAlign: "center",
    padding: 50
  },

  input: {
    height: 50,
    marginVertical: 7,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    width: 350,
    fontSize: 17
  },

});
