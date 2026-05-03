// lib/useGeolocation.ts
// Custom hook that requests browser geolocation and returns
// { location, error, loading, retry }

import { useState, useCallback, useEffect } from "react";

export interface Coords {
  lat: number;
  lon: number;
}

export function useGeolocation() {
  const [location, setLocation] = useState<Coords | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!navigator?.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please allow location in your browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location unavailable. Try again.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out. Retrying…");
            break;
          default:
            setError("Could not determine location.");
        }
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Auto-request on mount
  useEffect(() => { request(); }, [request]);

  return { location, error, loading, retry: request };
}
