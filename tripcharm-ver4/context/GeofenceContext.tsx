import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type GeofenceSchedule = {
  repeat: "none" | "daily" | "weekdays";
  weekdays: number[]; // 0=Sun..6=Sat
  startDate: Date;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
};

export type Geofence = {
  id: string;
  name: string;
  type: "circle" | "polygon";
  center: Coordinate | null;
  radius: number;
  polygonPoints: Coordinate[];
  schedule: GeofenceSchedule;
};

type GeofenceContextType = {
  geofences: Geofence[];
  currentGeofence: Geofence | null;
  setCurrentGeofence: (g: Geofence | null) => void;

  addGeofence: (...newG: Geofence[]) => void;
  updateGeofence: (updated: Geofence) => void;
  deleteGeofence: (id: string) => void;

  undoPolygon: () => void;
  redoPolygon: () => void;
  clearPolygonPoints: () => void;

  canUndo: boolean;
  canRedo: boolean;

  // New: editing mode to share geofence being edited across tabs
  editingGeofence: Geofence | null;
  setEditingGeofence: (g: Geofence | null) => void;

  // Checks if point is inside any geofence (circle or polygon)
  isPointInsideAnyGeofence: (point: Coordinate) => boolean;
};

const GeofenceContext = createContext<GeofenceContextType | undefined>(
  undefined
);

const STORAGE_KEY = "app_geofences_v2";

export const useGeofence = () => {
  const ctx = useContext(GeofenceContext);
  if (!ctx) {
    throw new Error("useGeofence must be used within GeofenceProvider");
  }
  return ctx;
};

export const GeofenceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);

  const undoStack = useRef<Coordinate[][]>([]);
  const redoStack = useRef<Coordinate[][]>([]);

  // Load geofences from backend or AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://ma8w.ddns.net/api/geofences");
        if (res.ok) {
          let data: Geofence[] = await res.json();
          // Parse dates
          data = data.map((g) => ({
            ...g,
            schedule: {
              ...g.schedule,
              startDate: new Date(g.schedule.startDate),
            },
          }));
          setGeofences(data);
          setCurrentGeofence(data[0] || null);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          return;
        }
        throw new Error("API fetch failed");
      } catch {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored).map((g: any) => ({
            ...g,
            schedule: { ...g.schedule, startDate: new Date(g.schedule.startDate) },
          }));
          setGeofences(data);
          setCurrentGeofence(data[0] || null);
        }
      }
    })();
  }, []);

  // Save geofences to AsyncStorage when changed
  useEffect(() => {
    if (geofences.length) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(geofences)).catch(() =>
        console.warn("Failed to save geofences")
      );
    }
  }, [geofences]);

  // Add geofence(s)
  const addGeofence = useCallback((...newG: Geofence[]) => {
    setGeofences((old) => [...old, ...newG]);
  }, []);

  // Update geofence
  const updateGeofence = useCallback(
    (updated: Geofence) => {
      setGeofences((old) =>
        old.map((g) => (g.id === updated.id ? updated : g))
      );
      if (currentGeofence?.id === updated.id) setCurrentGeofence(updated);
      if (editingGeofence?.id === updated.id) setEditingGeofence(updated);
    },
    [currentGeofence, editingGeofence]
  );

  // Delete geofence by id
  const deleteGeofence = useCallback(
    (id: string) => {
      setGeofences((old) => old.filter((g) => g.id !== id));
      if (currentGeofence?.id === id) {
        setCurrentGeofence(geofences.length > 1 ? geofences[0] : null);
      }
      if (editingGeofence?.id === id) setEditingGeofence(null);
    },
    [currentGeofence, editingGeofence, geofences]
  );

  // Undo polygon points
  const undoPolygon = useCallback(() => {
    if (!currentGeofence) return;
    if (currentGeofence.type !== "polygon") return;
    if (currentGeofence.polygonPoints.length === 0) return;

    undoStack.current.push([...currentGeofence.polygonPoints]);
    const newPoints = currentGeofence.polygonPoints.slice(0, -1);
    setCurrentGeofence({ ...currentGeofence, polygonPoints: newPoints });
  }, [currentGeofence]);

  // Redo polygon points
  const redoPolygon = useCallback(() => {
    if (!currentGeofence) return;
    if (currentGeofence.type !== "polygon") return;
    if (undoStack.current.length === 0) return;

    const restored = undoStack.current.pop()!;
    setCurrentGeofence({ ...currentGeofence, polygonPoints: restored });
  }, [currentGeofence]);

  // Clear polygon points and reset undo/redo
  const clearPolygonPoints = useCallback(() => {
    if (!currentGeofence) return;
    if (currentGeofence.type !== "polygon") return;
    undoStack.current = [];
    redoStack.current = [];
    setCurrentGeofence({ ...currentGeofence, polygonPoints: [] });
  }, [currentGeofence]);

  // Undo/Redo availability
  const canUndo =
    currentGeofence?.type === "polygon" &&
    currentGeofence.polygonPoints.length > 0;

  const canRedo = undoStack.current.length > 0;

  // Helper: Point inside polygon (ray-casting algorithm)
  const pointInPolygon = (point: Coordinate, vs: Coordinate[]) => {
    let x = point.latitude,
      y = point.longitude;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      let xi = vs[i].latitude,
        yi = vs[i].longitude;
      let xj = vs[j].latitude,
        yj = vs[j].longitude;
      let intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if point inside any geofence
  const isPointInsideAnyGeofence = useCallback(
    (point: Coordinate): boolean => {
      for (const g of geofences) {
        if (g.type === "circle" && g.center) {
          const dist = Math.sqrt(
            (point.latitude - g.center.latitude) ** 2 +
              (point.longitude - g.center.longitude) ** 2
          );
          if (dist <= g.radius / 111000) {
            // Approximate meters to degrees conversion
            return true;
          }
        }
        if (g.type === "polygon" && g.polygonPoints.length > 2) {
          if (pointInPolygon(point, g.polygonPoints)) {
            return true;
          }
        }
      }
      return false;
    },
    [geofences]
  );

  return (
    <GeofenceContext.Provider
      value={{
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
        editingGeofence,
        setEditingGeofence,
        isPointInsideAnyGeofence,
      }}
    >
      {children}
    </GeofenceContext.Provider>
  );
};