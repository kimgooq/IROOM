#import "RCTCustomWebView.h"
#import "ARSessionManager.h"

#import <react/renderer/components/AppSpec/ComponentDescriptors.h>
#import <react/renderer/components/AppSpec/EventEmitters.h>
#import <react/renderer/components/AppSpec/Props.h>
#import <react/renderer/components/AppSpec/RCTComponentViewHelpers.h>
#import <WebKit/WebKit.h>

using namespace facebook::react;

@interface RCTCustomWebView () <RCTCustomWebViewViewProtocol, WKNavigationDelegate, WKScriptMessageHandler>
@end

@implementation RCTCustomWebView {
  WKWebView *_webView;
  NSURL *_sourceURL;
  BOOL _javaScriptEnabled;
}

- (instancetype)init {
  if (self = [super init]) {
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    
    config.preferences.javaScriptEnabled = YES;
    config.allowsInlineMediaPlayback = YES;
    config.suppressesIncrementalRendering = NO;
    
    WKUserContentController *contentController = [[WKUserContentController alloc] init];
    [contentController addScriptMessageHandler:self name:@"ReactNativeWebView"];
    config.userContentController = contentController;
    
    _webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    _webView.navigationDelegate = self;
    _javaScriptEnabled = YES;
    
    _webView.backgroundColor = [UIColor clearColor];
    _webView.opaque = NO;
    _webView.scrollView.backgroundColor = [UIColor clearColor];
    _webView.scrollView.opaque = NO;
    
    self.backgroundColor = [UIColor clearColor];
    self.opaque = NO;
    
    [self addSubview:_webView];
    
    NSLog(@"[RCTCustomWebView] WebView initialized");
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps = *std::static_pointer_cast<CustomWebViewProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<CustomWebViewProps const>(props);

  if (oldViewProps.sourceURL != newViewProps.sourceURL) {
    NSString *urlString = [NSString stringWithCString:newViewProps.sourceURL.c_str() encoding:NSUTF8StringEncoding];
    
    if ([urlString hasPrefix:@"bundle://"]) {
      NSString *fileName = [urlString substringFromIndex:9];
      
      NSString *filePath = [[NSBundle mainBundle] pathForResource:[fileName stringByDeletingPathExtension] 
                                                           ofType:[fileName pathExtension] 
                                                      inDirectory:@"assets/web"];
      
      if (!filePath) {
        filePath = [[NSBundle mainBundle] pathForResource:[fileName stringByDeletingPathExtension] 
                                                   ofType:[fileName pathExtension]];
      }
      
      if (filePath) {
        _sourceURL = [NSURL fileURLWithPath:filePath];
        NSLog(@"[RCTCustomWebView] Loading bundle file: %@ -> %@", fileName, filePath);
        [_webView loadRequest:[NSURLRequest requestWithURL:_sourceURL]];
      } else {
        NSLog(@"[RCTCustomWebView] Bundle file not found: %@", fileName);
      }
    } else {
      _sourceURL = [NSURL URLWithString:urlString];
      
      if (_sourceURL) {
        NSLog(@"[RCTCustomWebView] Loading URL: %@", urlString);
        [_webView loadRequest:[NSURLRequest requestWithURL:_sourceURL]];
      } else {
        NSLog(@"[RCTCustomWebView] Invalid URL: %@", urlString);
      }
    }
  }

  if (oldViewProps.javaScriptEnabled != newViewProps.javaScriptEnabled) {
    _javaScriptEnabled = newViewProps.javaScriptEnabled;
    _webView.configuration.preferences.javaScriptEnabled = _javaScriptEnabled;
    NSLog(@"[RCTCustomWebView] JavaScript enabled: %@", _javaScriptEnabled ? @"YES" : @"NO");
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  _webView.frame = self.bounds;
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
  NSLog(@"[RCTCustomWebView] Page loaded successfully");
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  NSLog(@"[RCTCustomWebView] Page load failed: %@", error.localizedDescription);
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
  if ([message.name isEqualToString:@"ReactNativeWebView"]) {
    NSString *messageBody = message.body;
    NSLog(@"[RCTCustomWebView] Received message from WebView: %@", messageBody);
  }
}

- (void)sendLidarData:(NSArray<NSNumber *> *)pointCloud timestamp:(NSNumber *)timestamp {
  NSDictionary *lidarData = @{
    @"type": @"lidarData",
    @"pointCloud": pointCloud,
    @"timestamp": timestamp
  };
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:lidarData options:0 error:&error];
  
  if (error) {
    NSLog(@"[RCTCustomWebView] Error serializing lidar data: %@", error.localizedDescription);
    return;
  }
  
  NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
  
  NSString *jsCode = [NSString stringWithFormat:@"window.receiveLidarData(%@);", jsonString];
  
  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_webView evaluateJavaScript:jsCode completionHandler:^(id result, NSError *error) {
      if (error) {
        NSLog(@"[RCTCustomWebView] Error sending lidar data to WebView: %@", error.localizedDescription);
      } else {
        NSLog(@"[RCTCustomWebView] Lidar data sent successfully, points: %lu", pointCloud.count);
      }
    }];
  });
  
}

