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

export default function RootLayout() {
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      initializeNotifications();
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

    return () => {
      BackHandler.removeEventListener("hardwareBackPress", backAction);
      ScreenCapture.allowScreenCaptureAsync();
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
      console.log("Received message from WebView:", data);

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
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  };

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

              // Add fullscreen change listener
              document.addEventListener('fullscreenchange', function() {
                const isFullScreen = !!document.fullscreenElement;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fullscreenChange', isFullScreen }));
              });

              // Add error event listener for failed resource loads
              window.addEventListener('error', function(e) {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT') {
                  console.error('Resource failed to load:', e.target.src);
                }
              }, true);
            `}
            onMessage={onMessage}
            allowsBackForwardNavigationGestures={true}
            onLoadEnd={() => {
              webViewRef.current?.injectJavaScript(`
                console.log('WebView bridge status:', !!window.ReactNativeWebView);
              `);
            }}
            allowsFullscreenVideo={true}
            mediaPlaybackRequiresUserAction={false}
          />
        )}
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
