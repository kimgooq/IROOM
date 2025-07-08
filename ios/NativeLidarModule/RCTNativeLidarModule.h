//
//  RCTNativeLidarModule.h
//  IROOM
//
//  Created by jonghoon on 7/7/25.
//

#import <Foundation/Foundation.h>
#import <AppSpec/AppSpec.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTNativeLidarModule : NSObject <NativeLidarModuleSpec>
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params;
- (void)getPointCloud:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
@end

NS_ASSUME_NONNULL_END
