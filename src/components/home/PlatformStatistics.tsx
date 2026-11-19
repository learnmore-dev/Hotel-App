import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type StatItem = {
  id: string;
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STATS: StatItem[] = [
  {
    id: 'hotels',
    value: '100,000+',
    label: 'Hotels Worldwide',
    icon: 'business',
  },
  {
    id: 'customers',
    value: '10M+',
    label: 'Happy Customers',
    icon: 'people',
  },
  {
    id: 'countries',
    value: '200+',
    label: 'Countries Covered',
    icon: 'globe',
  },
  {
    id: 'rating',
    value: '4.9 ★',
    label: 'Customer Rating',
    icon: 'ribbon',
  },
];

export function PlatformStatistics() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.grid}>
          {STATS.map((stat, index) => (
            <View
              key={stat.id}
              style={[
                styles.statCard,
                index % 2 === 0 ? styles.statCardLeft : styles.statCardRight,
                index >= 2 && styles.statCardBottom,
              ]}>
              <View style={styles.iconCircle}>
                <Ionicons name={stat.icon} size={18} color="#E5B83F" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  container: {
    backgroundColor: '#07172F',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    width: '50%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statCardLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    paddingRight: 10,
  },
  statCardRight: {
    paddingLeft: 10,
  },
  statCardBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(229, 184, 63, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    color: '#E5B83F',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
});
