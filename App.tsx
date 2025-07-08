import React from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import NativeLidarModule from './specs/NativeLidarModule';
import ARKitCameraView from './specs/ARKitCameraNativeComponent';

const { width, height } = Dimensions.get('window');

function App() {
  NativeLidarModule.getPointCloud();
  return (
    <View style={styles.container}>
      <ARKitCameraView style={StyleSheet.absoluteFill} />
      <WebView
        style={styles.webview}
        source={
          Platform.OS === 'ios'
            ? require('./assets/web/overlay.html')
            : { uri: '' }
        }
        originWhitelist={['*']}
        javaScriptEnabled={true}
        backgroundColor="transparent"
      />
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
    zIndex: 1,
  },
});

export default App;
