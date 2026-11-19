import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Header } from '@/components/common/Header';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

type AuthNavigationPreviewProps = {
  title: string;
  description: string;
  alternateTitle: string;
  alternateRoute: string;
};

export function AuthNavigationPreview({ title, description, alternateTitle, alternateRoute }: AuthNavigationPreviewProps) {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <Header title="TrumiTrip" subtitle="Your next stay starts here" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mark}>
          <Text style={styles.markText}>T</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Navigation preview</Text>
          <Text style={styles.noticeBody}>
            This screen is a route placeholder only. Authentication will be added in a later phase.
          </Text>
        </View>
        <Button title={alternateTitle} variant="outline" fullWidth onPress={() => router.push(alternateRoute as Href)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.large },
  mark: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.large, backgroundColor: colors.accentSubtle },
  markText: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  title: { marginTop: spacing.large, color: colors.primary, fontSize: 29, fontWeight: '800' },
  description: { marginTop: spacing.xsmall, color: colors.muted, fontSize: 15, lineHeight: 23 },
  notice: { marginVertical: spacing.large, padding: spacing.medium, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface },
  noticeTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  noticeBody: { marginTop: spacing.xsmall, color: colors.muted, fontSize: 13, lineHeight: 19 },
});
