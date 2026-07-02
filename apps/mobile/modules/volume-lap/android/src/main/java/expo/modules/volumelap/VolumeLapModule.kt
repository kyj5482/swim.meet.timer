package expo.modules.volumelap

import android.os.SystemClock
import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * MainActivity.onKeyDown(config plugin이 주입)에서 호출되는 정적 핸들러.
 * enabled일 때 볼륨 키를 소비(시스템 볼륨 UI 억제)하고, KeyEvent.getEventTime()
 * (uptimeMillis, 모노토닉 — RN 터치 timestamp와 동일 베이스)을 JS로 전달한다.
 * 커널 캡처 시각이므로 JS 스레드 지연과 무관하게 1/100초 정확도를 지킨다.
 */
object VolumeLapKeyHandler {
  @Volatile var enabled: Boolean = false
  @Volatile internal var emitter: ((Long, Int) -> Unit)? = null

  fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (!enabled) return false
    if (keyCode != KeyEvent.KEYCODE_VOLUME_DOWN && keyCode != KeyEvent.KEYCODE_VOLUME_UP) return false
    // 길게 눌러 자동 반복되는 이벤트는 소비만 하고 랩은 1회
    if (event != null && event.repeatCount > 0) return true
    emitter?.invoke(event?.eventTime ?: SystemClock.uptimeMillis(), keyCode)
    return true
  }
}

class VolumeLapModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VolumeLap")
    Events("onVolumeLap")

    OnCreate {
      VolumeLapKeyHandler.emitter = { eventTime, keyCode ->
        sendEvent("onVolumeLap", mapOf("eventTimeMs" to eventTime, "keyCode" to keyCode))
      }
    }
    OnDestroy {
      VolumeLapKeyHandler.emitter = null
      VolumeLapKeyHandler.enabled = false
    }

    Function("setEnabled") { enabled: Boolean ->
      VolumeLapKeyHandler.enabled = enabled
    }
  }
}
