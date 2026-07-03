import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { color, radius, touch } from '@/theme';
import { ChevronDown } from './Icons';

export interface SelectOption<T> {
  value: T;
  label: string;
  /** 오른쪽에 붙는 보조 표시(예: PB 25.45) */
  hint?: ReactNode;
}

/**
 * PWA의 full-width <select> 드롭다운을 네이티브로 재현.
 * 탭하면 하단 시트에서 옵션을 고른다. Timer 설정·Assign·Records 이벤트 선택 공용.
 */
export default function Select<T extends string | number>({
  value, options, onChange, renderValue, title,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  /** 닫힌 상태 표시(기본: 선택된 옵션 label) */
  renderValue?: (opt: SelectOption<T> | undefined) => ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <View style={styles.valueWrap}>
          {renderValue ? renderValue(current) : <Text style={styles.value}>{current?.label ?? '—'}</Text>}
        </View>
        <ChevronDown color={color.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.back} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={String(o.value)}
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => { onChange(o.value); setOpen(false); }}>
                    <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{o.label}</Text>
                    {o.hint}
                    {on && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: touch.min, paddingHorizontal: 16,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line, borderRadius: 14,
  },
  valueWrap: { flex: 1 },
  value: { color: color.text, fontSize: 18, fontWeight: '600' },
  back: { flex: 1, backgroundColor: 'rgba(2,10,18,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: color.line, padding: 16, paddingBottom: 28, gap: 4,
  },
  sheetTitle: { color: color.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 52, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.line,
  },
  rowOn: { borderColor: color.accent },
  rowLabel: { color: color.text, fontSize: 16, fontWeight: '600', flex: 1 },
  rowLabelOn: { color: color.text },
  check: { color: color.accent, fontWeight: '900', fontSize: 16 },
});
