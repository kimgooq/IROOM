/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NativeLidarModule from './specs/NativeLidarModule';

function App() {
  const [value, setValue] = React.useState<string>('');
  const [random, setRandom] = React.useState<number>(0);

  React.useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const data = await NativeLidarModule.getPointCloud();
        setValue(JSON.stringify(data));
      } catch (e) {
        setValue('Lidar data error: ' + String(e));
      }
      setRandom(Math.floor(Math.random() * 10000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Lidar Data: {value}</Text>
      <Text style={styles.text}>Random: {random}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    margin: 10,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
});

export default App;
