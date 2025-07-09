let scene, camera, renderer, clock;
let pointCloudMesh = null;
let animationId = null;
let isThreeJSInitialized = false;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;
let performanceMonitor = null;

const performanceStats = {
  lastUpdateTime: 0,
  pointCloudUpdateCount: 0,
  memoryUsage: { used: 0, total: 0 },
  renderTime: 0,
  isMonitoringEnabled: true,
};

const errorManager = {
  errorCount: 0,
  lastError: null,
  maxRetries: 3,
  retryCount: 0,
};

function sendMessageToNative(message) {
  try {
    if (
      typeof window !== 'undefined' &&
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.reactNative
    ) {
      window.webkit.messageHandlers.reactNative.postMessage(
        JSON.stringify({
          type: 'log',
          message: message,
          timestamp: Date.now(),
        }),
      );
    }
  } catch (error) {
    console.error('Native communication error:', error);
  }
}

function safeLog(message, level = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const formattedMessage = `[${timestamp}] ${message}`;

  console[level](formattedMessage);
  sendMessageToNative(`[WebView-${level.toUpperCase()}] ${formattedMessage}`);
}

function showError(message, duration = 5000) {
  const errorElement = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');

  if (errorElement && errorText) {
    errorText.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
      errorElement.style.display = 'none';
    }, duration);
  }

  safeLog(`ERROR: ${message}`, 'error');
}

function setLoadingState(isLoading) {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.style.display = isLoading ? 'block' : 'none';
  }
}

function estimateMemoryUsage() {
  try {
    if (window.performance && window.performance.memory) {
      return {
        used: Math.round(
          window.performance.memory.usedJSHeapSize / 1024 / 1024,
        ),
        total: Math.round(
          window.performance.memory.totalJSHeapSize / 1024 / 1024,
        ),
      };
    }
  } catch (error) {}
  return { used: 0, total: 0 };
}

class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = true;
    this.enableZoom = true;
    this.enablePan = true;
    this.enableDamping = true;
    this.dampingFactor = 0.05;

    this.spherical = {
      radius: 5,
      phi: Math.PI / 2,
      theta: 0,
    };

    this.target = new THREE.Vector3();
    this.isRotating = false;
    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    this.bindEvents();
    this.update();
  }

  bindEvents() {
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));

    this.domElement.addEventListener(
      'touchstart',
      this.onTouchStart.bind(this),
    );
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  onMouseDown(event) {
    if (!this.enabled) return;
    this.isRotating = true;
    this.rotateStart.set(event.clientX, event.clientY);
  }

  onMouseMove(event) {
    if (!this.enabled || !this.isRotating) return;

    this.rotateEnd.set(event.clientX, event.clientY);
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);

    const element = this.domElement;
    this.spherical.theta -=
      (2 * Math.PI * this.rotateDelta.x) / element.clientWidth;
    this.spherical.phi -=
      (2 * Math.PI * this.rotateDelta.y) / element.clientHeight;

    this.spherical.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.spherical.phi),
    );

    this.rotateStart.copy(this.rotateEnd);
  }

  onMouseUp() {
    this.isRotating = false;
  }

  onMouseWheel(event) {
    if (!this.enabled || !this.enableZoom) return;

    event.preventDefault();
    this.spherical.radius *= event.deltaY > 0 ? 1.1 : 0.9;
    this.spherical.radius = Math.max(1, Math.min(100, this.spherical.radius));
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      this.onMouseDown({
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
      });
    }
  }

  onTouchMove(event) {
    if (event.touches.length === 1) {
      event.preventDefault();
      this.onMouseMove({
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
      });
    }
  }

  onTouchEnd() {
    this.onMouseUp();
  }

  update() {
    if (!this.enabled) return;

    const x =
      this.spherical.radius *
      Math.sin(this.spherical.phi) *
      Math.cos(this.spherical.theta);
    const y = this.spherical.radius * Math.cos(this.spherical.phi);
    const z =
      this.spherical.radius *
      Math.sin(this.spherical.phi) *
      Math.sin(this.spherical.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);

    return true;
  }
}

