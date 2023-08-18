import React from 'react';
import { StyleSheet } from 'react-native';
import {
  ApplicationProvider,
  Button,
  Icon,
  IconRegistry,
  Layout,
  Text,
} from '@ui-kitten/components';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import * as eva from '@eva-design/eva';
import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import axios from 'axios';
import ReactNativeForegroundService from "@supersami/rn-foreground-service";
ReactNativeForegroundService.register();

const readData = () => {
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
      // readRecords('SleepSession', {
      //   timeRangeFilter: {
      //     operator: 'between',
      //     startTime: '2023-08-01T00:00:00.000Z',
      //     endTime: '2023-08-17T22:00:00.000Z',
      //   },
      // }).then(records => {
      //   console.log('records', records);
      // })
    })
  })
  
};

readData();

ReactNativeForegroundService.add_task(() => axios.get(`https://typedwebhook.tools/webhook/41b2a17e-31a8-4ddd-8d5b-a6e2554d2144`), {
  delay: 1000,
  onLoop: true,
  taskId: "fetchaxios",
  onError: (e) => console.log(`Error logging:`, e),
});

ReactNativeForegroundService.start({
  id: 1244,
  title: "Sync Service",
  message: "HCGateway is syncing Health Connect to the cloud.",
  setOnlyAlertOnce: true,
  color: "#000000",
});

export default () => (
  <>
    <ApplicationProvider {...eva} theme={eva.dark}>
      <Layout style={styles.container}>
        
      </Layout>
    </ApplicationProvider>
  </>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
  likeButton: {
    marginVertical: 16,
  },
});
