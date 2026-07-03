import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius } from '@/theme';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** 재사용 액션 시트 (⋮ 메뉴). 하단에서 올라오는 옵션 목록. */
export default function ActionMenu({ visible, onClose, actions }: {
  visible: boolean;
  onClose: () => void;
  actions: MenuAction[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <View style={styles.sheet}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              style={[styles.row, i > 0 && styles.rowDivider]}
              onPress={() => { onClose(); a.onPress(); }}>
              <Text style={[styles.label, a.destructive && styles.destructive]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(2,10,18,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: color.line, paddingBottom: 28, paddingTop: 6,
  },
  row: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 22 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  label: { color: color.text, fontSize: 17, fontWeight: '600' },
  destructive: { color: color.stop },
});