function initThreeJS() {
  try {
    safeLog('Three.js 초기화 시작...');

    if (typeof THREE === 'undefined') {
      throw new Error('Three.js 라이브러리가 로드되지 않았습니다.');
    }

    if (!THREE.Scene || !THREE.PerspectiveCamera || !THREE.WebGLRenderer) {
      throw new Error('Three.js 필수 클래스들이 누락되었습니다.');
    }

    safeLog('Three.js 라이브러리 확인 완료');

    const container = document.getElementById('three-container');
    if (!container) {
      throw new Error('three-container 엘리먼트를 찾을 수 없습니다.');
    }

    scene = new THREE.Scene();
    scene.background = null;

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 2, 5);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = 'transparent';
    container.appendChild(renderer.domElement);

    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    window.controls = controls;

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = false;
    scene.add(directionalLight);

    createTestPointCloud();

    animate();

    startPerformanceMonitoring();

    isThreeJSInitialized = true;
    updateThreeJSStatus('준비 완료');
    setLoadingState(false);

    safeLog('Three.js 초기화 완료');
    sendMessageToNative('Three.js WebView 초기화 완료');
  } catch (error) {
    errorManager.errorCount++;
    errorManager.lastError = error.message;

    showError(`Three.js 초기화 실패: ${error.message}`);
    updateThreeJSStatus('초기화 실패');
    setLoadingState(false);

    if (errorManager.retryCount < errorManager.maxRetries) {
      setTimeout(() => {
        errorManager.retryCount++;
        safeLog(
          `Three.js 재시도 ${errorManager.retryCount}/${errorManager.maxRetries}`,
        );
        initThreeJS();
      }, 2000);
    }
  }
}

function createTestPointCloud() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < 500; i++) {
    const radius = Math.random() * 3 + 1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    const normalizedRadius = radius / 4;
    colors.push(
      1 - normalizedRadius,
      normalizedRadius,
      0.5 + normalizedRadius * 0.3,
    );
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  });

  if (pointCloudMesh) {
    scene.remove(pointCloudMesh);
    pointCloudMesh.geometry.dispose();
    pointCloudMesh.material.dispose();
  }

  pointCloudMesh = new THREE.Points(geometry, material);
  scene.add(pointCloudMesh);

  updatePointCountDisplay(positions.length / 3);
  safeLog(`테스트 포인트 클라우드 생성: ${positions.length / 3}개 포인트`);
}

function updatePointCloud(pointCloudData) {
  try {
    if (!pointCloudData || pointCloudData.length === 0) {
      safeLog('포인트 클라우드 데이터가 없습니다.');
      return;
    }

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    for (let i = 0; i < pointCloudData.length; i += 3) {
      if (i + 2 < pointCloudData.length) {
        const x = pointCloudData[i] || 0;
        const y = pointCloudData[i + 1] || 0;
        const z = pointCloudData[i + 2] || 0;

        positions.push(x, y, z);

        const distance = Math.sqrt(x * x + y * y + z * z);
        const normalizedDistance = Math.min(distance / 8, 1);

        colors.push(
          1 - normalizedDistance * 0.5,
          normalizedDistance * 0.8,
          0.3 + normalizedDistance * 0.4,
        );
      }
    }

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      alphaTest: 0.1,
    });

    if (pointCloudMesh) {
      scene.remove(pointCloudMesh);
      pointCloudMesh.geometry.dispose();
      pointCloudMesh.material.dispose();
    }

    pointCloudMesh = new THREE.Points(geometry, material);
    scene.add(pointCloudMesh);

    const pointCount = positions.length / 3;
    updatePointCountDisplay(pointCount);
    updateLidarStatus(true);

    performanceStats.pointCloudUpdateCount++;
    performanceStats.lastUpdateTime = Date.now();

    safeLog(`포인트 클라우드 업데이트: ${pointCount}개 포인트`);
  } catch (error) {
    safeLog(`포인트 클라우드 업데이트 에러: ${error.message}`, 'error');
    updateLidarStatus(false);
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);

  if (!isThreeJSInitialized) return;

  const now = window.performance.now();
  const delta = clock.getDelta();

  frameCount++;
  if (now - lastFrameTime >= 1000) {
    fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    frameCount = 0;
    lastFrameTime = now;
    updateFPSDisplay(fps);
  }

  if (window.controls) {
    window.controls.update();
  }

  if (pointCloudMesh) {
    pointCloudMesh.rotation.y += 0.003;
  }

  const renderStart = window.performance.now();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  performanceStats.renderTime = window.performance.now() - renderStart;
}

