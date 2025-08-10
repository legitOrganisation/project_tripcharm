import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ScrollView,
} from "react-native";
import MapView, { Marker, Circle, Polygon } from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useGeofence, Geofence, Coordinate, GeofenceSchedule } from "../../context/GeofenceContext";
import Slider from "@react-native-community/slider";

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

  const [name, setName] = useState("");
  const [type, setType] = useState<"circle" | "polygon">("circle");
  const [center, setCenter] = useState<Coordinate | null>(null);
  const [radius, setRadius] = useState(100);
  const [polygonPoints, setPolygonPoints] = useState<Coordinate[]>([]);
  const [repeat, setRepeat] = useState<GeofenceSchedule["repeat"]>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Sync local state from currentGeofence when changed
  useEffect(() => {
    if (currentGeofence) {
      setName(currentGeofence.name);
      setType(currentGeofence.type);
      setCenter(currentGeofence.center);
      setRadius(currentGeofence.radius);
      setPolygonPoints(currentGeofence.polygonPoints);
      setRepeat(currentGeofence.schedule.repeat);
      setWeekdays(currentGeofence.schedule.weekdays);
      setStartDate(new Date(currentGeofence.schedule.startDate));
      setStartTime(currentGeofence.schedule.startTime);
      setEndTime(currentGeofence.schedule.endTime);
    } else {
      // Reset to defaults for new geofence
      setName("");
      setType("circle");
      setCenter(null);
      setRadius(100);
      setPolygonPoints([]);
      setRepeat("none");
      setWeekdays([]);
      setStartDate(new Date());
      setStartTime("08:00");
      setEndTime("18:00");
    }
  }, [currentGeofence]);

  // Map ref for zooming
  const mapRef = useRef<MapView>(null);

  // Add polygon point
  const onMapPress = (event: any) => {
    if (type !== "polygon") return;
    const { coordinate } = event.nativeEvent;
    setPolygonPoints((old) => [...old, coordinate]);
  };

  // Undo polygon points using context
  const onUndo = () => {
    undoPolygon();
  };
  const onRedo = () => {
    redoPolygon();
  };
  const onClear = () => {
    clearPolygonPoints();
  };

  // Weekdays toggle helper
  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      setWeekdays((old) => old.filter((d) => d !== day));
    } else {
      setWeekdays((old) => [...old, day].sort());
    }
  };

  // Save geofence (update existing or add new)
  const onSave = () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a name for the geofence.");
      return;
    }
    if (type === "circle" && !center) {
      Alert.alert("Validation", "Please select a center location on the map.");
      return;
    }
    if (type === "polygon" && polygonPoints.length < 3) {
      Alert.alert("Validation", "Polygon must have at least 3 points.");
      return;
    }

    const schedule: GeofenceSchedule = {
      repeat,
      weekdays,
      startDate,
      startTime,
      endTime,
    };

    const newGeofence: Geofence = {
      id: currentGeofence?.id || Math.random().toString(36).substring(7),
      name: name.trim(),
      type,
      center: type === "circle" ? center : null,
      radius: type === "circle" ? radius : 0,
      polygonPoints: type === "polygon" ? polygonPoints : [],
      schedule,
    };

    if (currentGeofence) {
      updateGeofence(newGeofence);
      Alert.alert("Saved", "Geofence updated successfully.");
    } else {
      addGeofence(newGeofence);
      Alert.alert("Saved", "Geofence added successfully.");
      setCurrentGeofence(newGeofence);
    }
  };

  // Delete geofence confirmation
  const onDelete = () => {
    if (!currentGeofence) return;
    Alert.alert(
      "Delete Geofence",
      `Are you sure you want to delete "${currentGeofence.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteGeofence(currentGeofence.id);
            setCurrentGeofence(null);
          },
        },
      ]
    );
  };

  // Format time helper
  const formatTime = (date: Date) => {
    const hrs = date.getHours().toString().padStart(2, "0");
    const mins = date.getMinutes().toString().padStart(2, "0");
    return `${hrs}:${mins}`;
  };

  // Parse time string to Date object for picker
  const timeStringToDate = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m);
    return d;
  };

  // Schedule repeat options UI
  const renderRepeatOptionsOriginal = () => (
    <View style={styles.repeatOptions}>
      {["none", "daily", "weekdays"].map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.repeatOption,
            repeat === opt && styles.repeatOptionSelected,
          ]}
          onPress={() => setRepeat(opt as GeofenceSchedule["repeat"])}
        >
          <Text
            style={[
              styles.repeatOptionText,
              repeat === opt && styles.repeatOptionTextSelected,
            ]}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Weekdays selector UI (for repeat=weekdays)
  const renderWeekdaysSelectorOriginal = () => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (repeat !== "weekdays") return null;
    return (
      <View style={styles.weekdaysContainer}>
        {dayNames.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.weekdayButton,
              weekdays.includes(i) && styles.weekdayButtonSelected,
            ]}
            onPress={() => toggleWeekday(i)}
          >
            <Text
              style={[
                styles.weekdayText,
                weekdays.includes(i) && styles.weekdayTextSelected,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Map region for editing geofence center or polygon points
  const mapRegion = center
    ? {
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 1.3521,
        longitude: 103.8198,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  // Update center marker position
  const onDragMarker = (e: any) => {
    const { coordinate } = e.nativeEvent;
    setCenter(coordinate);
  };

  return (
    <View style={styles.container}>
      {/* Geofence list */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Geofences</Text>
        {geofences.length === 0 ? (
          <Text style={styles.noGeofenceText}>No geofences created yet.</Text>
        ) : (
          <FlatList
            data={geofences}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.geofenceListItem,
                  currentGeofence?.id === item.id && styles.geofenceListItemSelected,
                ]}
                onPress={() => setCurrentGeofence(item)}
              >
                <View>
                  <Text style={styles.geofenceName}>{item.name}</Text>
                  <Text style={styles.geofenceType}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    Alert.alert(
                      "Delete Geofence",
                      `Delete "${item.name}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            if (currentGeofence?.id === item.id) {
                              setCurrentGeofence(null);
                            }
                            deleteGeofence(item.id);
                          },
                        },
                      ],
                      { cancelable: true }
                    )
                  }
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCurrentGeofence(null)}
        >
          <Text style={styles.addButtonText}>+ Add New Geofence</Text>
        </TouchableOpacity>
      </View>

      {/* Edit form in scrollview */}
      <ScrollView style={styles.editContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Edit Geofence</Text>

        {/* Name input */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Geofence Name"
          value={name}
          onChangeText={setName}
        />

        {/* Type selector */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, type === "circle" && styles.typeButtonSelected]}
            onPress={() => setType("circle")}
          >
            <Text style={type === "circle" ? styles.typeButtonTextSelected : styles.typeButtonText}>
              Circle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === "polygon" && styles.typeButtonSelected]}
            onPress={() => setType("polygon")}
          >
            <Text style={type === "polygon" ? styles.typeButtonTextSelected : styles.typeButtonText}>
              Polygon
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map for center or polygon points */}
        <MapView
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          onPress={onMapPress}
          scrollEnabled={true}
          zoomEnabled={true}
        >
          {type === "circle" && center && (
            <>
              <Marker
                coordinate={center}
                draggable
                onDragEnd={onDragMarker}
                title="Center"
              />
              <Circle center={center} radius={radius} strokeColor="#2196f3" fillColor="rgba(33, 150, 243, 0.3)" />
            </>
          )}

          {type === "polygon" && polygonPoints.length > 0 && (
            <>
              <Polygon
                coordinates={polygonPoints}
                strokeColor="#2196f3"
                fillColor="rgba(33, 150, 243, 0.3)"
              />
              {polygonPoints.map((pt, i) => (
                <Marker
                  key={`polypt-${i}`}
                  coordinate={pt}
                  draggable
                  onDragEnd={(e) => {
                    const newPts = [...polygonPoints];
                    newPts[i] = e.nativeEvent.coordinate;
                    setPolygonPoints(newPts);
                  }}
                  title={`Point ${i + 1}`}
                  pinColor="#2196f3"
                />
              ))}
            </>
          )}
        </MapView>

        {/* Radius slider for circle */}
        {type === "circle" && (
          <View style={styles.radiusContainer}>
            <Text>Radius: {radius} meters</Text>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={50}
              maximumValue={1000}
              step={10}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor="#2196f3"
              maximumTrackTintColor="#000000"
            />
          </View>
        )}

        {/* Polygon controls */}
        {type === "polygon" && (
          <View style={styles.polygonControls}>
            <TouchableOpacity
              style={[styles.polygonButton, !canUndo && styles.polygonButtonDisabled]}
              onPress={onUndo}
              disabled={!canUndo}
            >
              <Text style={styles.polygonButtonText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.polygonButton, !canRedo && styles.polygonButtonDisabled]}
              onPress={onRedo}
              disabled={!canRedo}
            >
              <Text style={styles.polygonButtonText}>Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.polygonButton}
              onPress={onClear}
            >
              <Text style={styles.polygonButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Schedule Section */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Schedule</Text>

        {renderRepeatOptionsOriginal()}

        {renderWeekdaysSelectorOriginal()}

        {/* Start Date Picker */}
        <TouchableOpacity
          onPress={() => setShowStartDatePicker(true)}
          style={styles.datePickerButton}
        >
          <Text>Start Date: {startDate.toDateString()}</Text>
        </TouchableOpacity>
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(e, selected) => {
              setShowStartDatePicker(false);
              if (selected) setStartDate(selected);
            }}
          />
        )}

        {/* Start Time Picker */}
        <TouchableOpacity
          onPress={() => setShowStartTimePicker(true)}
          style={styles.datePickerButton}
        >
          <Text>Start Time: {startTime}</Text>
        </TouchableOpacity>
        {showStartTimePicker && (
          <DateTimePicker
            value={timeStringToDate(startTime)}
            mode="time"
            display="default"
            onChange={(e, selected) => {
              setShowStartTimePicker(false);
              if (selected) setStartTime(formatTime(selected));
            }}
          />
        )}

        {/* End Time Picker */}
        <TouchableOpacity
          onPress={() => setShowEndTimePicker(true)}
          style={styles.datePickerButton}
        >
          <Text>End Time: {endTime}</Text>
        </TouchableOpacity>
        {showEndTimePicker && (
          <DateTimePicker
            value={timeStringToDate(endTime)}
            mode="time"
            display="default"
            onChange={(e, selected) => {
              setShowEndTimePicker(false);
              if (selected) setEndTime(formatTime(selected));
            }}
          />
        )}

        {/* Save & Delete Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>

          {currentGeofence && (
            <TouchableOpacity style={styles.deleteButtonLarge} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Repeat options rendering helper
  function renderRepeatOptionsNew() {
    return (
      <View style={styles.repeatOptions}>
        {["none", "daily", "weekdays"].map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.repeatOption,
              repeat === opt && styles.repeatOptionSelected,
            ]}
            onPress={() => setRepeat(opt as GeofenceSchedule["repeat"])}
          >
            <Text
              style={[
                styles.repeatOptionText,
                repeat === opt && styles.repeatOptionTextSelected,
              ]}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Weekdays selector helper
  function renderWeekdaysSelectorNew() {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (repeat !== "weekdays") return null;
    return (
      <View style={styles.weekdaysContainer}>
        {dayNames.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.weekdayButton,
              weekdays.includes(i) && styles.weekdayButtonSelected,
            ]}
            onPress={() => toggleWeekday(i)}
          >
            <Text
              style={[
                styles.weekdayText,
                weekdays.includes(i) && styles.weekdayTextSelected,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  listContainer: {
    maxHeight: 220,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    color: "#222",
  },
  noGeofenceText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    marginVertical: 20,
    textAlign: "center",
  },
  geofenceListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  geofenceListItemSelected: {
    backgroundColor: "#d0e8ff",
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  geofenceType: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  addButton: {
    marginTop: 12,
    backgroundColor: "#2196f3",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
  },
  addButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
  },

  editContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  label: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 6,
    marginTop: 16,
    color: "#333",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: "white",
  },

  typeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2196f3",
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  typeButtonSelected: {
    backgroundColor: "#2196f3",
  },
  typeButtonText: {
    color: "#2196f3",
    fontWeight: "700",
  },
  typeButtonTextSelected: {
    color: "white",
    fontWeight: "700",
  },

  map: {
    height: 220,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#bbb",
  },

  radiusContainer: {
    marginTop: 12,
  },

  polygonControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
  },
  polygonButton: {
    backgroundColor: "#2196f3",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  polygonButtonDisabled: {
    backgroundColor: "#999",
  },
  polygonButtonText: {
    color: "white",
    fontWeight: "700",
  },

  repeatOptions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  repeatOption: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  repeatOptionSelected: {
    backgroundColor: "#2196f3",
  },
  repeatOptionText: {
    color: "#2196f3",
    fontWeight: "600",
  },
  repeatOptionTextSelected: {
    color: "white",
    fontWeight: "600",
  },

  weekdaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  weekdayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  weekdayButtonSelected: {
    backgroundColor: "#2196f3",
  },
  weekdayText: {
    color: "#2196f3",
    fontWeight: "600",
  },
  weekdayTextSelected: {
    color: "white",
    fontWeight: "600",
  },

  datePickerButton: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#bbb",
    alignItems: "center",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#2196f3",
    paddingVertical: 14,
    borderRadius: 16,
    marginRight: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
  },

  deleteButtonLarge: {
    flex: 1,
    backgroundColor: "#ff3b30",
    paddingVertical: 14,
    borderRadius: 16,
    marginLeft: 10,
    alignItems: "center",
  },
});
