import { Linking, Platform } from "react-native";

export const handlePhoneCall = (phoneNumber: string) => {
  Linking.openURL(`tel:${phoneNumber}`).catch((err) =>
    console.error("An error occurred", err)
  );
};

export const handleOpenMaps = (
  pharmacyLatitude: number,
  pharmacyLongitude: number,
  userLatitude: number | null,
  userLongitude: number | null
) => {
  let url = `https://www.google.com/maps/search/?api=1&query=${pharmacyLatitude},${pharmacyLongitude}`;

  if (userLatitude !== null && userLongitude !== null) {
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?daddr=${pharmacyLatitude},${pharmacyLongitude}&saddr=${userLatitude},${userLongitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${pharmacyLatitude},${pharmacyLongitude}&origin=${userLatitude},${userLongitude}`;
    }
  }

  Linking.openURL(url).catch((err) => console.error("An error occurred", err));
};
