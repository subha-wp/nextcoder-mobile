//@ts-nocheck
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure default notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export const initializeNotifications = async () => {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      enableVibrate: true,
      enableLights: true,
    });
  }

  // Check if we have permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // If we don't have permission, ask for it
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token for push notification!");
    return null;
  }

  try {
    token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    // Send this token to your server
    await sendTokenToServer(token.data);

    // Set up notification handlers
    setupNotificationHandlers();

    return token.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
};

const setupNotificationHandlers = () => {
  // Handle notifications received while app is foregrounded
  Notifications.addNotificationReceivedListener((notification) => {
    const { title, body, data, subtitle } = notification.request.content;
    console.log("Received notification:", { title, subtitle, body, data });
  });

  // Handle notification responses (when user taps notification)
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { title, body, data, subtitle } =
      response.notification.request.content;
    console.log("Notification response:", { title, subtitle, body, data });

    // Handle notification tap based on data
    handleNotificationTap(data);
  });
};

const handleNotificationTap = (data: any) => {
  // Handle different types of notifications based on data
  if (data?.courseId) {
    // Navigate to course details
    // You'll need to implement navigation logic here
    console.log("Navigate to course:", data.courseId);
  } else if (data?.streamSessionId) {
    // Navigate to live stream
    console.log("Navigate to stream:", data.streamSessionId);
  }
  // Add more handlers as needed
};

const sendTokenToServer = async (token: string) => {
  try {
    const response = await fetch(
      "https://www.nextcoder.co.in/api/register-push-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          // Add any user identification if available
          // userId: currentUserId // You'll need to implement this
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to register push token");
    }
  } catch (error) {
    console.error("Error sending token to server:", error);
  }
};

export const showNotification = async (
  title: string,
  body: string,
  data: any = {},
  options: {
    subtitle?: string;
    imageUrl?: string;
  } = {}
) => {
  const notificationContent: Notifications.NotificationRequestInput = {
    content: {
      title,
      body,
      data,
      ...Platform.select({
        ios: {
          subtitle: options.subtitle,
          attachments: options.imageUrl
            ? [
                {
                  url: options.imageUrl,
                  thumbnailClipArea: [0, 0, 1, 1],
                },
              ]
            : undefined,
        },
        android: {
          icon: "ic_notification",
          color: "#FF231F7C",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        },
      }),
    },
    trigger: null,
  };

  await Notifications.scheduleNotificationAsync(notificationContent);
};
