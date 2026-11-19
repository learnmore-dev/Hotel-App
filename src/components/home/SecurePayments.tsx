import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PaymentMethod = {
  id: string;
  label: string;
  sub: string;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'upi', label: 'UPI', sub: 'GPay, PhonePe, Paytm' },
  { id: 'visa', label: 'VISA', sub: 'Debit & Credit' },
  { id: 'mc', label: 'Mastercard', sub: 'Debit & Credit' },
  { id: 'rupay', label: 'RuPay', sub: 'Indian Cards' },
  { id: 'nb', label: 'NetBanking', sub: '50+ Banks' },
  { id: 'amex', label: 'Amex', sub: 'Global Cards' },
];

export function SecurePayments() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.shieldIconWrap}>
            <Ionicons name="shield-checkmark" size={24} color="#E5B83F" />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.title}>100% Safe & Secure Payments</Text>
            <Text style={styles.subtitle}>
              Bank-grade 256-bit SSL encryption & official Razorpay gateway
            </Text>
          </View>
        </View>

        {/* Payment Badges Grid */}
        <View style={styles.methodsGrid}>
          {PAYMENT_METHODS.map((method) => (
            <View key={method.id} style={styles.methodBadge}>
              <Text style={styles.methodLabel}>{method.label}</Text>
              <Text numberOfLines={1} style={styles.methodSub}>
                {method.sub}
              </Text>
            </View>
          ))}
        </View>

        {/* Security checklist */}
        <View style={styles.checklist}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.checkText}>Zero Hidden Fees</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.checkText}>Instant Voucher</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.checkText}>Fraud Protected</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  card: {
    backgroundColor: '#0B1930',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  shieldIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 184, 63, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  methodBadge: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  methodLabel: {
    color: '#E5B83F',
    fontSize: 13,
    fontWeight: '900',
  },
  methodSub: {
    color: '#94A3B8',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  checklist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
});
