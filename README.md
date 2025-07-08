# IROOM

A React Native project integrating ARKit camera preview and Lidar data using the new architecture (Fabric Component + TurboModule).

## Features

- **ARKit Camera Preview**: Native camera frames rendered in a custom Fabric component using Metal and CoreImage.
- **Lidar Data Access**: Lidar point cloud data delivered to JavaScript via TurboModule.
- **Overlay Support**: Easily overlay React Native or WebView content on top of the camera preview.

## Structure

- `ios/ARKitCameraView/`: Native iOS implementation of the ARKit camera view (Fabric component).
- `ios/NativeLidarModule/`: Native iOS TurboModule for Lidar data.

## Getting Started

1. **iOS only** (requires a device with ARKit and Lidar support)
2. Install dependencies: `npm install`
3. Install CocoaPods dependencies:
   ```sh
   cd ios
   bundle exec pod install
   ```
4. Open the `ios/IROOM.xcworkspace` file in Xcode.
5. Build and run the app on a real device using Xcode.

## Notes

- Camera preview and Lidar data run in parallel, using the new React Native architecture.
- For best results, test on a real device.

---
