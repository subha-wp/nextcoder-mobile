//@ts-nocheck
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

export const handleFileUpload = async (webViewRef: any) => {
  try {
    const result = await DocumentPicker.getDocumentAsync();
    if (result.type === "success") {
      webViewRef.current?.injectJavaScript(`
        window.dispatchEvent(new CustomEvent('fileUploaded', {
          detail: {
            uri: '${result.uri}',
            name: '${result.name}',
            size: ${result.size}
          }
        }));
      `);
    }
  } catch (err) {
    console.error(err);
  }
};

export const handleFileDownload = async (
  fileUrl: string,
  fileName: string,
  webViewRef: any
) => {
  const downloadResumable = FileSystem.createDownloadResumable(
    fileUrl,
    FileSystem.documentDirectory + fileName
  );

  try {
    const { uri } = await downloadResumable.downloadAsync();
    console.log("File has been downloaded to:", uri);
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent('fileDownloaded', {
        detail: { uri: '${uri}', fileName: '${fileName}' }
      }));
    `);
  } catch (e) {
    console.error(e);
  }
};
