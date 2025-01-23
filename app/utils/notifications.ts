//@ts-nocheck
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Declare global function for TypeScript
declare global {
  var showImageAlert: (params: {
    title: string;
    message: string;
    imageUrl?: string;
  }) => void;
}

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
      showBadge: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  try {
    const fcmToken = await messaging().getToken();
    const success = await sendTokenToServer(fcmToken);
    if (!success) {
      return null;
    }

    messaging().onTokenRefresh(async (newToken) => {
      await sendTokenToServer(newToken);
    });

    setupNotificationHandlers();

    return fcmToken;
  } catch (error) {
    return null;
  }
};

const setupNotificationHandlers = () => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await showNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body,
      remoteMessage.data,
      {
        imageUrl:
          remoteMessage.notification.android?.imageUrl ||
          remoteMessage.notification.ios?.imageUrl,
      }
    );
  });

  messaging().onMessage(async (remoteMessage) => {
    handleForegroundNotification(remoteMessage);
  });

  messaging().onNotificationOpenedApp(async (remoteMessage) => {
    handleNotificationTap(remoteMessage.data);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        handleNotificationTap(remoteMessage.data);
      }
    });
};

const handleForegroundNotification = (remoteMessage) => {
  const title = remoteMessage.notification.title;
  const body = remoteMessage.notification.body;
  const imageUrl =
    remoteMessage.notification.android?.imageUrl ||
    remoteMessage.notification.ios?.imageUrl;

  global.showImageAlert({
    title,
    message: body,
    imageUrl,
  });
};

const handleNotificationTap = (data: any) => {
  if (data?.courseId) {
    // Navigate to course
  } else if (data?.streamSessionId) {
    // Navigate to stream
  }
};

const sendTokenToServer = async (token: string) => {
  try {
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

    return response.ok;
  } catch (error) {
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
      sound: true,
      badge: 1,
      ...Platform.select({
        ios: {
          subtitle: options.subtitle,
          attachments: options.imageUrl
            ? [
                {
                  identifier: "1",
                  url: options.imageUrl,
                  thumbnailClipArea: { x: 0, y: 0, width: 1, height: 1 },
                },
              ]
            : undefined,
        },
        android: {
          icon: "../assets/images/white-nextcoder-48.png",
          color: "#ff237c",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          ...(options.imageUrl && {
            largeIcon: options.imageUrl,
            style: {
              type: Notifications.AndroidNotificationStyle.BIGPICTURE,
              picture: options.imageUrl,
            },
          }),
        },
      }),
    },
    trigger: null,
  };

  await Notifications.scheduleNotificationAsync(notificationContent);
};
