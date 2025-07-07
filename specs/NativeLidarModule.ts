import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getPointCloud(): Promise<Array<number>>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeLidarModule');