function startPerformanceMonitoring() {
  if (!performanceStats.isMonitoringEnabled) return;

  performanceMonitor = setInterval(() => {
    const memoryInfo = estimateMemoryUsage();
    performanceStats.memoryUsage = memoryInfo;
    updateMemoryDisplay(memoryInfo);

    if (performanceStats.lastUpdateTime > 0) {
      const timeSinceUpdate = Date.now() - performanceStats.lastUpdateTime;
      updateLastUpdateDisplay(timeSinceUpdate);
    }
  }, 2000);
}

function onWindowResize() {
  if (!isThreeJSInitialized) return;

  try {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    safeLog(`창 크기 변경: ${width}x${height}`);
  } catch (error) {
    safeLog(`창 크기 변경 에러: ${error.message}`, 'error');
  }
}

window.receiveLidarData = function (data) {
  try {
    safeLog(`[receiveLidarData] 호출됨: ${JSON.stringify(data)}`);

    if (!data) {
      safeLog('Lidar 데이터가 null입니다.');
      return;
    }

    if (data.type === 'lidarData' && data.pointCloud) {
      safeLog(
        `[receiveLidarData] 포인트 클라우드 업데이트: ${data.pointCloud.length}개 포인트`,
      );
      updatePointCloud(data.pointCloud);
    } else if (data.type === 'error') {
      showError(`Lidar 에러: ${data.message}`);
      updateLidarStatus(false);
    } else {
      safeLog(
        `[receiveLidarData] 예상하지 못한 데이터 형식: ${JSON.stringify(data)}`,
      );
    }
  } catch (error) {
    safeLog(`Lidar 데이터 처리 에러: ${error.message}`, 'error');
    updateLidarStatus(false);
  }
};

window.receiveCameraStatus = function (status) {
  try {
    safeLog(`카메라 상태 수신: ${JSON.stringify(status)}`);

    if (typeof status === 'object' && status !== null) {
      updateCameraStatus(status.isActive ? '활성' : '비활성');
      if (status.error) {
        showError(`카메라 에러: ${status.error}`);
      }
    } else {
      updateCameraStatus(status ? '활성' : '비활성');
    }
  } catch (error) {
    safeLog(`카메라 상태 처리 에러: ${error.message}`, 'error');
  }
};

window.testCameraStatus = function () {
  updateCameraStatus('활성');
  safeLog('카메라 상태 테스트 - 활성으로 설정');
};

window.toggleDebugPanel = function (isVisible) {
  try {
    const debugPanel = document.querySelector('.status-overlay');
    if (debugPanel) {
      if (isVisible) {
        debugPanel.classList.remove('hidden');
      } else {
        debugPanel.classList.add('hidden');
      }
      safeLog(`Debug panel ${isVisible ? 'shown' : 'hidden'}`);
    } else {
      safeLog('Debug panel element not found', 'warn');
    }
  } catch (error) {
    safeLog(`Debug panel toggle error: ${error.message}`, 'error');
  }
};

function updateThreeJSStatus(status) {
  try {
    const element = document.getElementById('threejs-status');
    if (element) {
      element.textContent = status;
    } else {
      safeLog('threejs-status 요소를 찾을 수 없습니다.', 'warn');
    }
  } catch (error) {
    safeLog(`updateThreeJSStatus 에러: ${error.message}`, 'error');
  }
}

function updateCameraStatus(status) {
  const indicator = document.getElementById('camera-indicator');
  const statusElement = document.getElementById('camera-status');

  if (indicator && statusElement) {
    statusElement.textContent = status;
    indicator.className = `status-indicator ${
      status === '활성' ? 'status-active' : 'status-inactive'
    }`;
  }
}

function updateLidarStatus(isActive) {
  const indicator = document.getElementById('lidar-indicator');
  const statusElement = document.getElementById('lidar-status');

  if (indicator && statusElement) {
    statusElement.textContent = isActive ? '활성' : '비활성';
    indicator.className = `status-indicator ${
      isActive ? 'status-active' : 'status-inactive'
    }`;
  }
}

function updatePointCountDisplay(count) {
  const element = document.getElementById('point-count');
  if (element) element.textContent = count.toLocaleString();
}

function updateFPSDisplay(fps) {
  const element = document.getElementById('fps-counter');
  if (element) {
    element.textContent = fps.toString();
    element.style.color =
      fps > 30 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 152, 0, 0.8)';
  }
}

