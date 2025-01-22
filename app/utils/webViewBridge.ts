export const getInjectedJavaScript = () => `
  (function() {
    if (!window.ReactNativeWebView) {
      window.ReactNativeWebView = {
        postMessage: function(data) {
          window.ReactNativeWebView.reactNativeMessage(JSON.stringify(data));
        }
      };
    }

    // Add message listener for web to native communication
    window.addEventListener('message', function(event) {
      window.ReactNativeWebView.postMessage(event.data);
    });

    // Notify web app that the bridge is ready
    window.dispatchEvent(new Event('ReactNativeWebViewReady'));

    true; // Note: this is needed for iOS
  })();
`;
