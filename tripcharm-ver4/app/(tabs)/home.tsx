import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from "react-native";
import MapView, { Marker, Circle, Polygon, Region } from "react-native-maps";
import BottomSheet from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";

import { useDevices } from "../../context/DeviceContext";
import { useGeofence } from "../../context/GeofenceContext";
import { useNavigation, NavigationProp } from "@react-navigation/native";

const windowWidth = Dimensions.get("window").width;

type RootStackParamList = {
  Home: undefined;
  Geofencing: undefined;
  // other routes
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const {
    devices,
    error,
    batteryPercentage,
    refreshDevices,
  } = useDevices();

  const { geofences, setCurrentGeofence } = useGeofence();

  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [selectedGeofence, setSelectedGeofence] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mapRef = useRef<MapView>(null);
  const deviceListSheetRef = useRef<BottomSheet>(null);

  const deviceListSnapPoints = ["20%", "60%", "90%"];

  // Animate map to selected device location
  useEffect(() => {
    if (devices.length === 0) return;
    const device = devices[selectedDeviceIndex];
    if (
      device &&
      mapRef.current &&
      !isNaN(device.latitude) &&
      !isNaN(device.longitude)
    ) {
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
        deviceListSheetRef.current?.expand();
      }
    },
    [devices]
  );

  const onGeofencePress = (id: string) => {
    setSelectedGeofence(id);
  };

  const onMapPress = () => {
    setSelectedGeofence(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDevices();
    } catch {
      // ignore errors
    } finally {
      setRefreshing(false);
    }
  };

  const onEditGeofence = (geofenceId: string) => {
    const geofence = geofences.find((g) => g.id === geofenceId);
    if (geofence) {
      setCurrentGeofence(geofence);
      navigation.navigate("Geofencing");
    }
  };

  const selectedDevice = devices[selectedDeviceIndex] || null;
  const geofencePopup = selectedGeofence
    ? geofences.find((g) => g.id === selectedGeofence) || null
    : null;

  const renderDeviceItem = ({
    item,
    index,
  }: {
    item: typeof devices[0];
    index: number;
  }) => {
    const selected = index === selectedDeviceIndex;
    return (
      <TouchableOpacity
        style={[styles.deviceListItem, selected && styles.deviceListItemSelected]}
        onPress={() => {
          setSelectedDeviceIndex(index);
          deviceListSheetRef.current?.expand();
        }}
      >
        <Text style={[styles.deviceName, selected && styles.deviceNameSelected]}>
          {item.name}
        </Text>
        <Text style={styles.deviceInfo}>
          Last seen: {new Date(item.lastSeen).toLocaleString()}
        </Text>
        <Text style={styles.deviceInfo}>
          Location: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
        </Text>
      </TouchableOpacity>
    );
  };

  // Safely construct region to avoid NaN / invalid region error
  const safeRegion: Region =
    selectedDevice &&
    !isNaN(selectedDevice.latitude) &&
    !isNaN(selectedDevice.longitude)
      ? {
          latitude: selectedDevice.latitude,
          longitude: selectedDevice.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : {
          latitude: 1.3521,
          longitude: 103.8198,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={safeRegion}
        showsUserLocation={true}
        onPress={onMapPress}
      >
        {/* Geofence circles and polygons */}
        {geofences.map((g) => {
          if (g.type === "circle" && g.center && g.radius > 0) {
            return (
              <React.Fragment key={g.id}>
                <Circle
                  center={g.center}
                  radius={g.radius}
                  strokeColor={
                    g.id === selectedGeofence
                      ? "rgba(0, 150, 255, 0.9)"
                      : "rgba(0,150,255,0.5)"
                  }
                  fillColor={
                    g.id === selectedGeofence
                      ? "rgba(0, 150, 255, 0.3)"
                      : "rgba(0,150,255,0.15)"
                  }
                />
                {/* Transparent Marker for press detection */}
                <Marker
                  coordinate={g.center}
                  onPress={() => onGeofencePress(g.id)}
                  pinColor="transparent"
                  tracksViewChanges={false}
                />
              </React.Fragment>
            );
          } else if (g.type === "polygon" && g.polygonPoints.length > 2) {
            // Calculate polygon centroid for placing transparent marker
            const centroid = {
              latitude:
                g.polygonPoints.reduce((sum, p) => sum + p.latitude, 0) /
                g.polygonPoints.length,
              longitude:
                g.polygonPoints.reduce((sum, p) => sum + p.longitude, 0) /
                g.polygonPoints.length,
            };
            return (
              <React.Fragment key={g.id}>
                <Polygon
                  coordinates={g.polygonPoints}
                  strokeColor={
                    g.id === selectedGeofence
                      ? "rgba(0, 150, 255, 0.9)"
                      : "rgba(0,150,255,0.5)"
                  }
                  fillColor={
                    g.id === selectedGeofence
                      ? "rgba(0, 150, 255, 0.3)"
                      : "rgba(0,150,255,0.15)"
                  }
                />
                <Marker
                  coordinate={centroid}
                  onPress={() => onGeofencePress(g.id)}
                  pinColor="transparent"
                  tracksViewChanges={false}
                />
              </React.Fragment>
            );
          }
          return null;
        })}

        {/* Device markers */}
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

      {selectedDevice && (
        <View style={styles.selectedDeviceInfo}>
          <Text style={styles.selectedDeviceName}>{selectedDevice.name}</Text>
          <Text style={styles.selectedDeviceLastSeen}>
            Last seen: {new Date(selectedDevice.lastSeen).toLocaleString()}
          </Text>
          <Text style={styles.selectedDeviceLocation}>
            Location: {selectedDevice.latitude.toFixed(5)}, {selectedDevice.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      {geofencePopup && (
        <View style={styles.geofencePopup}>
          <Text style={styles.geofencePopupTitle}>{geofencePopup.name}</Text>
          <Text>Type: {geofencePopup.type}</Text>
          {geofencePopup.type === "circle" && geofencePopup.center && (
            <Text>
              Center: {geofencePopup.center.latitude.toFixed(5)}, {geofencePopup.center.longitude.toFixed(5)}
            </Text>
          )}
          {geofencePopup.type === "circle" && (
            <Text>Radius: {geofencePopup.radius} m</Text>
          )}
          {geofencePopup.type === "polygon" && (
            <Text>Points: {geofencePopup.polygonPoints.length}</Text>
          )}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setSelectedGeofence(null);
              onEditGeofence(geofencePopup.id);
            }}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedGeofence(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.batteryContainer}>
        <Text style={styles.batteryText}>
          Battery: {batteryPercentage !== null ? `${batteryPercentage}%` : "N/A"}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <BottomSheet
        ref={deviceListSheetRef}
        index={0}
        snapPoints={deviceListSnapPoints}
        enablePanDownToClose={true}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BlurView intensity={50} tint="light" style={styles.blurContainer}>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDeviceItem}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </BlurView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  selectedDeviceInfo: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  selectedDeviceName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
  },
  selectedDeviceLastSeen: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  selectedDeviceLocation: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },

  geofencePopup: {
    position: "absolute",
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 16,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 7,
  },
  geofencePopupTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  editButton: {
    marginTop: 10,
    backgroundColor: "#2196f3",
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  closeButton: {
    marginTop: 8,
    backgroundColor: "#ccc",
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeButtonText: {
    textAlign: "center",
    color: "#333",
  },

  batteryContainer: {
    position: "absolute",
    top: 10,
    right: 20,
    backgroundColor: "rgba(33, 150, 243, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  batteryText: {
    color: "white",
    fontWeight: "700",
  },

  errorBox: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    padding: 12,
    backgroundColor: "#ffcccc",
    borderRadius: 10,
    zIndex: 100,
    maxWidth: "90%",
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

  deviceListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  deviceListItemSelected: {
    backgroundColor: "#e6f0ff",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  deviceNameSelected: {
    color: "#2196f3",
  },
  deviceInfo: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
});