function updateMemoryDisplay(memoryInfo) {
  const element = document.getElementById('memory-usage');
  if (element) {
    element.textContent = `${memoryInfo.used}MB`;
    element.style.color =
      memoryInfo.used > 100
        ? 'rgba(244, 67, 54, 0.8)'
        : 'rgba(255, 255, 255, 0.8)';
  }
}

function updateLastUpdateDisplay(timeSinceUpdate) {
  const element = document.getElementById('last-update');
  if (element) {
    const seconds = Math.floor(timeSinceUpdate / 1000);
    element.textContent = `${seconds}초 전`;
    element.style.color =
      seconds > 5 ? 'rgba(255, 152, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
  }
}

function cleanup() {
  try {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (performanceMonitor) {
      clearInterval(performanceMonitor);
      performanceMonitor = null;
    }

    if (pointCloudMesh) {
      scene.remove(pointCloudMesh);
      pointCloudMesh.geometry.dispose();
      pointCloudMesh.material.dispose();
      pointCloudMesh = null;
    }

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    safeLog('리소스 정리 완료');
  } catch (error) {
    safeLog(`리소스 정리 에러: ${error.message}`, 'error');
  }
}

function isDOMReady() {
  return (
    document.readyState === 'complete' || document.readyState === 'interactive'
  );
}

function initializeApp() {
  safeLog('앱 초기화 시작...');
  setLoadingState(true);

  const requiredElements = [
    'three-container',
    'loading-spinner',
    'error-message',
    'threejs-status',
    'camera-status',
    'lidar-status',
  ];

  for (const elementId of requiredElements) {
    if (!document.getElementById(elementId)) {
      const error = `필수 DOM 요소 '${elementId}'를 찾을 수 없습니다.`;
      safeLog(error, 'error');
      showError(error);
      return;
    }
  }

  safeLog('DOM 요소 확인 완료');

  if (typeof THREE === 'undefined') {
    safeLog(
      'Three.js 라이브러리가 아직 로드되지 않았습니다. 재시도 중...',
      'warn',
    );

    setTimeout(() => {
      if (typeof THREE === 'undefined') {
        showError(
          'Three.js 라이브러리 로드 실패. 네트워크 연결을 확인해주세요.',
        );
        updateThreeJSStatus('라이브러리 로드 실패');
        setLoadingState(false);
      } else {
        initThreeJS();
      }
    }, 1000);
  } else {
    setTimeout(() => {
      initThreeJS();
    }, 100);
  }

  window.addEventListener('resize', onWindowResize);

  window.addEventListener('beforeunload', cleanup);

  sendMessageToNative('Three.js WebView DOM 준비 완료');

  setTimeout(() => {
    safeLog('카메라 상태 테스트 시작');
    window.testCameraStatus();
  }, 5000);

  setTimeout(() => {
    let testCounter = 0;
    const testInterval = setInterval(() => {
      testCounter += 50;

      updatePointCountDisplay(testCounter);
      updateMemoryDisplay({ used: 45 + (testCounter % 20), total: 150 });
      updateLastUpdateDisplay(
        Date.now() - performanceStats.lastUpdateTime || 1000,
      );
      updateLidarStatus(true);

      safeLog(
        `[테스트] 포인트 수: ${testCounter}, 메모리: ${
          45 + (testCounter % 20)
        }MB`,
      );

      if (testCounter >= 500) {
        clearInterval(testInterval);
        safeLog('[테스트] 주기적 업데이트 테스트 완료');
      }
    }, 2000);
  }, 10000);

  safeLog('이벤트 리스너 등록 완료');
}

if (isDOMReady()) {
  initializeApp();
} else {
  document.addEventListener('DOMContentLoaded', initializeApp);
}

window.addEventListener('error', function (event) {
  const errorMessage = event.error?.message || event.message || 'Unknown error';
  const fileName = event.filename || 'unknown file';
  const lineNumber = event.lineno || 'unknown line';
  const columnNumber = event.colno || 'unknown column';

  const detailedError = `${errorMessage} at ${fileName}:${lineNumber}:${columnNumber}`;

  safeLog(`[전역 에러] ${detailedError}`, 'error');
  safeLog(`[에러 스택] ${event.error?.stack || 'No stack trace'}`, 'error');

  showError(`JavaScript 에러: ${errorMessage}`);
});

window.addEventListener('unhandledrejection', function (event) {
  safeLog(`Promise 거부: ${event.reason}`, 'error');
  showError(`비동기 처리 오류: ${event.reason}`);
});

safeLog('Three.js WebView 스크립트 로드 완료');
