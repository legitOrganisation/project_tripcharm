import React, { useRef, useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import BottomSheet from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";

import { useDevices } from "../../context/DeviceContext";
import { useGeofence } from "../../context/GeofenceContext";

const windowWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const { devices, isLoading, error, addDevice } = useDevices();
  const { currentGeofence } = useGeofence();

  const sheetRef = React.useRef<BottomSheet>(null);
  const snapPoints = ["15%", "50%", "90%"];

  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

  const mapRef = useRef<MapView>(null);

  // When selectedDeviceIndex changes, center map on that device
  useEffect(() => {
    if (devices.length === 0) return;
    const device = devices[selectedDeviceIndex];
    if (device && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: device.latitude,
          longitude: device.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [selectedDeviceIndex, devices]);

  const onMarkerPress = useCallback(
    (deviceId: string) => {
      const index = devices.findIndex((d) => d.id === deviceId);
      if (index !== -1) {
        setSelectedDeviceIndex(index);
        sheetRef.current?.expand();
      }
    },
    [devices]
  );

  const addNewDevice = () => {
    const newDevice = {
      id: Math.random().toString(36).slice(2),
      name: `Device ${devices.length + 1}`,
      latitude: 1.3521 + (Math.random() - 0.5) * 0.02,
      longitude: 103.8198 + (Math.random() - 0.5) * 0.02,
      lastSeen: Date.now(),
    };
    addDevice(newDevice);
    Alert.alert("Device Added", `${newDevice.name} was added.`);
    setSelectedDeviceIndex(devices.length); // select new device
  };

  // Render each device in slider
  const renderSliderItem = ({ item, index }: { item: typeof devices[0]; index: number }) => {
    const selected = index === selectedDeviceIndex;
    return (
      <TouchableOpacity
        style={[styles.sliderItem, selected && styles.sliderItemSelected]}
        onPress={() => setSelectedDeviceIndex(index)}
        activeOpacity={0.7}
      >
        <Text style={[styles.sliderItemText, selected && styles.sliderItemTextSelected]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Handle horizontal scroll snapping
  const onSliderScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / (windowWidth * 0.4));
    if (newIndex !== selectedDeviceIndex) {
      setSelectedDeviceIndex(newIndex);
    }
  };

  const selectedDevice = devices[selectedDeviceIndex] || null;

  return (
    <View style={styles.container}>
      {/* Device slider */}
      <View style={styles.sliderContainer}>
        <FlatList
          data={devices}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={renderSliderItem}
          snapToInterval={windowWidth * 0.4}
          decelerationRate="fast"
          onScroll={onSliderScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        />
      </View>

      {/* Selected device info */}
      {selectedDevice && (
        <View style={styles.selectedDeviceInfo}>
          <Text style={styles.selectedDeviceName}>{selectedDevice.name}</Text>
          <Text style={styles.selectedDeviceLastSeen}>
            Last seen: {new Date(selectedDevice.lastSeen).toLocaleString()}
          </Text>
        </View>
      )}

      {/* Add device button */}
      <TouchableOpacity style={styles.addDeviceButton} onPress={addNewDevice}>
        <Text style={styles.addDeviceButtonText}>+ Add Device</Text>
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        style={styles.map}
        region={
          selectedDevice
            ? {
                latitude: selectedDevice.latitude,
                longitude: selectedDevice.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : {
                latitude: 1.3521,
                longitude: 103.8198,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
        }
        showsUserLocation={true}
      >
        {currentGeofence?.center && currentGeofence.radius > 0 && (
          <Circle
            center={currentGeofence.center}
            radius={currentGeofence.radius}
            strokeColor="rgba(0,150,255,0.7)"
            fillColor="rgba(0,150,255,0.2)"
          />
        )}

        {devices.map((device) => (
          <Marker
            key={device.id}
            coordinate={{ latitude: device.latitude, longitude: device.longitude }}
            title={device.name}
            description={`Last seen: ${new Date(device.lastSeen).toLocaleString()}`}
            onPress={() => onMarkerPress(device.id)}
            pinColor={device.id === selectedDevice?.id ? "#2196f3" : undefined}
          />
        ))}
      </MapView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196f3" />
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BlurView intensity={50} tint="light" style={styles.blurContainer}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Tracked Devices</Text>
            {devices.length > 0 ? (
              <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => sheetRef.current?.expand()}
                  >
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.deviceInfo}>
                      Last seen: {new Date(item.lastSeen).toLocaleString()}
                    </Text>
                    <Text style={styles.deviceInfo}>
                      Location: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <Text style={styles.sheetSubtitle}>
                Devices will appear here once your tracker device is online.
              </Text>
            )}
          </View>
        </BlurView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sliderContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1001,
  },
  sliderItem: {
    width: windowWidth * 0.35,
    marginHorizontal: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sliderItemSelected: {
    backgroundColor: "#2196f3",
    shadowOpacity: 0.4,
  },
  sliderItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  sliderItemTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  selectedDeviceInfo: {
    position: "absolute",
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  selectedDeviceName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  selectedDeviceLastSeen: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  addDeviceButton: {
    position: "absolute",
    top: 10,
    right: 20,
    zIndex: 1002,
    backgroundColor: "#2196f3",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addDeviceButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  map: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -20,
  },
  errorBox: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    padding: 10,
    backgroundColor: "#ffcccc",
    borderRadius: 8,
    zIndex: 100,
  },
  errorText: { color: "#b00020", fontWeight: "bold" },
  bottomSheetBackground: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  handleIndicator: {
    backgroundColor: "#ccc",
    width: 50,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 10,
  },
  blurContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: "#777",
    marginTop: 10,
  },
  deviceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
  },
  deviceInfo: {
    fontSize: 14,
    color: "#555",
  },
});
