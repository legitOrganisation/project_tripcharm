import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  FlatList,
  Dimensions,
} from "react-native";
import MapView, { Marker, Circle, Polygon, MapPressEvent } from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { Geofence, useGeofence } from "../../context/GeofenceContext";

const weekdaysLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const windowWidth = Dimensions.get("window").width;

export default function GeofencingScreen() {
  const {
    geofences,
    currentGeofence,
    setCurrentGeofence,
    addGeofence,
    updateGeofence,
    deleteGeofence,
    undoPolygon,
    redoPolygon,
    clearPolygonPoints,
    canUndo,
    canRedo,
  } = useGeofence();

  // To track last vibration sent so we don't spam
  const lastVibrationSentRef = useRef(false);

  // Create blank geofence template
  const createBlankGeofence = (): Geofence => ({
    id: Math.random().toString(36).slice(2),
    name: "",
    type: "circle",
    center: { latitude: 1.3521, longitude: 103.8198 },
    radius: 100,
    polygonPoints: [],
    schedule: {
      repeat: "none",
      weekdays: [],
      startDate: new Date(),
      startTime: "00:00",
      endTime: "23:59",
    },
  });

  // Initialize current geofence if null
  useEffect(() => {
    if (!currentGeofence) {
      setCurrentGeofence(createBlankGeofence());
    }
  }, []);

  // Helper: Point in polygon (ray-casting algorithm)
  const isPointInPolygon = (point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]) => {
    let x = point.latitude, y = point.longitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].latitude, yi = polygon[i].longitude;
      let xj = polygon[j].latitude, yj = polygon[j].longitude;
      let intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if device is inside geofence
  const isDeviceInsideGeofence = (deviceLat: number, deviceLng: number): boolean => {
    if (!currentGeofence) return true; // safety fallback: consider inside if no geofence

    if (currentGeofence.type === "circle" && currentGeofence.center) {
      const distance = getDistanceMeters(
        deviceLat,
        deviceLng,
        currentGeofence.center.latitude,
        currentGeofence.center.longitude
      );
      return distance <= currentGeofence.radius;
    } else if (currentGeofence.type === "polygon" && currentGeofence.polygonPoints.length > 2) {
      return isPointInPolygon({ latitude: deviceLat, longitude: deviceLng }, currentGeofence.polygonPoints);
    }
    return true;
  };

  // Calculate distance between two lat/lng points in meters (Haversine formula)
  const getDistanceMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // On device location update: Check geofence and send vibrate command if outside zone
  // You will need to call this function from wherever you get live device location updates
  // For demonstration, let's add a stub here that you can call with new coords
  const onDeviceLocationUpdate = async (deviceLat: number, deviceLng: number) => {
    if (!currentGeofence) return;

    const inside = isDeviceInsideGeofence(deviceLat, deviceLng);

    if (!inside && !lastVibrationSentRef.current) {
      // Send vibrate command via API
      try {
        const response = await fetch("http://ma8w.ddns.net:3000/api/set-command", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "command=vibrate",
        });
        if (response.ok) {
          lastVibrationSentRef.current = true;
          Alert.alert("Alert", "Device is out of the zone! Vibration command sent.");
        }
      } catch (error) {
        console.error("Failed to send vibrate command:", error);
      }
    } else if (inside) {
      // Reset flag when device back inside zone
      lastVibrationSentRef.current = false;
    }
  };

  // You'll want to connect onDeviceLocationUpdate() with your device location updates (e.g. via context or props).
  // For now, this component doesn't fetch live device data directly.

  // The rest of your geofencing UI and handlers remain unchanged below:

  const onSelectGeofence = (index: number) => {
    if (index === geofences.length) {
      setCurrentGeofence(createBlankGeofence());
    } else {
      setCurrentGeofence(geofences[index]);
    }
  };

  if (!currentGeofence) {
    return (
      <View style={styles.noSelectionContainer}>
        <Text style={styles.noSelectionText}>Loading geofence...</Text>
      </View>
    );
  }

  const setName = (name: string) => setCurrentGeofence({ ...currentGeofence, name });

  const toggleType = () => {
    if (currentGeofence.type === "circle") {
      setCurrentGeofence({
        ...currentGeofence,
        type: "polygon",
        center: null,
        polygonPoints: [],
      });
    } else {
      setCurrentGeofence({
        ...currentGeofence,
        type: "circle",
        center: { latitude: 1.3521, longitude: 103.8198 },
        polygonPoints: [],
      });
    }
  };

  const onMapPress = (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    if (currentGeofence.type === "polygon") {
      setCurrentGeofence({
        ...currentGeofence,
        polygonPoints: [...currentGeofence.polygonPoints, coords],
      });
    } else {
      setCurrentGeofence({
        ...currentGeofence,
        center: coords,
      });
    }
  };

  const onRadiusChange = (radius: number) =>
    setCurrentGeofence({ ...currentGeofence, radius });

  const onRepeatChange = (repeat: typeof currentGeofence.schedule.repeat) => {
    setCurrentGeofence({
      ...currentGeofence,
      schedule: {
        ...currentGeofence.schedule,
        repeat,
        weekdays: repeat === "weekdays" ? currentGeofence.schedule.weekdays : [],
      },
    });
  };

  const toggleWeekday = (dayIndex: number) => {
    const days = currentGeofence.schedule.weekdays;
    const exists = days.includes(dayIndex);
    const updated = exists ? days.filter((d) => d !== dayIndex) : [...days, dayIndex];
    setCurrentGeofence({
      ...currentGeofence,
      schedule: { ...currentGeofence.schedule, weekdays: updated },
    });
  };

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const onChangeStartDate = (_: any, date?: Date) => {
    setShowStartDatePicker(false);
    if (!date) return;
    setCurrentGeofence({
      ...currentGeofence,
      schedule: { ...currentGeofence.schedule, startDate: date },
    });
  };

  const onChangeStartTime = (_: any, date?: Date) => {
    setShowStartTimePicker(false);
    if (!date) return;
    const time = date.toTimeString().slice(0, 5);
    setCurrentGeofence({
      ...currentGeofence,
      schedule: { ...currentGeofence.schedule, startTime: time },
    });
  };

  const onChangeEndTime = (_: any, date?: Date) => {
    setShowEndTimePicker(false);
    if (!date) return;
    const time = date.toTimeString().slice(0, 5);
    setCurrentGeofence({
      ...currentGeofence,
      schedule: { ...currentGeofence.schedule, endTime: time },
    });
  };

  const onSavePress = () => {
    if (!currentGeofence.name.trim()) {
      Alert.alert("Validation", "Please enter a name for the geofence.");
      return;
    }
    const existing = geofences.find((g) => g.id === currentGeofence.id);
    if (existing) {
      updateGeofence(currentGeofence);
    } else {
      addGeofence(currentGeofence);
    }
    Alert.alert("Saved", "Geofence saved successfully.");
  };

  const onDeletePress = () => {
    Alert.alert("Delete", `Delete "${currentGeofence.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGeofence(currentGeofence.id) },
    ]);
  };

  const renderSliderItem = ({ item, index }: { item: typeof geofences[0]; index: number }) => {
    const selected = currentGeofence.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.sliderItem, selected && styles.sliderItemSelected]}
        onPress={() => onSelectGeofence(index)}
      >
        <Text style={[styles.sliderItemText, selected && styles.sliderItemTextSelected]}>
          {item.name || "Unnamed Zone"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Slider */}
      <View style={styles.sliderContainer}>
        <FlatList
          data={geofences}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={renderSliderItem}
          showsHorizontalScrollIndicator={false}
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.sliderItem, styles.addNewButton]}
              onPress={() => onSelectGeofence(geofences.length)}
            >
              <Text style={styles.sliderItemText}>+ New Zone</Text>
            </TouchableOpacity>
          }
          contentContainerStyle={{ paddingHorizontal: 8 }}
        />
      </View>

      {/* ScrollView with form */}
      <ScrollView style={styles.controls} keyboardShouldPersistTaps="handled">
        <MapView
          style={styles.map}
          onPress={onMapPress}
          initialRegion={{
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {currentGeofence.type === "circle" && currentGeofence.center && (
            <>
              <Marker coordinate={currentGeofence.center} />
              <Circle
                center={currentGeofence.center}
                radius={currentGeofence.radius}
                strokeColor="rgba(0,150,255,0.8)"
                fillColor="rgba(0,150,255,0.2)"
              />
            </>
          )}
          {currentGeofence.type === "polygon" && currentGeofence.polygonPoints.length > 0 && (
            <>
              {currentGeofence.polygonPoints.map((pt, idx) => (
                <Marker key={idx} coordinate={pt} pinColor="orange" />
              ))}
              <Polygon
                coordinates={currentGeofence.polygonPoints}
                strokeColor="rgba(255,150,0,0.8)"
                fillColor="rgba(255,150,0,0.3)"
                strokeWidth={2}
              />
            </>
          )}
        </MapView>

        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <TextInput
            placeholder="Zone name"
            value={currentGeofence.name}
            style={styles.textInput}
            onChangeText={setName}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity onPress={toggleType} style={styles.button}>
            <Text style={styles.buttonText}>
              {currentGeofence.type === "circle" ? "Switch to Polygon" : "Switch to Circle"}
            </Text>
          </TouchableOpacity>
        </View>

        {currentGeofence.type === "circle" && (
          <>
            <View style={styles.row}>
              <Text>Radius: {currentGeofence.radius.toFixed(0)} m</Text>
            </View>
            <Slider
              minimumValue={50}
              maximumValue={2000}
              step={10}
              value={currentGeofence.radius}
              onValueChange={onRadiusChange}
              minimumTrackTintColor="#2196F3"
              maximumTrackTintColor="#ccc"
            />
          </>
        )}

        {currentGeofence.type === "polygon" && (
          <View style={styles.row}>
            <TouchableOpacity
              onPress={undoPolygon}
              disabled={!canUndo}
              style={[styles.smallButton, !canUndo && styles.disabledButton]}
            >
              <Text style={styles.buttonText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={redoPolygon}
              disabled={!canRedo}
              style={[styles.smallButton, !canRedo && styles.disabledButton]}
            >
              <Text style={styles.buttonText}>Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearPolygonPoints}
              style={[styles.smallButton, { backgroundColor: "#f44336" }]}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* repeat options */}
        <View style={styles.row}>
          <Text style={styles.label}>Repeat:</Text>
          {["none", "daily", "weekdays"].map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onRepeatChange(opt as typeof currentGeofence.schedule.repeat)}
              style={[
                styles.smallButton,
                currentGeofence.schedule.repeat === opt && styles.buttonSelected,
              ]}
            >
              <Text style={styles.buttonText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {currentGeofence.schedule.repeat === "weekdays" && (
          <View style={styles.weekdaysContainer}>
            {weekdaysLabels.map((day, i) => (
              <TouchableOpacity
                key={day}
                onPress={() => toggleWeekday(i)}
                style={[
                  styles.weekdayButton,
                  currentGeofence.schedule.weekdays.includes(i) && styles.weekdaySelected,
                ]}
              >
                <Text style={styles.weekdayText}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* start/end date/time */}
        <View style={styles.row}>
          <Text>Start Date:</Text>
          <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.datePickerButton}>
            <Text>{currentGeofence.schedule.startDate?.toDateString() ?? "Pick"}</Text>
          </TouchableOpacity>
          {showStartDatePicker && (
            <DateTimePicker
              value={currentGeofence.schedule.startDate ?? new Date()}
              mode="date"
              display="default"
              onChange={onChangeStartDate}
            />
          )}
        </View>

        <View style={styles.row}>
          <Text>Start Time:</Text>
          <TouchableOpacity onPress={() => setShowStartTimePicker(true)} style={styles.datePickerButton}>
            <Text>{currentGeofence.schedule.startTime}</Text>
          </TouchableOpacity>
          {showStartTimePicker && (
            <DateTimePicker
              value={new Date(`1970-01-01T${currentGeofence.schedule.startTime || "00:00"}:00`)}
              mode="time"
              is24Hour
              display="default"
              onChange={onChangeStartTime}
            />
          )}
        </View>

        <View style={styles.row}>
          <Text>End Time:</Text>
          <TouchableOpacity onPress={() => setShowEndTimePicker(true)} style={styles.datePickerButton}>
            <Text>{currentGeofence.schedule.endTime}</Text>
          </TouchableOpacity>
          {showEndTimePicker && (
            <DateTimePicker
              value={new Date(`1970-01-01T${currentGeofence.schedule.endTime || "23:59"}:00`)}
              mode="time"
              is24Hour
              display="default"
              onChange={onChangeEndTime}
            />
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onSavePress} style={[styles.button, styles.saveButton]}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeletePress} style={[styles.button, styles.deleteButton]}>
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sliderContainer: {
    height: 50,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  sliderItem: {
    paddingHorizontal: 16,
    justifyContent: "center",
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  sliderItemSelected: {
    backgroundColor: "#2196f3",
  },
  sliderItemText: {
    fontWeight: "600",
    color: "#333",
  },
  sliderItemTextSelected: {
    color: "#fff",
  },
  addNewButton: {
    backgroundColor: "#4caf50",
    justifyContent: "center",
  },
  controls: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  map: {
    height: 200,
    borderRadius: 10,
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  label: {
    fontWeight: "bold",
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 40,
  },
  button: {
    backgroundColor: "#2196f3",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  smallButton: {
    backgroundColor: "#2196f3",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  buttonSelected: {
    backgroundColor: "#1976d2",
  },
  weekdaysContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  weekdayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  weekdaySelected: {
    backgroundColor: "#2196f3",
  },
  weekdayText: {
    color: "#2196f3",
    fontWeight: "600",
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 40,
  },
  saveButton: {
    backgroundColor: "#4caf50",
    flex: 1,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: "#f44336",
    flex: 1,
  },
  noSelectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noSelectionText: {
    fontSize: 18,
    color: "#888",
  },
});
