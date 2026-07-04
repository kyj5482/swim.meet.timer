import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/store/settings';
import { color, radius } from '@/theme';

/** OK가 자동 확정되기까지의 시간(ms) — 버튼이 채워지는 애니메이션과 동일. */
export const AUTO_OK_MS = 2000;

/**
 * 저장 직후 확인 오버레이. 배정 화면 위에 뜨며, 화면은 아직 전환되지 않는다:
 * - Undo → 방금 저장을 취소하고 배정 화면 그대로 복귀.
 * - OK → 타이머 초기 화면으로. 누르지 않아도 2초 동안 버튼이 채워지며 자동 OK.
 */
export default function SaveOverlay({ count, onUndo, onOk }: {
  count: number;
  onUndo: () => void;
  onOk: () => void;
}) {
  const t = useT();
  const fill = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  useEffect(() => {
    const anim = Animated.timing(fill, {
      toValue: 1, duration: AUTO_OK_MS, useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && !done.current) { done.current = true; onOk(); }
    });
    return () => anim.stop();
  }, [fill, onOk]);

  const confirm = () => {
    if (done.current) return;
    done.current = true;
    onOk();
  };
  const undo = () => {
    if (done.current) return;
    done.current = true;
    onUndo();
  };

  return (
    <View style={styles.back}>
      <View style={styles.card}>
        <Text style={styles.msg}>{`✓ ${t.savedToast(count)}`}</Text>
        <View style={styles.row}>
          <Pressable style={styles.undoBtn} onPress={undo}>
            <Text style={styles.undoText}>{t.undoBtn}</Text>
          </Pressable>
          <Pressable style={styles.okBtn} onPress={confirm}>
            {/* 2초 동안 왼쪽→오른쪽으로 채워지는 자동 확정 게이지 */}
            <Animated.View
              style={[styles.okFill, {
                width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]}
            />
            <Text style={styles.okText}>{t.okBtn}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,12,20,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 10,
  },
  card: {
    alignSelf: 'stretch', backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 18, gap: 16,
  },
  msg: { color: color.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  undoBtn: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1, borderColor: color.stop,
    alignItems: 'center', justifyContent: 'center',
  },
  undoText: { color: color.stop, fontSize: 16, fontWeight: '800' },
  okBtn: {
    flex: 1, height: 52, borderRadius: 14, backgroundColor: color.surface2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: color.accent,
  },
  okFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: color.accent,
  },
  okText: { color: color.text, fontSize: 16, fontWeight: '800' },
});
