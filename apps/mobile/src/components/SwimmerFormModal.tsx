import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ageOf, type Swimmer } from '@/db';
import type { SwimmerFields } from '@/db/swimmers';
import { useT } from '@/store/settings';
import { color, radius } from '@/theme';

/**
 * 선수 추가/편집 폼 — 선수 관리와 타이머 배정 화면이 **같은 화면**을 쓴다.
 * 키보드가 입력칸을 가리지 않도록 KeyboardAvoidingView + 스크롤로 감싼다.
 */
export default function SwimmerFormModal({ visible, swimmer, onClose, onSave, onDelete }: {
  visible: boolean;
  /** null이면 신규 추가. */
  swimmer: Swimmer | null;
  onClose: () => void;
  onSave: (fields: SwimmerFields) => void;
  /** 편집일 때만 표시(선수 관리에서 사용). */
  onDelete?: (s: Swimmer) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [group, setGroup] = useState('');
  const [gender, setGender] = useState<'F' | 'M' | null>(null);
  const [usaId, setUsaId] = useState('');

  // 열릴 때마다 대상 선수 값으로 초기화
  useEffect(() => {
    if (!visible) return;
    setName(swimmer?.name ?? '');
    const a = swimmer ? ageOf(swimmer) : null;
    setAge(a != null ? String(a) : '');
    setGroup(swimmer?.group ?? '');
    setGender(swimmer?.gender ?? null);
    setUsaId(swimmer?.usaId ?? '');
  }, [visible, swimmer]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ageN = parseInt(age, 10);
    const birthYear = Number.isFinite(ageN) && ageN > 0 ? new Date().getFullYear() - ageN : undefined;
    onSave({
      name: trimmed,
      group: group.trim() || undefined,
      birthYear,
      gender: gender ?? undefined,
      usaId: usaId.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.back} onPress={onClose}>
          <ScrollView
            contentContainerStyle={styles.scrollWrap}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Pressable style={styles.card} onPress={() => {}}>
              <Text style={styles.title}>{swimmer ? t.editSw : t.addSw}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{t.lName}</Text>
                <TextInput
                  style={styles.input} value={name} onChangeText={setName}
                  placeholder={t.namePH} placeholderTextColor={color.textMuted} autoFocus={!swimmer}
                />
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>{t.lAge}</Text>
                  <TextInput
                    style={styles.input} value={age} onChangeText={setAge}
                    placeholder="12" placeholderTextColor={color.textMuted} keyboardType="number-pad" maxLength={2}
                  />
                </View>
                <View style={[styles.field, { flex: 2 }]}>
                  <Text style={styles.label}>{t.lGroup}</Text>
                  <TextInput
                    style={styles.input} value={group} onChangeText={setGroup}
                    placeholder={t.groupPH} placeholderTextColor={color.textMuted}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t.lGender}</Text>
                <View style={styles.genderRow}>
                  {([['F', t.female], ['M', t.male]] as const).map(([g, lbl]) => (
                    <Pressable
                      key={g}
                      style={[styles.genderBtn, gender === g && styles.genderOn]}
                      onPress={() => setGender(gender === g ? null : g)}>
                      <Text style={[styles.genderText, gender === g && styles.genderTextOn]}>{lbl}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t.lUsaId}</Text>
                <TextInput
                  style={styles.input} value={usaId} onChangeText={setUsaId}
                  placeholder={t.usaIdPH} placeholderTextColor={color.textMuted}
                  keyboardType="number-pad" autoCorrect={false}
                />
                <Text style={styles.hint}>{t.usaIdHint}</Text>
              </View>

              <Pressable style={[styles.saveBtn, !name.trim() && styles.disabled]} disabled={!name.trim()} onPress={submit}>
                <Text style={styles.saveText}>{swimmer ? t.save : t.add}</Text>
              </Pressable>
              {swimmer && onDelete && (
                <Pressable style={styles.delBtn} onPress={() => onDelete(swimmer)}>
                  <Text style={styles.delText}>{t.deleteSw}</Text>
                </Pressable>
              )}
            </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(4,12,20,0.72)' },
  scrollWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 18, gap: 12,
  },
  title: { color: color.text, fontSize: 18, fontWeight: '800' },
  field: { gap: 6 },
  label: { color: color.textMuted, fontSize: 13 },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: color.surface2, color: color.text, fontSize: 16,
    borderWidth: 1, borderColor: color.line,
  },
  hint: { color: color.textMuted, fontSize: 11, lineHeight: 15 },
  rowFields: { flexDirection: 'row', gap: 10 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  genderOn: { backgroundColor: color.accent, borderColor: color.accent },
  genderText: { color: color.text, fontSize: 15, fontWeight: '600' },
  genderTextOn: { color: color.accentInk, fontWeight: '800' },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveText: { color: color.accentInk, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  delBtn: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.stop,
    alignItems: 'center', justifyContent: 'center',
  },
  delText: { color: color.stop, fontSize: 15, fontWeight: '700' },
});
