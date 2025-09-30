import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';
import { setLocation, setLocationPermission } from '../redux/slices/uiSlice';

export const useLocation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();

  const requestLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      dispatch(setLocationPermission(status));
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        dispatch(setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }));
        console.log('Location found:', location.coords);
      } else {
        console.log('Location permission denied');
      }
    } catch (err) {
      setError(err.message);
      console.log('Location error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { requestLocation, loading, error };
};
