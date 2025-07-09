//
//  ARSessionManager.h
//  IROOM
//
//  Shared ARSession Manager for ARKit Camera and Lidar
//

#import <Foundation/Foundation.h>
#import <ARKit/ARKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ARSessionManager : NSObject

+ (instancetype)sharedInstance;
- (ARSession *)getSession;
- (void)startSession;
- (void)stopSession;

@end

NS_ASSUME_NONNULL_END 