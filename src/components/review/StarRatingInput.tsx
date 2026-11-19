import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export type StarRatingInputProps = {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
  accessibilityLabel?: string;
};

export function StarRatingInput({
  rating,
  onRatingChange,
  size = 28,
  readOnly = false,
  accessibilityLabel,
}: StarRatingInputProps) {
  const stars = [1, 2, 3, 4, 5];

  const isInteractive = !readOnly && Boolean(onRatingChange);

  return (
    <View
      accessibilityRole={!isInteractive ? 'text' : undefined}
      accessibilityLabel={!isInteractive ? (accessibilityLabel ?? `Rating: ${rating} out of 5 stars`) : undefined}
      style={styles.container}
    >
      {stars.map((starValue) => {
        const isFilled = starValue <= rating;
        const starChar = '★';

        if (readOnly || !onRatingChange) {
          return (
            <Text
              key={starValue}
              style={[
                styles.star,
                { fontSize: size },
                isFilled ? styles.starFilled : styles.starEmpty,
              ]}
            >
              {starChar}
            </Text>
          );
        }

        return (
          <Pressable
            key={starValue}
            testID={`star-rating-${starValue}`}
            accessibilityRole="button"
            accessibilityLabel={`${starValue} star${starValue > 1 ? 's' : ''}`}
            hitSlop={6}
            onPress={() => onRatingChange(starValue)}
            style={styles.starButton}
          >
            <Text
              style={[
                styles.star,
                { fontSize: size },
                isFilled ? styles.starFilled : styles.starEmpty,
              ]}
            >
              {starChar}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxsmall,
  },
  starButton: {
    padding: spacing.xxxsmall,
  },
  star: {
    lineHeight: 32,
  },
  starFilled: {
    color: colors.accent,
  },
  starEmpty: {
    color: colors.border,
  },
});
