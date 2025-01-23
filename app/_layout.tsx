//@ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
  Platform,
  BackHandler,
  ActivityIndicator,
  AppState,
} from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import * as ScreenOrientation from "expo-screen-orientation";
import * as ScreenCapture from "expo-screen-capture";

import {
  initializeNotifications,
  showNotification,
} from "./utils/notifications";

import { handleFileUpload, handleFileDownload } from "./utils/fileHandlers";
import { handlePhoneCall, handleOpenMaps } from "./utils/navigation";
import { getInjectedJavaScript } from "./utils/webViewBridge";
import { ImageAlert } from "../components/ImageAlert";

export default function RootLayout() {
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [imageAlert, setImageAlert] = useState({
    visible: false,
    title: "",
    message: "",
    imageUrl: "",
  });

  useEffect(() => {
    const setupApp = async () => {
      await initializeNotifications();
      await ScreenCapture.preventScreenCaptureAsync();
    };

    setupApp();

    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener("hardwareBackPress", backAction);

    global.showImageAlert = ({ title, message, imageUrl }) => {
      setImageAlert({ visible: true, title, message, imageUrl });
    };

    return () => {
      BackHandler.removeEventListener("hardwareBackPress", backAction);
      ScreenCapture.allowScreenCaptureAsync();
      delete global.showImageAlert;
    };
  }, [canGoBack]);

  const handleFullScreenChange = useCallback(async (event) => {
    const { isFullScreen } = JSON.parse(event.nativeEvent.data);
    setIsFullScreen(isFullScreen);
    if (isFullScreen) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      );
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    }
  }, []);

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setIsError(true);
    setErrorMessage(
      nativeEvent?.description ||
        "Unable to load the page. Please check your internet connection and try again."
    );
    setIsLoading(false);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setIsError(false);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const retryLoading = () => {
    setIsError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading content...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
      <Text style={styles.errorText}>{errorMessage}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={retryLoading}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case "phoneCall":
          handlePhoneCall(data.phone);
          break;
        case "fileUpload":
          handleFileUpload(webViewRef);
          break;
        case "fileDownload":
          handleFileDownload(data.url, data.fileName, webViewRef);
          break;
        case "openMaps":
          handleOpenMaps(data.pharmacyLatitude, data.pharmacyLongitude);
          break;
        case "newNotification":
          showNotification(data.notification.title, data.notification.message);
          break;
        case "fullscreenChange":
          handleFullScreenChange(event);
          break;
      }
    } catch (error) {
      // Error handling without console.error
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // App has come to the foreground
        // You can add any necessary logic here, such as refreshing data
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.container}>
        {isError ? (
          renderError()
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: "https://www.nextcoder.co.in/user/courses" }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            onError={handleError}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            renderLoading={renderLoading}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
              if (!navState.loading && navState.title === "") {
                handleError({
                  nativeEvent: {
                    description:
                      "The requested page could not be loaded. Please try again.",
                  },
                });
              }
            }}
            injectedJavaScript={`
              ${getInjectedJavaScript()}

              document.addEventListener('fullscreenchange', function() {
                const isFullScreen = !!document.fullscreenElement;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fullscreenChange', isFullScreen }));
              });

              window.addEventListener('error', function(e) {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT') {
                  // Resource failed to load
                }
              }, true);
            `}
            onMessage={onMessage}
            allowsBackForwardNavigationGestures={true}
            onLoadEnd={() => {
              webViewRef.current?.injectJavaScript(`
                // WebView bridge status check (without console.log)
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridgeStatus', status: true }));
              `);
            }}
            allowsFullscreenVideo={true}
            mediaPlaybackRequiresUserAction={false}
          />
        )}
        <ImageAlert
          visible={imageAlert.visible}
          title={imageAlert.title}
          message={imageAlert.message}
          imageUrl={imageAlert.imageUrl}
          onClose={() => setImageAlert({ ...imageAlert, visible: false })}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? Constants.statusBarHeight : 0,
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
});
