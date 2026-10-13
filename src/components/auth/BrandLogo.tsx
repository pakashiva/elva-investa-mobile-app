import React from 'react';
import { View, StyleSheet, Image, ImageStyle, StyleProp } from 'react-native';
import { BRAND_LOGO, BRAND_NAME } from '../../constants/brandAssets';

type Props = {
  size?: number;
  imageStyle?: StyleProp<ImageStyle>;
};

export default function BrandLogo({ size = 96, imageStyle }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={BRAND_LOGO}
        style={[
          styles.logo,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.12),
          },
          imageStyle,
        ]}
        resizeMode="contain"
        accessibilityLabel={`${BRAND_NAME} logo`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    backgroundColor: '#000000',
  },
});
