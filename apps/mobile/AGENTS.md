# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

**SDK 고정 사유**: 팀원 iPhone에 설치된 Expo Go 앱이 SDK 54까지만 지원해
54.0.35로 고정했다(57→56 시도 모두 "incompatible" — Expo Go 앱 자체 업데이트
지연 때문). Expo Go로 QR 스캔 테스트가 필요한 동안은, `expo`를 올리기 전에
반드시 실제 사용할 Expo Go 앱이 지원하는 SDK를 먼저 확인할 것. 버전은
`node_modules/expo/bundledNativeModules.json`에서 정확한 호환 조합을 읽어
맞춘다(추측 금지 — expo-* 패키지는 SDK 번호와 다른 독립 버전 체계를 쓴다).
