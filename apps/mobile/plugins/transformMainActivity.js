const HOOK = `
  override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
    if (expo.modules.volumelap.VolumeLapKeyHandler.onKeyDown(keyCode, event)) return true
    return super.onKeyDown(keyCode, event)
  }
`;

/** MainActivity.kt 본문에 볼륨 키 훅을 1회만 삽입(멱등). */
function transformMainActivity(src) {
  if (src.includes('VolumeLapKeyHandler')) return src;
  const anchor = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
  if (!anchor.test(src)) {
    throw new Error('withVolumeLap: MainActivity 클래스 선언을 찾지 못했습니다');
  }
  return src.replace(anchor, (m) => `${m}\n${HOOK}`);
}

module.exports = { transformMainActivity, HOOK };
