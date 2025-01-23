//@ts-nocheck
import messaging from "@react-native-firebase/messaging";
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

  // Request permission for notifications
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log("Failed to get push notification permission");
    return null;
  }

  try {
    // Get FCM token
    const fcmToken = await messaging().getToken();
    console.log("FCM Token:", fcmToken);

    // Send token to server
    const success = await sendTokenToServer(fcmToken);
    if (success) {
      console.log("Token successfully registered with server");
    } else {
      console.error("Failed to register token with server");
    }

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log("FCM Token refreshed:", newToken);
      await sendTokenToServer(newToken);
    });

    // Set up notification handlers
    setupNotificationHandlers();

    return fcmToken;
  } catch (error) {
    console.error("Error setting up push notifications:", error);
    return null;
  }
};

const setupNotificationHandlers = () => {
  // Handle background messages
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background Message:", remoteMessage);
    await showNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body,
      remoteMessage.data
    );
  });

  // Handle foreground messages
  messaging().onMessage(async (remoteMessage) => {
    console.log("Foreground Message:", remoteMessage);
    await showNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body,
      remoteMessage.data
    );
  });

  // Handle notification open
  messaging().onNotificationOpenedApp(async (remoteMessage) => {
    console.log("Notification opened app:", remoteMessage);
    handleNotificationTap(remoteMessage.data);
  });

  // Check if app was opened from a notification
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log("Initial notification:", remoteMessage);
        handleNotificationTap(remoteMessage.data);
      }
    });
};

const handleNotificationTap = (data: any) => {
  if (data?.courseId) {
    console.log("Navigate to course:", data.courseId);
  } else if (data?.streamSessionId) {
    console.log("Navigate to stream:", data.streamSessionId);
  }
};

const sendTokenToServer = async (token: string) => {
  try {
    console.log("Sending token to server:", token);

    const response = await fetch(
      "https://www.nextcoder.co.in/api/register-push-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          tokenType: "fcm",
          deviceInfo: {
            brand: Constants.deviceName,
            model: Constants.platform?.web ? "web" : Constants.platform,
            systemVersion: Platform.Version,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Server response error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return false;
    }

    const data = await response.json();
    console.log("Server response:", data);
    return true;
  } catch (error) {
    console.error("Error sending token to server:", error);
    return false;
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
            ? [{ url: options.imageUrl, thumbnailClipArea: [0, 0, 1, 1] }]
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
