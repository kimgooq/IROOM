#import "RCTNativeLidarModule.h"
#import "../ARKitCameraView/ARSessionManager.h"
#import <ARKit/ARKit.h>

@interface RCTNativeLidarModule()
@end

@implementation RCTNativeLidarModule

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeLidarModuleSpecJSI>(params);
}

- (instancetype)init {
  if (self = [super init]) {
    [[ARSessionManager sharedInstance] startSession];
    NSLog(@"[NativeLidarModule] Using shared ARSession");
  }
  return self;
}

- (void)getPointCloud:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  ARSession *session = [[ARSessionManager sharedInstance] getSession];
  ARFrame *frame = session.currentFrame;
  if (!frame || !frame.sceneDepth) {
    resolve(@[]);
    return;
  }

  ARDepthData *depth = frame.sceneDepth;
  CVPixelBufferRef depthMap = depth.depthMap;

  CVPixelBufferLockBaseAddress(depthMap, 0);
  size_t width = CVPixelBufferGetWidth(depthMap);
  size_t height = CVPixelBufferGetHeight(depthMap);
  float *data = (float *)CVPixelBufferGetBaseAddress(depthMap);

  NSMutableArray *result = [NSMutableArray array];
  for (int i = 0; i < width * height; i += 1000) {
    float z = data[i];
    [result addObject:@(0)];
    [result addObject:@(0)];
    [result addObject:@(z)];
  }

  CVPixelBufferUnlockBaseAddress(depthMap, 0);
  resolve(result);
}

+ (NSString *)moduleName
{
  return @"NativeLidarModule";
}

@end
