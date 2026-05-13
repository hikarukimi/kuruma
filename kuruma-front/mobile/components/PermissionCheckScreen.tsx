import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

const permissions = [
  { label: '摄像头权限', granted: true },
  { label: '麦克风权限', granted: true },
  { label: '定位权限', granted: false },
];

export function PermissionCheckScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>使用前检查</Text>

        <View style={styles.list}>
          {permissions.map((permission) => (
            <View key={permission.label} style={styles.permissionRow}>
              <Text
                style={[styles.checkMark, permission.granted ? styles.checked : styles.unchecked]}>
                {permission.granted ? '✓' : ' '}
              </Text>
              <Text style={styles.permissionText}>{permission.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.description}>事故处理需要采集现场画面、声音和定位信息。</Text>

        <View style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>授权并继续</Text>
        </View>

        <View style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>稍后再说</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  list: {
    gap: 18,
    marginBottom: 32,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  checkMark: {
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 16,
    height: 28,
    lineHeight: 26,
    marginRight: 12,
    overflow: 'hidden',
    textAlign: 'center',
    width: 28,
  },
  checked: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    color: '#15803d',
  },
  unchecked: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#ffffff',
  },
  permissionText: {
    color: '#1f2937',
    fontSize: 18,
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 36,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 17,
    fontWeight: '600',
  },
});
