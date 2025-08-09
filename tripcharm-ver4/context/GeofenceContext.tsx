import React, { createContext, useContext, useState, ReactNode } from "react";

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type ScheduleRepeat = "none" | "daily" | "weekdays";

export type GeofenceSchedule = {
  repeat: ScheduleRepeat;
  weekdays: number[];
  startDate: Date;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
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
  setCurrentGeofence: (gf: Geofence | null) => void;
  addGeofence: (gf: Geofence) => void;
  updateGeofence: (gf: Geofence) => void;
  deleteGeofence: (id: string) => void;
  undoPolygon: () => void;
  redoPolygon: () => void;
  clearPolygonPoints: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const GeofenceContext = createContext<GeofenceContextType | undefined>(undefined);

export const GeofenceProvider = ({ children }: { children: ReactNode }) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);

  // Undo/redo stack for polygon points
  const [undoStack, setUndoStack] = React.useState<Coordinate[][]>([]);
  const [redoStack, setRedoStack] = React.useState<Coordinate[][]>([]);

  // Add geofence
  const addGeofence = (gf: Geofence) => {
    setGeofences((prev) => [...prev, gf]);
    setCurrentGeofence(gf);
    setUndoStack([]);
    setRedoStack([]);
  };

  // Update existing geofence by id
  const updateGeofence = (gf: Geofence) => {
    setGeofences((prev) =>
      prev.map((g) => (g.id === gf.id ? gf : g))
    );
    setCurrentGeofence(gf);
  };

  // Delete geofence by id
  const deleteGeofence = (id: string) => {
    setGeofences((prev) => prev.filter((g) => g.id !== id));
    setCurrentGeofence(null);
    setUndoStack([]);
    setRedoStack([]);
  };

  // Undo last polygon point add
  const undoPolygon = () => {
    if (!currentGeofence || currentGeofence.type !== "polygon") return;
    const points = currentGeofence.polygonPoints;
    if (points.length === 0) return;
    const newPoints = points.slice(0, points.length - 1);
    setUndoStack((prev) => [...prev, points]);
    setRedoStack([]);
    setCurrentGeofence({ ...currentGeofence, polygonPoints: newPoints });
  };

  // Redo polygon points
  const redoPolygon = () => {
    if (!currentGeofence || currentGeofence.type !== "polygon") return;
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, currentGeofence.polygonPoints]);
    setCurrentGeofence({ ...currentGeofence, polygonPoints: lastRedo });
  };

  // Clear polygon points
  const clearPolygonPoints = () => {
    if (!currentGeofence || currentGeofence.type !== "polygon") return;
    setUndoStack((prev) => [...prev, currentGeofence.polygonPoints]);
    setRedoStack([]);
    setCurrentGeofence({ ...currentGeofence, polygonPoints: [] });
  };

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

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
      }}
    >
      {children}
    </GeofenceContext.Provider>
  );
};

export const useGeofence = (): GeofenceContextType => {
  const ctx = useContext(GeofenceContext);
  if (!ctx) throw new Error("useGeofence must be used within GeofenceProvider");
  return ctx;
};
