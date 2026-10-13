import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const NOTIFICATION_TOAST_DURATION_MS = 5000;

export type NotificationToastPayload = {
  id: string;
  title: string;
  body: string;
  decision: 'approved' | 'rejected' | 'recorded' | 'due' | 'overdue';
  kind: 'investment' | 'withdrawal' | 'agreement_renewal' | 'loan';
};

type Props = {
  toast: NotificationToastPayload | null;
  onDismiss: () => void;
  onPress?: () => void;
};

export default function NotificationToastBanner({
  toast,
  onDismiss,
  onPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!toast) {
      return;
    }

    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onDismiss();
        }
      });
    }, NOTIFICATION_TOAST_DURATION_MS);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [toast?.id, onDismiss, translateY, opacity]);

  if (!toast) {
    return null;
  }

  const approved = toast.decision !== 'rejected';

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              paddingTop: Math.max(
                insets.top,
                Platform.OS === 'android' ? 12 : 8
              ),
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              onPress?.();
              onDismiss();
            }}
            style={styles.card}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: approved ? colors.successBg : '#FDECEC',
                },
              ]}
            >
              <Ionicons
                name={
                  toast.kind === 'withdrawal'
                    ? approved
                      ? 'arrow-up-circle'
                      : 'close-circle'
                    : toast.kind === 'agreement_renewal'
                      ? approved
                        ? 'refresh-circle'
                        : 'close-circle'
                      : approved
                        ? 'checkmark-circle'
                        : 'close-circle'
                }
                size={22}
                color={approved ? colors.success : colors.danger}
              />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {toast.title}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {toast.body}
              </Text>
            </View>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onDismiss}
              accessibilityLabel="Dismiss notification"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  wrap: {
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
