//
//  ARSessionManager.mm
//  IROOM
//
//  Shared ARSession Manager for ARKit Camera and Lidar
//

#import "ARSessionManager.h"

@implementation ARSessionManager {
    ARSession *_session;
    BOOL _isSessionStarted;
}

+ (instancetype)sharedInstance {
    static ARSessionManager *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    if (self = [super init]) {
        _session = [ARSession new];
        _isSessionStarted = NO;
        NSLog(@"[ARSessionManager] ARSession created");
    }
    return self;
}

- (ARSession *)getSession {
    return _session;
}

- (void)startSession {
    if (_isSessionStarted) {
        NSLog(@"[ARSessionManager] Session already started");
        return;
    }
    
    if ([ARWorldTrackingConfiguration isSupported]) {
        ARWorldTrackingConfiguration *config = [ARWorldTrackingConfiguration new];
        
        // Scene depth (Lidar) 지원 체크
        if ([ARWorldTrackingConfiguration supportsFrameSemantics:ARFrameSemanticSceneDepth]) {
            config.frameSemantics = ARFrameSemanticSceneDepth;
            NSLog(@"[ARSessionManager] Scene depth enabled");
        } else {
            NSLog(@"[ARSessionManager] Scene depth not supported");
        }
        
        [_session runWithConfiguration:config];
        _isSessionStarted = YES;
        NSLog(@"[ARSessionManager] ARSession started successfully");
    } else {
        NSLog(@"[ARSessionManager] ARWorldTrackingConfiguration not supported");
    }
}

- (void)stopSession {
    if (_isSessionStarted) {
        [_session pause];
        _isSessionStarted = NO;
        NSLog(@"[ARSessionManager] ARSession stopped");
    }
}

@end 