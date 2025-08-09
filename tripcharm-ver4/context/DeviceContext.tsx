import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useGeofence } from "./GeofenceContext";

export type Device = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastSeen: number;
};

type DeviceContextType = {
  devices: Device[];
  isLoading: boolean;
  error: string | null;
  addDevice: (device: Device) => void;
};

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currentGeofence } = useGeofence();

  // To prevent spamming vibration commands
  const lastVibrationSentRef = useRef(false);

  // Helper: distance between two points
  const getDistanceMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371000;
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

  // Check if point inside polygon (ray-casting)
  const isPointInPolygon = (point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]) => {
    let x = point.latitude,
      y = point.longitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].latitude,
        yi = polygon[i].longitude;
      let xj = polygon[j].latitude,
        yj = polygon[j].longitude;
      let intersect =
        (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if device inside current geofence
  const isDeviceInsideGeofence = (lat: number, lng: number): boolean => {
    if (!currentGeofence) return true;

    if (currentGeofence.type === "circle" && currentGeofence.center) {
      const distance = getDistanceMeters(
        lat,
        lng,
        currentGeofence.center.latitude,
        currentGeofence.center.longitude
      );
      return distance <= currentGeofence.radius;
    } else if (
      currentGeofence.type === "polygon" &&
      currentGeofence.polygonPoints.length > 2
    ) {
      return isPointInPolygon({ latitude: lat, longitude: lng }, currentGeofence.polygonPoints);
    }
    return true;
  };

  // Send vibrate command
  const sendVibrateCommand = async () => {
    try {
      const response = await fetch("http://ma8w.ddns.net:3000/api/set-command", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "command=vibrate",
      });
      if (response.ok) {
        lastVibrationSentRef.current = true;
      }
    } catch (err) {
      console.error("Failed to send vibrate command", err);
    }
  };

  // Fetch latest GPS from API and update devices state
  const fetchLatestGPS = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://ma8w.ddns.net:3000/api/latest");
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      if (!data.gps) throw new Error("Invalid GPS data");

      // gps string like "1.2345,N,103.6789,E"
      const parts = data.gps.split(",");
      if (parts.length !== 4) throw new Error("Malformed GPS data");

      const lat = parseFloat(parts[0]);
      const latDir = parts[1];
      const lng = parseFloat(parts[2]);
      const lngDir = parts[3];

      const latitude = latDir === "S" ? -lat : lat;
      const longitude = lngDir === "W" ? -lng : lng;

      // We assume one device only for now, id = "device1"
      const newDevice = {
        id: "device1",
        name: "Tracked Device",
        latitude,
        longitude,
        lastSeen: Date.now(),
      };

      setDevices([newDevice]);

      // Geofence check + vibration logic
      const inside = isDeviceInsideGeofence(latitude, longitude);
      if (!inside && !lastVibrationSentRef.current) {
        await sendVibrateCommand();
      }
      if (inside) {
        lastVibrationSentRef.current = false;
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch GPS");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch + interval every 30 seconds
  useEffect(() => {
    fetchLatestGPS();
    const interval = setInterval(fetchLatestGPS, 30000);
    return () => clearInterval(interval);
  }, [currentGeofence]); // rerun if geofence changes

  const addDevice = (device: Device) => {
    setDevices((prev) => [...prev, device]);
  };

  return (
    <DeviceContext.Provider
      value={{ devices, isLoading, error, addDevice }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = (): DeviceContextType => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDevices must be used within DeviceProvider");
  return ctx;
};
