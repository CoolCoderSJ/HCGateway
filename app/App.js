import React from 'react';
import { StyleSheet } from 'react-native';
import {
  ApplicationProvider,
  Button,
  Icon,
  IconRegistry,
  Layout,
  Text,
  Input,
  Modal,
  Card
} from '@ui-kitten/components';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import * as eva from '@eva-design/eva';
import {
  initialize,
  requestPermission,
  readRecords,
  readRecord,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import axios from 'axios';
import ReactNativeForegroundService from "@supersami/rn-foreground-service";
import AsyncStorage from '@react-native-async-storage/async-storage';
ReactNativeForegroundService.register();

const setObj = async (key, value) => { try { const jsonValue = JSON.stringify(value); await AsyncStorage.setItem(key, jsonValue) } catch (e) { console.log(e) } }
const setPlain = async (key, value) => { try { await AsyncStorage.setItem(key, value) } catch (e) { console.log(e) } }
const get = async (key) => { try { const value = await AsyncStorage.getItem(key); if (value !== null) { try { return JSON.parse(value) } catch { return value } } } catch (e) { console.log(e) } }
const delkey = async (key, value) => { try { await AsyncStorage.removeItem(key) } catch (e) { console.log(e) } }
const getAll = async () => { try { const keys = await AsyncStorage.getAllKeys(); return keys } catch (error) { console.error(error) } }


const askForPermission = () => {
  getSdkStatus().then(status => {
    console.log('status', status);
    console.log(SdkAvailabilityStatus.SDK_AVAILABLE, SdkAvailabilityStatus.SDK_UNAVAILABLE, SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log('SDK is available');
    }
  
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      console.log('SDK is not available');
    }
  
    if (
      status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    ) {
      console.log('SDK is not available, provider update required');
    }
  })

  initialize().then(isInitialized => {
    console.log('isInitialized', isInitialized);
    requestPermission([
      { accessType: 'read', recordType: 'BasalMetabolicRate' },
      { accessType: 'read', recordType: 'BloodGlucose' },
      { accessType: 'read', recordType: 'BloodPressure' },
      { accessType: 'read', recordType: 'BodyFat' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'Height' },
      { accessType: 'read', recordType: 'Nutrition' },
      { accessType: 'read', recordType: 'OxygenSaturation' },
      { accessType: 'read', recordType: 'Power' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Speed' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'Weight' },
      { accessType: 'read', recordType: 'Vo2Max' },
    ]).then(grantedPermissions => {
      console.log('grantedPermissions', grantedPermissions);
    })
  })
  
};

const sync = () => {
  console.log("a")
  get("session").then((userid) => {
    console.log(userid)
    initialize().then(isInitialized => {
    console.log('isInitialized', isInitialized);
      [ 'BasalMetabolicRate', 'BloodGlucose', 'BloodPressure', 'BodyFat', 'Distance', 'ExerciseSession', 'HeartRate', 'Height', 'Nutrition', 'OxygenSaturation', 'Power', 'SleepSession', 'Speed', 'Steps', 'TotalCaloriesBurned', 'Weight', 'Vo2Max'].forEach((recordType) => {
        readRecords(recordType, {
          timeRangeFilter: {
            operator: 'between',
            startTime: String(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString()),
            endTime: String(new Date().toISOString()),
          },
        }).then(records => {
          console.log(recordType, records.length, "\n\n");
          if (["SleepSession", "Speed", "HeartRate"].includes(recordType)) {
          for (let i=0; i<records.length; i++) {
            setTimeout(() => readRecord(
              recordType,
              records[i].metadata.id,
            ).then((result) => {
              // console.log('Retrieved record: ', result );
              axios.post(`https://api.hcgateway.shuchir.dev/api/sync/${recordType}`, {
                userid: userid,
                data: result
              })
            }), i*3000)
          }
          }
          else {
            setTimeout(() => axios.post(`https://api.hcgateway.shuchir.dev/api/sync/${recordType}`, {
              userid: userid,
              data: records
            }), 3000)
          }
        })
      })
    })
  })
}

ReactNativeForegroundService.add_task(() => sync(), {
  delay: 7200000,
  onLoop: true,
  taskId: "hccloudsync",
  onError: (e) => console.log(`Error logging:`, e),
});

ReactNativeForegroundService.start({
  id: 1244,
  title: "Sync Service",
  message: "HCGateway is syncing Health Connect to the cloud.",
  setOnlyAlertOnce: true,
  color: "#000000",
});

let userLoggedIn = false;
let session = null;
let visible = false;
let modalText = '';


export default App = () => {
  const [uname, setUname] = React.useState('');
  const [passw, setPassw] = React.useState('');
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  get("session").then((res) => {
    if (res) userLoggedIn = true; session = res; forceUpdate()
  })

  const login = (uname, passw) => {
    axios.post("https://api.hcgateway.shuchir.dev/api/login", {
      username: uname,
      password: passw
    }).then(res => {
      if ("sessid" in res.data) {
        console.log(res.data.sessid)
        AsyncStorage.setItem("session", res.data.sessid).then(() => {
          userLoggedIn = true;
          session = res.data.sessid;
          forceUpdate();
          askForPermission();
        })
      }
      else {
        modalText = res.data.error;
        visibile = true;
        forceUpdate();
      }
    })
    .catch(err => {
      console.log(err.response.data);
      modalText = err.response.data.error;
      visible = true;
      forceUpdate()
    })
  }

  
  return (
  <>
    <ApplicationProvider {...eva} theme={eva.dark}>
      <Layout style={styles.container}>
      <Modal
          visible={visible}
          backdropStyle={styles.backdrop}
          onBackdropPress={() => {visible = false; forceUpdate()}}
        >
          <Card disabled={true}>
            <Text>
              {modalText}
            </Text>
            <Button onPress={() => {visible = false; forceUpdate()}} style={styles.margin}>
              DISMISS
            </Button>
          </Card>
        </Modal>

        {!userLoggedIn ? 
          <Layout style={styles.container}>
            <Text style={styles.text} category='h1'>Welcome to HCGateway</Text>
            <Text style={styles.text}>Please login or signup for an account. If you don't have an account, it will be created for you.</Text>
            <Input
              placeholder='Enter a username'
              value={uname}
              onChangeText={nextValue => setUname(nextValue)}
              style={styles.margin}
            />
            <Input
              placeholder='Enter a password'
              value={passw}
              onChangeText={nextValue => setPassw(nextValue)}
              style={styles.margin}
            />
             <Button onPress={() => login(uname, passw)} style={styles.margin}>
              Login
            </Button>
          </Layout>
          :
          <Layout style={styles.container}>
            <Text style={styles.text} category='h1'>Welcome to HCGateway</Text>
            <Text>Your user ID is {session}. DO NOT share it with anyone.</Text>
          </Layout>
        }
      </Layout>
    </ApplicationProvider>
  </>)
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 192,
    paddingHorizontal: 16,
  },
  text: {
    textAlign: 'center',
    marginVertical: 16,
  },
  margin: {
    marginVertical: 4,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
