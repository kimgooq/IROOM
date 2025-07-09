import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Platform,
  UIManager,
  findNodeHandle,
  TouchableOpacity,
  Text,
} from 'react-native';
import CustomWebView from './specs/WebViewNativeComponent';
import NativeLidarModule from './specs/NativeLidarModule';
import ARKitCameraView from './specs/ARKitCameraNativeComponent';

const { width, height } = Dimensions.get('window');

function App() {
  const [lidarStatus, setLidarStatus] = useState({
    isActive: false,
    pointCount: 0,
    lastUpdate: 0,
    errorCount: 0,
  });
  const [cameraStatus, setCameraStatus] = useState({
    isActive: false,
    frameCount: 0,
  });
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(true);
  const webViewRef = useRef<any>(null);

  const toggleDebugPanel = () => {
    const newVisibility = !isDebugPanelVisible;
    setIsDebugPanelVisible(newVisibility);

    if (webViewRef.current) {
      try {
        const viewTag = findNodeHandle(webViewRef.current);
        UIManager.dispatchViewManagerCommand(viewTag, 'toggleDebugPanel', [
          newVisibility,
        ]);
        console.log('DEBUG: toggleDebugPanel called with:', newVisibility);
      } catch (error) {
        console.error('ERROR: toggleDebugPanel failed:', error);
      }
    }
  };

  const sendStatusToWebView = (lidar: any, camera: any) => {
    if (webViewRef.current) {
      console.log('TEST: CustomWebView current is working');
      console.log('TEST: lidar', lidar);
      console.log('TEST: camera', camera);

      const pointCloud = Array.isArray(lidar.pointCloud)
        ? lidar.pointCloud
        : [];
      const timestamp = Date.now();

      console.log('TEST: Sending pointCloud length:', pointCloud.length);
      console.log('TEST: Sending timestamp:', timestamp);

      try {
        const viewTag = findNodeHandle(webViewRef.current);
        console.log('TEST: viewTag:', viewTag);

        UIManager.dispatchViewManagerCommand(viewTag, 'sendLidarData', [
          pointCloud,
          timestamp,
        ]);
        console.log('TEST: UIManager.sendLidarData called successfully');
      } catch (error) {
        console.error('TEST: Error calling UIManager.sendLidarData:', error);
      }

      try {
        const viewTag = findNodeHandle(webViewRef.current);
        UIManager.dispatchViewManagerCommand(viewTag, 'sendCameraStatus', [
          camera.isActive,
          camera.frameCount,
        ]);
        console.log('TEST: UIManager.sendCameraStatus called successfully');
      } catch (error) {
        console.error('TEST: Error calling UIManager.sendCameraStatus:', error);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const pointCloud = await NativeLidarModule.getPointCloud();
        const newLidarStatus = {
          isActive: true,
          pointCount: pointCloud.length,
          pointCloud: pointCloud,
          lastUpdate: Date.now(),
          errorCount: lidarStatus.errorCount,
        };
        setLidarStatus(newLidarStatus);

        console.log('[App] Lidar - Points:', pointCloud.length);
        sendStatusToWebView(newLidarStatus, cameraStatus);
      } catch (error) {
        const newLidarStatus = {
          ...lidarStatus,
          isActive: false,
          errorCount: lidarStatus.errorCount + 1,
        };
        setLidarStatus(newLidarStatus);

        console.error('[App] Lidar error:', error);
        sendStatusToWebView(newLidarStatus, cameraStatus);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [lidarStatus.errorCount, cameraStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCameraStatus(prev => ({
        isActive: true,
        frameCount: prev.frameCount + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[App] Initializing CustomWebView...');
      sendStatusToWebView(lidarStatus, cameraStatus);

      if (webViewRef.current) {
        try {
          const viewTag = findNodeHandle(webViewRef.current);
          UIManager.dispatchViewManagerCommand(viewTag, 'toggleDebugPanel', [
            isDebugPanelVisible,
          ]);
          console.log(
            'DEBUG: Initial debug panel state set to:',
            isDebugPanelVisible,
          );
        } catch (error) {
          console.error('ERROR: Initial debug panel setup failed:', error);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [lidarStatus, cameraStatus, isDebugPanelVisible]);

  return (
    <View style={styles.container}>
      <ARKitCameraView style={StyleSheet.absoluteFill} />
      <CustomWebView
        ref={webViewRef}
        style={styles.webview}
        sourceURL={Platform.OS === 'ios' ? 'bundle://overlay.html' : ''}
        javaScriptEnabled={true}
      />
      <TouchableOpacity
        style={[
          styles.debugToggleButton,
          isDebugPanelVisible
            ? styles.debugToggleButtonActive
            : styles.debugToggleButtonInactive,
        ]}
        onPress={toggleDebugPanel}
        activeOpacity={0.7}
      >
        <Text style={styles.debugToggleText}>
          {isDebugPanelVisible ? '🔍' : '👁️‍🗨️'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'transparent',
    opacity: 1,
    zIndex: 1,
  },
  debugToggleButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  debugToggleButtonActive: {
    backgroundColor: 'rgba(0, 150, 255, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  debugToggleButtonInactive: {
    backgroundColor: 'rgba(100, 100, 100, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  debugToggleText: {
    fontSize: 24,
    color: 'white',
  },
});

export default App;
