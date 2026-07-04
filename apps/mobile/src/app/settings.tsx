import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { checkHealth, login } from '@/api/client';
import { syncAll } from '@/api/sync';
import { clearSeed, hasSeedData } from '@/db';
import { courseName } from '@/features/timer/config';
import { setSettings, useSettings, useT } from '@/store/settings';
import { webBaseUrl } from '@/features/records/officialTimes';
import { color, radius } from '@/theme';

const COURSES = ['25y', '25m', '50m'] as const;
type ConnState = 'idle' | 'checking' | 'ok' | 'fail';

/** 설정 모달: 코스 · 햅틱 · 백엔드 동기화 · 데모 데이터. */
export default function SettingsScreen() {
  const s = useSettings();
  const t = useT();
  const [seedLeft, setSeedLeft] = useState(false);
  const [urlInput, setUrlInput] = useState(s.apiBaseUrl);
  const [conn, setConn] = useState<ConnState>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInMsg, setSignInMsg] = useState<string | null>(null);

  useEffect(() => { void hasSeedData().then(setSeedLeft); }, []);
  useEffect(() => { setUrlInput(s.apiBaseUrl); }, [s.apiBaseUrl]);

  function saveUrl() {
    const trimmed = urlInput.trim().replace(/\/$/, '');
    setSettings({ apiBaseUrl: trimmed });
    setConn('idle');
  }

  async function onTestConnection() {
    saveUrl();
    const url = urlInput.trim().replace(/\/$/, '');
    if (!url) return;
    setConn('checking');
    const ok = await checkHealth(url);
    setConn(ok ? 'ok' : 'fail');
  }

  async function onSyncNow() {
    saveUrl();
    const url = urlInput.trim().replace(/\/$/, '');
    if (!url) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncAll({ baseUrl: url, token: s.authToken }, s.lastSyncAt);
      setSettings({ lastSyncAt: Date.now() });
      setSyncMsg({ text: t.syncOk(res.swimmers, res.pushed, res.pulled), ok: true });
    } catch (e) {
      setSyncMsg({ text: t.syncFail(e instanceof Error ? e.message : String(e)), ok: false });
    } finally {
      setSyncing(false);
    }
  }

  async function onSignIn() {
    saveUrl();
    const url = urlInput.trim().replace(/\/$/, '');
    if (!url || !email.trim() || !password) return;
    setSigningIn(true);
    setSignInMsg(null);
    try {
      const res = await login({ baseUrl: url }, email.trim(), password);
      setSettings({ authToken: res.token, authEmail: email.trim() });
      setPassword('');
    } catch (e) {
      setSignInMsg(t.signInFail(e instanceof Error ? e.message : String(e)));
    } finally {
      setSigningIn(false);
    }
  }

  function onSignOut() {
    setSettings({ authToken: null, authEmail: null });
  }

  function onClearDemo() {
    Alert.alert(t.clearDemo, t.clearDemoConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delYes, style: 'destructive', onPress: () => void clearSeed().then(() => setSeedLeft(false)) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* 코스 단위 (다니는 풀) */}
      <Text style={styles.label}>{t.courseUnit}</Text>
      <View style={styles.segRow}>
        {COURSES.map((c) => (
          <Pressable
            key={c}
            style={[styles.segBtn, s.course === c && styles.segOn]}
            onPress={() => setSettings({ course: c })}>
            <Text style={[styles.segText, s.course === c && styles.segTextOn]}>{courseName(c)}</Text>
          </Pressable>
        ))}
      </View>

      {/* 햅틱 */}
      <View style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t.haptics}</Text>
          <Text style={styles.rowSub}>{t.hapticsSub}</Text>
        </View>
        <Switch
          value={s.haptics}
          onValueChange={(v) => setSettings({ haptics: v })}
          trackColor={{ true: color.accent, false: color.line }}
          thumbColor="#fff"
        />
      </View>

      {/* AI 코치 계정 — 웹 서비스(SplitLane Cloud) 공유·코치 리뷰의 관문.
          로그인 없이도 타이머·기록은 전부 동작한다(확장 기능 전용). */}
      <Text style={styles.label}>{t.aiCoach}</Text>
      {s.authToken ? (
        <View style={styles.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t.signedInAs(s.authEmail ?? '')}</Text>
            <Pressable hitSlop={6} onPress={() => void Linking.openURL(webBaseUrl(s.apiBaseUrl))}>
              <Text style={styles.link}>{t.openWebConsole}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.backendBtn} onPress={onSignOut}>
            <Text style={styles.backendBtnText}>{t.signOut}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.fieldInput}
            value={email}
            onChangeText={setEmail}
            placeholder={t.emailPH}
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.fieldInput}
            value={password}
            onChangeText={setPassword}
            placeholder={t.passwordPH}
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            secureTextEntry
          />
          <Pressable
            style={[styles.backendBtn, styles.backendBtnPrimary, (signingIn || !email.trim() || !password) && styles.disabled]}
            onPress={() => void onSignIn()}
            disabled={signingIn || !email.trim() || !password}>
            {signingIn ? <ActivityIndicator color={color.accentInk} size="small" /> : (
              <Text style={styles.backendBtnPrimaryText}>{t.signIn}</Text>
            )}
          </Pressable>
          {signInMsg && <Text style={styles.connFail}>{signInMsg}</Text>}
          <Text style={styles.rowSub}>{t.aiCoachHint}</Text>
          {/* 계정 생성은 웹 서비스에서 — 앱은 로그인만 담당 */}
          <Pressable hitSlop={6} onPress={() => void Linking.openURL(`${webBaseUrl(s.apiBaseUrl)}/signup`)}>
            <Text style={styles.link}>{t.createAccount}</Text>
          </Pressable>
        </>
      )}

      {/* 백엔드 동기화 — AI 코치 계정 설정 안쪽, 개발 빌드에서만 노출.
          프로덕션 앱은 로그인 계정으로 자동 동기화되므로 URL 입력이 필요 없다. */}
      {__DEV__ && (
        <View style={styles.devBox}>
          <Text style={styles.rowTitle}>{t.devBackend}</Text>
          <Text style={styles.rowSub}>{t.devBackendHint}</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              onEndEditing={saveUrl}
              placeholder={t.serverUrlPH}
              placeholderTextColor={color.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <View style={styles.backendActions}>
            <Pressable style={styles.backendBtn} onPress={() => void onTestConnection()} disabled={conn === 'checking'}>
              {conn === 'checking' ? <ActivityIndicator color={color.text} size="small" /> : (
                <Text style={styles.backendBtnText}>{t.testConnection}</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.backendBtn, styles.backendBtnPrimary, syncing && styles.disabled]}
              onPress={() => void onSyncNow()}
              disabled={syncing}>
              {syncing ? <ActivityIndicator color={color.accentInk} size="small" /> : (
                <Text style={styles.backendBtnPrimaryText}>{t.syncNow}</Text>
              )}
            </Pressable>
          </View>
          {conn === 'ok' && <Text style={styles.connOk}>{t.connOk}</Text>}
          {conn === 'fail' && <Text style={styles.connFail}>{t.connFail}</Text>}
          {syncMsg && <Text style={syncMsg.ok ? styles.connOk : styles.connFail}>{syncMsg.text}</Text>}
          <Text style={styles.rowSub}>
            {s.lastSyncAt > 0 ? t.lastSynced(new Date(s.lastSyncAt).toLocaleTimeString()) : t.neverSynced}
          </Text>
        </View>
      )}

      {/* 데모 데이터 지우기 (시드가 남아 있을 때만) */}
      {seedLeft && (
        <Pressable style={styles.clearBtn} onPress={onClearDemo}>
          <Text style={styles.clearText}>{t.clearDemo}</Text>
          <Text style={styles.clearSub}>{t.clearDemoSub}</Text>
        </Pressable>
      )}

      <Text style={styles.tip}>{t.settingsTip}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: 16, gap: 14 },
  label: { color: color.textMuted, fontSize: 13 },
  segRow: { flexDirection: 'row', gap: 6 },
  segBtn: {
    flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center',
  },
  segOn: { backgroundColor: color.accent, borderColor: color.accent },
  segText: { color: color.text, fontSize: 15, fontWeight: '600' },
  segTextOn: { color: color.accentInk, fontWeight: '800' },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.line,
    borderRadius: radius.card, padding: 14,
  },
  rowTitle: { color: color.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: color.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  link: { color: color.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
  devBox: {
    borderWidth: 1, borderColor: color.line, borderRadius: radius.card,
    padding: 14, gap: 8, borderStyle: 'dashed',
  },
  clearBtn: {
    borderWidth: 1, borderColor: color.stop, borderRadius: radius.card,
    padding: 14, gap: 2, marginTop: 4,
  },
  clearText: { color: color.stop, fontSize: 15, fontWeight: '700' },
  clearSub: { color: color.textMuted, fontSize: 12 },
  tip: { color: color.textMuted, fontSize: 12 },
  urlRow: { flexDirection: 'row' },
  urlInput: {
    flex: 1, height: 46, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: color.surface2, color: color.text, fontSize: 14,
    borderWidth: 1, borderColor: color.line,
  },
  fieldInput: {
    height: 46, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: color.surface2, color: color.text, fontSize: 14,
    borderWidth: 1, borderColor: color.line,
  },
  backendActions: { flexDirection: 'row', gap: 8 },
  backendBtn: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center',
  },
  backendBtnText: { color: color.text, fontSize: 14, fontWeight: '600' },
  backendBtnPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  backendBtnPrimaryText: { color: color.accentInk, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  connOk: { color: color.ok, fontSize: 12, fontWeight: '600' },
  connFail: { color: color.stop, fontSize: 12, fontWeight: '600' },
});
