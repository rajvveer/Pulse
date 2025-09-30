import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  location: null,
  locationPermission: null,
  currentRadius: 500,
  mapVisible: false,
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLocation: (state, action) => {
      state.location = action.payload;
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

export const { setLocation, setLocationPermission, setRadius, toggleMap } = uiSlice.actions;
export default uiSlice.reducer;
