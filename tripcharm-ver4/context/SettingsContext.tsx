// context/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Settings = {
  darkMode: boolean;
  notificationsEnabled: boolean;
  fallSensitivity: "Low" | "Medium" | "High";
  locationUpdateInterval: number; // in seconds
  setDarkMode: (val: boolean) => void;
  setNotificationsEnabled: (val: boolean) => void;
  setFallSensitivity: (val: "Low" | "Medium" | "High") => void;
  setLocationUpdateInterval: (val: number) => void;
};

const STORAGE_KEY = "app_settings";

const defaultSettings = {
  darkMode: false,
  notificationsEnabled: true,
  fallSensitivity: "Medium" as "Low" | "Medium" | "High",
  locationUpdateInterval: 30, // default 30s
};

const SettingsContext = createContext<Settings | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [darkMode, setDarkMode] = useState(defaultSettings.darkMode);
  const [notificationsEnabled, setNotificationsEnabled] = useState(defaultSettings.notificationsEnabled);
  const [fallSensitivity, setFallSensitivity] = useState<"Low" | "Medium" | "High">(defaultSettings.fallSensitivity);
  const [locationUpdateInterval, setLocationUpdateInterval] = useState(defaultSettings.locationUpdateInterval);

  // Load settings on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const saved = JSON.parse(data);
          if (typeof saved.darkMode === "boolean") setDarkMode(saved.darkMode);
          if (typeof saved.notificationsEnabled === "boolean") setNotificationsEnabled(saved.notificationsEnabled);
          if (["Low", "Medium", "High"].includes(saved.fallSensitivity)) setFallSensitivity(saved.fallSensitivity);
          if (typeof saved.locationUpdateInterval === "number") setLocationUpdateInterval(saved.locationUpdateInterval);
        } catch {}
      }
    });
  }, []);

  // Persist settings on change
  useEffect(() => {
    const toSave = {
      darkMode,
      notificationsEnabled,
      fallSensitivity,
      locationUpdateInterval,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [darkMode, notificationsEnabled, fallSensitivity, locationUpdateInterval]);

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        notificationsEnabled,
        fallSensitivity,
        locationUpdateInterval,
        setDarkMode,
        setNotificationsEnabled,
        setFallSensitivity,
        setLocationUpdateInterval,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside a SettingsProvider");
  }
  return context;
};
