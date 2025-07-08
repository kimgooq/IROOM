#import "RCTARKitCameraView.h"
#import <ARKit/ARKit.h>
#import <Metal/Metal.h>
#import <QuartzCore/CAMetalLayer.h>
#import <CoreVideo/CoreVideo.h>
#import <react/renderer/components/AppSpec/ComponentDescriptors.h>
#import <react/renderer/components/AppSpec/RCTComponentViewHelpers.h>
#import <ImageIO/ImageIO.h>

@interface RCTARKitCameraView () <ARSessionDelegate>
@end

@implementation RCTARKitCameraView {
  ARSession *_session;
  CAMetalLayer *_metalLayer;
  id<MTLDevice> _device;
  id<MTLCommandQueue> _commandQueue;
  CIContext *_ciContext;
}

+ (Class)layerClass {
    return [CAMetalLayer class];
}

- (instancetype)init {
    if (self = [super init]) {
        _device = MTLCreateSystemDefaultDevice();
        _metalLayer = (CAMetalLayer *)self.layer;
        _metalLayer.device = _device;
        _metalLayer.pixelFormat = MTLPixelFormatBGRA8Unorm;
        _metalLayer.framebufferOnly = NO; // <- 중요!
        NSLog(@"[ARKitCameraView] Metal device: %@", _device);

        _ciContext = [CIContext contextWithMTLDevice:_device];
        _commandQueue = [_device newCommandQueue];

        _session = [ARSession new];
        _session.delegate = self;
        if ([ARWorldTrackingConfiguration isSupported]) {
            ARWorldTrackingConfiguration *config = [ARWorldTrackingConfiguration new];
            if ([ARWorldTrackingConfiguration supportsFrameSemantics:ARFrameSemanticSceneDepth]) {
                config.frameSemantics = ARFrameSemanticSceneDepth;
            }
            [_session runWithConfiguration:config];
            NSLog(@"[ARKitCameraView] ARSession started");
        } else {
            NSLog(@"[ARKitCameraView] ARWorldTrackingConfiguration not supported");
        }
    }
    return self;
}

- (void)layoutSubviews {
    [super layoutSubviews];
    CGFloat scale = [UIScreen mainScreen].scale;
    CGSize size = self.bounds.size;
    _metalLayer.drawableSize = CGSizeMake(size.width * scale, size.height * scale);
    NSLog(@"[ARKitCameraView] layoutSubviews: drawableSize = %.0fx%.0f (scale: %.1f)", _metalLayer.drawableSize.width, _metalLayer.drawableSize.height, scale);
}

- (void)session:(ARSession *)session didUpdateFrame:(ARFrame *)frame {
    CVPixelBufferRef pixelBuffer = frame.capturedImage;
    NSLog(@"[ARKitCameraView] pixelBuffer size: %zu x %zu", CVPixelBufferGetWidth(pixelBuffer), CVPixelBufferGetHeight(pixelBuffer));

    CIImage *ciImageRaw = [CIImage imageWithCVPixelBuffer:pixelBuffer];
    NSLog(@"[ARKitCameraView] ciImageRaw extent: %.0fx%.0f %.0fx%.0f", ciImageRaw.extent.origin.x, ciImageRaw.extent.origin.y, ciImageRaw.extent.size.width, ciImageRaw.extent.size.height);

    CIImage *ciImage = [ciImageRaw imageByApplyingOrientation:kCGImagePropertyOrientationRight];
    NSLog(@"[ARKitCameraView] ciImageOriented extent: %.0fx%.0f %.0fx%.0f", ciImage.extent.origin.x, ciImage.extent.origin.y, ciImage.extent.size.width, ciImage.extent.size.height);

    // Aspect Fit transform 적용
    CGFloat imageWidth = ciImage.extent.size.width;
    CGFloat imageHeight = ciImage.extent.size.height;
    CGFloat destWidth = _metalLayer.drawableSize.width;
    CGFloat destHeight = _metalLayer.drawableSize.height;
    CGFloat scale = MIN(destWidth / imageWidth, destHeight / imageHeight);
    CGFloat scaledWidth = imageWidth * scale;
    CGFloat scaledHeight = imageHeight * scale;
    CGFloat x = (destWidth - scaledWidth) / 2.0;
    CGFloat y = (destHeight - scaledHeight) / 2.0;

    CGAffineTransform transform = CGAffineTransformMakeScale(scale, scale);
    transform = CGAffineTransformTranslate(transform, x / scale, y / scale);
    CIImage *fittedImage = [ciImage imageByApplyingTransform:transform];

    CGRect targetRect = CGRectMake(0, 0, destWidth, destHeight);
    NSLog(@"[ARKitCameraView] drawableSize: %.0fx%.0f, targetRect: %.0fx%.0f %.0fx%.0f", destWidth, destHeight, targetRect.origin.x, targetRect.origin.y, targetRect.size.width, targetRect.size.height);

    id<CAMetalDrawable> drawable = [_metalLayer nextDrawable];
    if (!drawable) {
        NSLog(@"[ARKitCameraView] No drawable");
        return;
    }

    id<MTLCommandBuffer> commandBuffer = [_commandQueue commandBuffer];
    if (!commandBuffer) {
        NSLog(@"[ARKitCameraView] No commandBuffer");
        return;
    }

    [_ciContext render:fittedImage
           toMTLTexture:drawable.texture
           commandBuffer:commandBuffer
           bounds:targetRect
           colorSpace:CGColorSpaceCreateDeviceRGB()];

    [commandBuffer presentDrawable:drawable];
    [commandBuffer commit];
    NSLog(@"[ARKitCameraView] Frame rendered");
}

+ (facebook::react::ComponentDescriptorProvider)componentDescriptorProvider
{
  return facebook::react::concreteComponentDescriptorProvider<
    facebook::react::ARKitCameraViewComponentDescriptor>();
}

@end 
