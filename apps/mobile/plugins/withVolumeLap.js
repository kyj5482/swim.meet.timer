// MainActivity에 볼륨 키 onKeyDown 훅 주입 (expo prebuild 시 적용).
// 변환 로직은 순수 함수로 분리해 테스트한다 (plugins/transformMainActivity.js).
const { withMainActivity } = require('expo/config-plugins');
const { transformMainActivity } = require('./transformMainActivity');

module.exports = function withVolumeLap(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withVolumeLap: Kotlin MainActivity가 필요합니다');
    }
    config.modResults.contents = transformMainActivity(config.modResults.contents);
    return config;
  });
};
