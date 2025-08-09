import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';

export default function AlertsScreen() {
  const [curfewTime, setCurfewTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [alerts, setAlerts] = useState({
    geofenceExit: true,
    missedCurfew: true,
    fallDetected: true,
  });

  const [frequency, setFrequency] = useState(30); // default every 30 min

  // placeholder for sending alerts:
  const sendNotification = (type: string) => {
    // this will later be connected to push or SMS
    Alert.alert("Notification", `ALERT: ${type} triggered!`);
  };

  const simulateDeviceEvent = (event: string) => {
    // you can later replace with real device hooks
    sendNotification(event);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alert & Curfew Settings</Text>

      {/* Curfew Time */}
      <TouchableOpacity
        onPress={() => setShowTimePicker(true)}
        style={styles.curfewButton}
      >
        <Text style={styles.curfewButtonText}>
          {curfewTime
            ? `Curfew Time: ${curfewTime.toLocaleTimeString()}`
            : 'Set Curfew Time'}
        </Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          mode="time"
          value={curfewTime || new Date()}
          onChange={(_, date) => {
            setShowTimePicker(false);
            if (date) setCurfewTime(date);
          }}
        />
      )}

      {/* Alert toggles */}
      <View style={styles.alertRow}>
        <Text>Geofence Exit</Text>
        <Switch
          value={alerts.geofenceExit}
          onValueChange={(val) =>
            setAlerts((prev) => ({ ...prev, geofenceExit: val }))
          }
        />
      </View>
      <View style={styles.alertRow}>
        <Text>Missed Curfew</Text>
        <Switch
          value={alerts.missedCurfew}
          onValueChange={(val) =>
            setAlerts((prev) => ({ ...prev, missedCurfew: val }))
          }
        />
      </View>
      <View style={styles.alertRow}>
        <Text>Fall Detection</Text>
        <Switch
          value={alerts.fallDetected}
          onValueChange={(val) =>
            setAlerts((prev) => ({ ...prev, fallDetected: val }))
          }
        />
      </View>

      {/* Alert Frequency */}
      <View style={styles.frequencySection}>
        <Text style={styles.sectionTitle}>Alert Frequency</Text>
        <Text style={styles.frequencyValue}>{frequency} min</Text>
        <Slider
          minimumValue={5}
          maximumValue={60}
          step={5}
          value={frequency}
          onValueChange={setFrequency}
        />
      </View>

      {/* Testing buttons */}
      <View style={styles.testingSection}>
        <Text style={styles.sectionTitle}>Test Alerts</Text>
        <TouchableOpacity
          onPress={() => simulateDeviceEvent("Fall Detected")}
          style={styles.testButton}
        >
          <Text style={styles.testButtonText}>Test Fall Alert</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => simulateDeviceEvent("Geofence Exit")}
          style={styles.testButton}
        >
          <Text style={styles.testButtonText}>Test Geofence Exit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => simulateDeviceEvent("Missed Curfew")}
          style={styles.testButton}
        >
          <Text style={styles.testButtonText}>Test Missed Curfew</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  curfewButton: {
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  curfewButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  frequencySection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  frequencyValue: {
    fontSize: 14,
    marginBottom: 6,
  },
  testingSection: {
    marginTop: 30,
  },
  testButton: {
    backgroundColor: '#4caf50',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  testButtonText: {
    color: 'white',
    textAlign: 'center',
  },
});
