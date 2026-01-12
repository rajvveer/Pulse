import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  location: null,      // Stores { latitude, longitude }
  city: null,          // Stores "Jodhpur"
  region: null,        // Stores "Rajasthan"
  locationPermission: null,
  currentRadius: 500,
  mapVisible: false,
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ✅ Updated to handle full location data (coords + address)
    setLocation: (state, action) => {
      const payload = action.payload;
      
      // If payload has explicit 'coords' structure (e.g. from custom hook)
      if (payload.coords) {
        state.location = payload.coords;
        state.city = payload.city || state.city;
        state.region = payload.region || state.region;
      } 
      // If payload is just the coordinate object directly
      else {
        state.location = payload;
      }
    },
    // ✅ Specific action to update address only (after reverse geocoding)
    setAddress: (state, action) => {
      const { city, region } = action.payload;
      state.city = city;
      state.region = region;
    },
    setLocationPermission: (state, action) => {
      state.locationPermission = action.payload;
    },
    setRadius: (state, action) => {
      state.currentRadius = action.payload;
    },
    toggleMap: (state) => {
      state.mapVisible = !state.mapVisible;
    },
  },
});

export const { 
  setLocation, 
  setAddress, 
  setLocationPermission, 
  setRadius, 
  toggleMap 
} = uiSlice.actions;

export default uiSlice.reducer;