import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSettings } from "../../context/SettingsContext";
import { useDevices } from "../../context/DeviceContext";

export default function SettingsScreen() {
  const {
    darkMode,
    setDarkMode,
    notificationsEnabled,
    setNotificationsEnabled,
    fallSensitivity,
    setFallSensitivity,
    locationUpdateInterval,
    setLocationUpdateInterval,
  } = useSettings();

  const { batteryPercentage, vibrateDevice, isLoading } = useDevices();

  const cycleFallSensitivity = () => {
    setFallSensitivity(
      fallSensitivity === "Low"
        ? "Medium"
        : fallSensitivity === "Medium"
        ? "High"
        : "Low"
    );
  };

  const linkNewDevice = () => {
    Alert.alert("Device Linking", "This feature will connect to your device API later.");
  };

  const onVibratePress = async () => {
    try {
      await vibrateDevice();
      Alert.alert("Vibrate", "Device vibrate command sent.");
    } catch {
      Alert.alert("Vibrate", "Failed to send vibrate command.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Dark Mode Toggle */}
      <View style={styles.settingRow}>
        <Text>Dark Mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      {/* Fall Detection Sensitivity */}
      <View style={styles.settingRow}>
        <Text>Fall Detection Sensitivity</Text>
        <TouchableOpacity onPress={cycleFallSensitivity} style={styles.button}>
          <Text style={styles.buttonText}>{fallSensitivity}</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications Toggle */}
      <View style={styles.settingRow}>
        <Text>App Notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />
      </View>

      {/* Location Update Interval Slider */}
      <View style={styles.settingRowColumn}>
        <Text>Device Location Update Interval: {locationUpdateInterval}s</Text>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={10}
          maximumValue={300}
          step={10}
          value={locationUpdateInterval}
          onValueChange={setLocationUpdateInterval}
          minimumTrackTintColor="#2196f3"
          maximumTrackTintColor="#ccc"
        />
      </View>

      {/* Battery Percentage Display */}
      <View style={[styles.settingRow, { justifyContent: "flex-start" }]}>
        <Text style={{ marginRight: 10 }}>Battery Percentage:</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#2196f3" />
        ) : (
          <Text>{batteryPercentage !== null ? `${batteryPercentage}%` : "N/A"}</Text>
        )}
      </View>

      {/* Vibrate Device Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#2196f3", marginTop: 20 }]}
        onPress={onVibratePress}
      >
        <Text style={styles.buttonText}>Vibrate Device</Text>
      </TouchableOpacity>

      {/* Link device */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#4caf50", marginTop: 20 }]}
        onPress={linkNewDevice}
      >
        <Text style={styles.buttonText}>Link a New Device</Text>
      </TouchableOpacity>

      {/* Placeholder future settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More Options</Text>
        <Text style={styles.placeholder}>
          - Export data (future) {"\n"}
          - Manage user profiles (future) {"\n"}
          - Language selection (future)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
  },
  settingRowColumn: {
    flexDirection: "column",
    paddingVertical: 14,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
  },
  button: {
    backgroundColor: "#4caf50",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  placeholder: {
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
  },
});
