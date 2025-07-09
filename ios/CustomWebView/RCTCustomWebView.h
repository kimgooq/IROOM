#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTCustomWebView : RCTViewComponentView

- (void)sendLidarData:(NSArray<NSNumber *> *)pointCloud timestamp:(NSNumber *)timestamp;
- (void)sendCameraStatus:(BOOL)isActive frameCount:(NSNumber *)frameCount;
- (void)toggleDebugPanel:(BOOL)isVisible;

- (void)sendLidarDataFromApp:(NSArray<NSNumber *> *)pointCloud timestamp:(NSNumber *)timestamp;
- (void)sendCameraStatusFromApp:(BOOL)isActive frameCount:(NSNumber *)frameCount;

@end

NS_ASSUME_NONNULL_END 