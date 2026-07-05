import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getGameLeaderboard, submitGameScore } from '@/api/game';
import { newId } from '@/db/ids';
import { GAME_HTML } from '@/features/game/gameHtml';
import { useSettings } from '@/store/settings';
import { color } from '@/theme';

interface GameResultMsg {
  type: 'result' | 'exit';
  outcome?: 'finish' | 'gameover';
  timeMs?: number;
  coins?: number;
  stroke?: string;
  distance?: number;
  courseUnit?: string;
  character?: string | null;
}

/**
 * 이스터 에그 게임 웹뷰 (docs/09-sharks-game.md §6).
 * 타이머의 영법·거리·코스 단위를 GAME_CONFIG로 주입하고, 완주 결과는 로그인
 * 시 /game/scores 제출 후 리더보드(등수·배지)를 웹뷰로 재주입한다.
 */
export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stroke?: string; distance?: string; courseUnit?: string }>();
  const { apiBaseUrl, authToken, authEmail } = useSettings();
  const webRef = useRef<WebView>(null);

  const stroke = typeof params.stroke === 'string' ? params.stroke : 'free';
  const distance = Number(params.distance) || 50;
  const courseUnit = params.courseUnit === 'm' ? 'm' : 'y';

  const injected = useMemo(
    () =>
      `window.GAME_CONFIG=${JSON.stringify({ stroke, distance, courseUnit })};true;`,
    [stroke, distance, courseUnit],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: GameResultMsg;
      try {
        msg = JSON.parse(e.nativeEvent.data) as GameResultMsg;
      } catch {
        return;
      }
      if (msg.type === 'exit') {
        router.back();
        return;
      }
      if (msg.type !== 'result' || msg.outcome !== 'finish' || !msg.timeMs) return;
      if (!apiBaseUrl || !authToken) return; // 비로그인 — 로컬 결과만 (그레이스풀)
      const cfg = { baseUrl: apiBaseUrl, token: authToken, devUser: authEmail ?? undefined };
      void (async () => {
        try {
          await submitGameScore(cfg, {
            scoreId: newId(),
            stroke,
            distance,
            courseUnit,
            timeMs: Math.round(msg.timeMs!),
            character: msg.character ?? null,
          });
          const board = await getGameLeaderboard(cfg, { stroke, distance, courseUnit });
          webRef.current?.injectJavaScript(
            `window.postResult(${JSON.stringify(JSON.stringify(board))});true;`,
          );
        } catch {
          // 서버 미설정/실패 — 게임 결과 화면은 로컬 데이터로 그대로 유지
        }
      })();
    },
    [apiBaseUrl, authToken, authEmail, stroke, distance, courseUnit, router],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <WebView
        ref={webRef}
        source={{ html: GAME_HTML }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={onMessage}
        // 게임은 완전 인라인(외부 리소스 0) — 네비게이션 이탈 차단
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('data:')}
        javaScriptEnabled
        domStorageEnabled={false}
        allowsInlineMediaPlayback
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  web: { flex: 1, backgroundColor: '#052a42' },
});
