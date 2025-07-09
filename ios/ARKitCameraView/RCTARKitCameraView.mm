#import "RCTARKitCameraView.h"
#import "ARSessionManager.h"
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
        _metalLayer.framebufferOnly = NO;

        _ciContext = [CIContext contextWithMTLDevice:_device];
        _commandQueue = [_device newCommandQueue];

        ARSession *session = [[ARSessionManager sharedInstance] getSession];
        session.delegate = self;
        [[ARSessionManager sharedInstance] startSession];
    }
    return self;
}

- (void)layoutSubviews {
    [super layoutSubviews];
    CGFloat scale = [UIScreen mainScreen].scale;
    CGSize size = self.bounds.size;
    _metalLayer.drawableSize = CGSizeMake(size.width * scale, size.height * scale);
}

- (void)session:(ARSession *)session didUpdateFrame:(ARFrame *)frame {
    CVPixelBufferRef pixelBuffer = frame.capturedImage;
    CIImage *ciImageRaw = [CIImage imageWithCVPixelBuffer:pixelBuffer];
    CIImage *ciImage = [ciImageRaw imageByApplyingOrientation:kCGImagePropertyOrientationRight];

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

    id<CAMetalDrawable> drawable = [_metalLayer nextDrawable];
    if (!drawable) {
        return;
    }

    id<MTLCommandBuffer> commandBuffer = [_commandQueue commandBuffer];
    if (!commandBuffer) {
        return;
    }

    [_ciContext render:fittedImage
           toMTLTexture:drawable.texture
           commandBuffer:commandBuffer
           bounds:targetRect
           colorSpace:CGColorSpaceCreateDeviceRGB()];

    [commandBuffer presentDrawable:drawable];
    [commandBuffer commit];
}

+ (facebook::react::ComponentDescriptorProvider)componentDescriptorProvider
{
  return facebook::react::concreteComponentDescriptorProvider<
    facebook::react::ARKitCameraViewComponentDescriptor>();
}

@end 
