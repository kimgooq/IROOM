//
//  RCTNativeLidarModule.m
//  IROOM
//
//  Created by jonghoon on 7/7/25.
//

#import "RCTNativeLidarModule.h"
#import <ARKit/ARKit.h>

//static NSString *const RCTNativeLidarModuleKey = @"lidar-module";

@interface RCTNativeLidarModule()
//@property (strong, nonatomic) NSUserDefaults *lidarModule;
@end

@implementation RCTNativeLidarModule {
  ARSession *_session;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeLidarModuleSpecJSI>(params);
}

- (instancetype)init {
  if (self = [super init]) {
    _session = [ARSession new];
    ARWorldTrackingConfiguration *config = [ARWorldTrackingConfiguration new];

    if ([ARWorldTrackingConfiguration supportsFrameSemantics:ARFrameSemanticSceneDepth]) {
      config.frameSemantics = ARFrameSemanticSceneDepth;
    }

    [_session runWithConfiguration:config];
  }
  return self;
}

- (void)getPointCloud:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  ARFrame *frame = _session.currentFrame;
  if (!frame || !frame.sceneDepth) {
    resolve(@[]);
    return;
  }

  // 간단한 예: depth map에서 xyz 포인트 1개 추출
  ARDepthData *depth = frame.sceneDepth;
  CVPixelBufferRef depthMap = depth.depthMap;

  CVPixelBufferLockBaseAddress(depthMap, 0);
  size_t width = CVPixelBufferGetWidth(depthMap);
  size_t height = CVPixelBufferGetHeight(depthMap);
  float *data = (float *)CVPixelBufferGetBaseAddress(depthMap);

  NSMutableArray *result = [NSMutableArray array];
  for (int i = 0; i < width * height; i += 1000) { // downsample for demo
    float z = data[i];
    [result addObject:@(0)]; // dummy x
    [result addObject:@(0)]; // dummy y
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
