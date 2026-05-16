import { View } from 'react-native';
import { KurumaLogo } from 'components/KurumaLogo';

export function AppHeader() {
  return (
    <View className="mb-8 items-start">
      <KurumaLogo />
    </View>
  );
}
