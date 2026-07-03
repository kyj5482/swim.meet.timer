import { StyleSheet, Text, View } from 'react-native';

import { initials, laneColor } from '@/theme';

/** 레인 팔레트 색 원형 아바타 + 이니셜(흰 글자, 그림자). PWA .avatar 이식. */
export default function Avatar({ name, index = 0, size = 44, color }: {
  name: string;
  index?: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? laneColor(index) }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '800', textShadowColor: 'rgba(4,12,20,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
