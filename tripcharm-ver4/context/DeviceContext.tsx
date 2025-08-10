import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGeofence, Coordinate } from "./GeofenceContext";

const API_BASE = "http://ma8w.ddns.net:3000";
const STORAGE_KEY_VIB = "@tripcharm:vibrationInterval";
const STORAGE_KEY_LOC = "@tripcharm:lastDevicePos";

export type Device = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastSeen: number;
};

type DeviceContextType = {
  devices: Device[];
  lastLocation: Coordinate | null;
  isLoading: boolean;
  error: string | null;
  vibrationInterval: number; // ms
  setVibrationInterval: (ms: number) => Promise<void>;
  pollInterval: number;
  setPollInterval: (ms: number) => void;
  batteryPercentage: number | null;
  vibrateDevice: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  addDevice: (device: Device) => void;
  deleteDevice: (id: string) => void;
  updateDevice: (device: Device) => void;
};

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isPointInsideAnyGeofence } = useGeofence();

  const [devices, setDevices] = useState<Device[]>([]);
  const [lastLocation, setLastLocation] = useState<Coordinate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batteryPercentage, setBatteryPercentage] = useState<number | null>(
    null
  );

  const [vibrationInterval, setVibrationIntervalState] = useState<number>(3000);
  const [pollInterval, setPollInterval] = useState<number>(30000); // default 30s

  const outsideRef = useRef<boolean>(false);
  const postedCommandRef = useRef<boolean>(false);
  const vibrationTimerRef = useRef<number | null>(null);

  // Load vibration interval & last device pos from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const vibRaw = await AsyncStorage.getItem(STORAGE_KEY_VIB);
        const lastLocRaw = await AsyncStorage.getItem(STORAGE_KEY_LOC);
        if (vibRaw) setVibrationIntervalState(Number(vibRaw));
        if (lastLocRaw) {
          const parsed = JSON.parse(lastLocRaw) as Coordinate;
          setLastLocation(parsed);
        }
      } catch (e) {
        console.warn("Failed to load device settings", e);
      }
    })();
  }, []);

  // Persist vibrationInterval on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_VIB, String(vibrationInterval)).catch(() =>
      console.warn("Failed to persist vibrationInterval")
    );
  }, [vibrationInterval]);

  // Helper: start repeated vibration pulses
  const startVibrationPulses = useCallback(() => {
    const pulse = () => {
      Vibration.vibrate(500);
    };
    if (vibrationTimerRef.current) {
      clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    pulse();
    vibrationTimerRef.current = setInterval(
      pulse,
      Math.max(600, vibrationInterval)
    ) as unknown as number;
  }, [vibrationInterval]);

  // Stop vibration pulses
  const stopVibrationPulses = useCallback(() => {
    if (vibrationTimerRef.current) {
      clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    Vibration.cancel();
  }, []);

  // POST command to device server
  const postCommand = useCallback(async (cmd: string) => {
    try {
      await fetch(`${API_BASE}/api/upload/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
    } catch (e) {
      console.warn("Failed to POST command", e);
    }
  }, []);

  // Vibrate device function exposed to context
  const vibrateDevice = useCallback(async () => {
    await postCommand("vibrate");
  }, [postCommand]);

  // Parse latest GPS data from API response (array)
  const parseLatestFromDownload = useCallback((arr: any[]) => {
    if (!arr || arr.length === 0) return null;
    const item = arr[arr.length - 1];
    if (!item || !item.gps) return null;
    return {
      latitude: Number(item.gps.lat),
      longitude: Number(item.gps.lon),
      ts: new Date(item.timestamp).getTime() || Date.now(),
    };
  }, []);

  // Fetch battery percentage
  const fetchBatteryPercentage = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/download/batt-percentage`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data.percentage === "number") {
        setBatteryPercentage(data.percentage);
      } else {
        setBatteryPercentage(null);
      }
    } catch (e) {
      console.warn("Failed to fetch battery percentage", e);
      setBatteryPercentage(null);
    }
  }, []);

  // Fetch latest GPS from API, update devices and vibration state
  const fetchLatestGPS = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/download/gps`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      const latest = parseLatestFromDownload(arr);
      if (!latest) {
        setError("No GPS data available");
        setIsLoading(false);
        return;
      }

      const device: Device = {
        id: "device-1",
        name: "Tracked Device",
        latitude: latest.latitude,
        longitude: latest.longitude,
        lastSeen: latest.ts,
      };

      setDevices([device]); // for now only one device from API
      setLastLocation({ latitude: device.latitude, longitude: device.longitude });
      AsyncStorage.setItem(
        STORAGE_KEY_LOC,
        JSON.stringify({ latitude: device.latitude, longitude: device.longitude })
      ).catch(() => {});
      setError(null);

      const inside = isPointInsideAnyGeofence({
        latitude: device.latitude,
        longitude: device.longitude,
      });

      if (!inside && !outsideRef.current) {
        outsideRef.current = true;
        startVibrationPulses();
        if (!postedCommandRef.current) {
          postCommand("vibrate").catch(() => {});
          postedCommandRef.current = true;
        }
      } else if (inside && outsideRef.current) {
        outsideRef.current = false;
        postedCommandRef.current = false;
        stopVibrationPulses();
      }
    } catch (e: any) {
      console.warn("fetchLatestGPS error", e);
      setError(e.message || "Failed to fetch GPS");
    } finally {
      setIsLoading(false);
    }
  }, [
    isPointInsideAnyGeofence,
    parseLatestFromDownload,
    postCommand,
    startVibrationPulses,
    stopVibrationPulses,
  ]);

  // Manual refresh function for pull-to-refresh
  const refreshDevices = useCallback(async () => {
    await fetchLatestGPS();
    await fetchBatteryPercentage();
  }, [fetchLatestGPS, fetchBatteryPercentage]);

  // Polling effect for live updates
  useEffect(() => {
    fetchLatestGPS();
    fetchBatteryPercentage();

    const intervalId = setInterval(() => {
      fetchLatestGPS();
      fetchBatteryPercentage();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [pollInterval, fetchLatestGPS, fetchBatteryPercentage]);

  // Allow external change of vibration interval
  const setVibrationInterval = useCallback(
    async (ms: number) => {
      setVibrationIntervalState(ms);
      if (outsideRef.current) {
        stopVibrationPulses();
        startVibrationPulses();
      }
      postCommand("vibrate").catch(() => {});
    },
    [postCommand, startVibrationPulses, stopVibrationPulses]
  );

  // Add device to list (if supporting multiple)
  const addDevice = useCallback((device: Device) => {
    setDevices((old) => [...old, device]);
  }, []);

  // Delete device by ID
  const deleteDevice = useCallback((id: string) => {
    setDevices((old) => old.filter((d) => d.id !== id));
  }, []);

  // Update device in list
  const updateDevice = useCallback((device: Device) => {
    setDevices((old) => old.map((d) => (d.id === device.id ? device : d)));
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        lastLocation,
        isLoading,
        error,
        vibrationInterval,
        setVibrationInterval,
        pollInterval,
        setPollInterval,
        batteryPercentage,
        vibrateDevice,
        refreshDevices,
        addDevice,
        deleteDevice,
        updateDevice,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDevices must be used inside DeviceProvider");
  return ctx;
};
