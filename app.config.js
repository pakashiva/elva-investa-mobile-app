module.exports = {
  expo: {
    name: 'ELVA CAPITA',
    slug: 'elva-investa-mobile',
    owner: 'pakashiva',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/elva-app-icon.png',
    userInterfaceStyle: 'light',

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pakashiva.elvainvesta',
    },

    android: {
      package: 'com.pakashiva.elvainvesta',
      versionCode: 2,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/elva-app-icon.png',
        backgroundColor: '#FFFFFF',
      },
    },

    plugins: [
      '@react-native-community/datetimepicker',
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#000000',
        },
      ],
    ],

    web: {
      favicon: './assets/favicon.png',
    },

    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL,

      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL,

      supabasePublishableKey:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,

      otpApiBaseUrl:
        process.env.EXPO_PUBLIC_OTP_API_BASE_URL ??
        'https://api.notify.elvatech.in',

      otpAppId: process.env.EXPO_PUBLIC_OTP_APP_ID ?? 'eNandi',

      otpApiKey: process.env.EXPO_PUBLIC_OTP_API_KEY,

      otpBrandId: process.env.EXPO_PUBLIC_OTP_BRAND_ID ?? 'elva-sales',

      eas: {
        projectId: '854f28af-cff6-49ba-a26a-e93e669280ba',
      },
    },
  },
};