- (void)sendLidarDataFromApp:(NSArray<NSNumber *> *)pointCloud timestamp:(NSNumber *)timestamp {
  NSLog(@"[RCTCustomWebView] sendLidarDataFromApp called with %lu points", pointCloud.count);
  [self sendLidarData:pointCloud timestamp:timestamp];
}

- (void)sendCameraStatusFromApp:(BOOL)isActive frameCount:(NSNumber *)frameCount {
  NSLog(@"[RCTCustomWebView] sendCameraStatusFromApp called - active: %@", isActive ? @"YES" : @"NO");
  [self sendCameraStatus:isActive frameCount:frameCount];
}

- (void)sendCameraStatus:(BOOL)isActive frameCount:(NSNumber *)frameCount {
  NSDictionary *cameraStatus = @{
    @"isActive": @(isActive),
    @"frameCount": frameCount ?: @0,
    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
  };
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:cameraStatus options:0 error:&error];
  
  if (error) {
    NSLog(@"[RCTCustomWebView] Error serializing camera status: %@", error.localizedDescription);
    return;
  }
  
  NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
  
  NSString *jsCode = [NSString stringWithFormat:@"window.receiveCameraStatus(%@);", jsonString];
  
  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_webView evaluateJavaScript:jsCode completionHandler:^(id result, NSError *error) {
      if (error) {
        NSLog(@"[RCTCustomWebView] Error sending camera status to WebView: %@", error.localizedDescription);
      } else {
        NSLog(@"[RCTCustomWebView] Camera status sent successfully: %@", isActive ? @"Active" : @"Inactive");
      }
    }];
  });
}

- (void)toggleDebugPanel:(BOOL)isVisible {
  NSString *jsCode = [NSString stringWithFormat:@"window.toggleDebugPanel(%@);", isVisible ? @"true" : @"false"];
  
  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_webView evaluateJavaScript:jsCode completionHandler:^(id result, NSError *error) {
      if (error) {
        NSLog(@"[RCTCustomWebView] Error toggling debug panel: %@", error.localizedDescription);
      } else {
        NSLog(@"[RCTCustomWebView] Debug panel toggled: %@", isVisible ? @"Visible" : @"Hidden");
      }
    }];
  });
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  NSLog(@"[RCTCustomWebView] handleCommand called: %@ with %lu args", commandName, (unsigned long)args.count);
  
  if ([commandName isEqualToString:@"sendLidarData"]) {
    NSLog(@"[RCTCustomWebView] Processing sendLidarData command");
    if (args.count >= 2) {
      NSArray<NSNumber *> *pointCloud = args[0];
      NSNumber *timestamp = args[1];
      NSLog(@"[RCTCustomWebView] Lidar data - points: %lu, timestamp: %@", pointCloud.count, timestamp);
      [self sendLidarData:pointCloud timestamp:timestamp];
    } else {
      NSLog(@"[RCTCustomWebView] sendLidarData: Insufficient arguments, got %lu", (unsigned long)args.count);
    }
  } else if ([commandName isEqualToString:@"sendCameraStatus"]) {
    NSLog(@"[RCTCustomWebView] Processing sendCameraStatus command");
    if (args.count >= 2) {
      BOOL isActive = [args[0] boolValue];
      NSNumber *frameCount = args[1];
      NSLog(@"[RCTCustomWebView] Camera status - active: %@, frameCount: %@", isActive ? @"YES" : @"NO", frameCount);
      [self sendCameraStatus:isActive frameCount:frameCount];
    } else {
      NSLog(@"[RCTCustomWebView] sendCameraStatus: Insufficient arguments, got %lu", (unsigned long)args.count);
    }
  } else if ([commandName isEqualToString:@"toggleDebugPanel"]) {
    NSLog(@"[RCTCustomWebView] Processing toggleDebugPanel command");
    if (args.count >= 1) {
      BOOL isVisible = [args[0] boolValue];
      NSLog(@"[RCTCustomWebView] Debug panel visibility: %@", isVisible ? @"YES" : @"NO");
      [self toggleDebugPanel:isVisible];
    } else {
      NSLog(@"[RCTCustomWebView] toggleDebugPanel: Insufficient arguments, got %lu", (unsigned long)args.count);
    }
  } else {
    NSLog(@"[RCTCustomWebView] Unknown command: %@", commandName);
  }
}

+ (facebook::react::ComponentDescriptorProvider)componentDescriptorProvider {
  return facebook::react::concreteComponentDescriptorProvider<
    facebook::react::CustomWebViewComponentDescriptor>();
}

@end 