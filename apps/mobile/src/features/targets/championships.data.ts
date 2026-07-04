/**
 * 챔피언십 미트 컷타임 — 모티베이셔널(B~AAAA) **위** 단계의 사다리.
 * Western Zones → Far Western → CA/NV Sectionals → NCSA Senior → Futures →
 * TYR Pro Series → Winter Juniors → Junior Nationals → Toyota Nationals →
 * NCAA D1 A 순(느림→빠름)으로 타겟 사다리에 이어 붙는다.
 *
 * ⚠️ 시드 데이터 주의: 아래 값은 공개된 각 대회 타임 스탠더드를 근거로 한
 * 시드값이며, 이 저장소 빌드 환경에서는 원문 PDF 검증을 하지 못했다.
 * 실사용 전 각 대회의 최신 공식 Time Standards와 대조·갱신할 것
 * (tools/standards-import에 champs 소스 추가 예정). 값이 없는 조합은
 * UI에서 자동으로 숨겨진다. 현재 SCY만 수록(SCM/LCM은 임포터로 채운다).
 *
 * CHAMPS[course][gender][eventCode][levelCode] = 컷타임(ms)
 */

/** 챔피언십 레벨 코드(느림→빠름). */
export const CHAMP_LEVELS = ['WZ', 'FW', 'SECT', 'NCSA', 'FUT', 'TYR', 'WJR', 'JNAT', 'NAT', 'D1A'] as const;
export type ChampLevel = (typeof CHAMP_LEVELS)[number];

export const CHAMP_LABEL: Record<ChampLevel, string> = {
  WZ: 'Western Zones',
  FW: 'Far Western',
  SECT: 'CA/NV Sect',
  NCSA: 'NCSA Senior',
  FUT: 'Futures',
  TYR: 'TYR Pro Series',
  WJR: 'Winter Juniors',
  JNAT: 'Junior Natl',
  NAT: 'Toyota Nationals',
  D1A: 'NCAA D1 A',
};

/** '1:45.99' | '21.66' → ms. 데이터를 공식 표기 그대로 유지해 대조를 쉽게 한다. */
function T(s: string): number {
  const m = s.match(/^(?:(\d+):)?(\d{1,2})\.(\d{2})$/);
  if (!m) throw new Error(`championships.data: bad time "${s}"`);
  const [, min, sec, hh] = m;
  return (min ? parseInt(min, 10) * 60_000 : 0) + parseInt(sec!, 10) * 1000 + parseInt(hh!, 10) * 10;
}

type EventCuts = Partial<Record<ChampLevel, number>>;

function cuts(v: Partial<Record<ChampLevel, string>>): EventCuts {
  const out: EventCuts = {};
  for (const [k, s] of Object.entries(v)) out[k as ChampLevel] = T(s!);
  return out;
}

export const CHAMPS: Record<string, Record<'F' | 'M', Record<string, EventCuts>>> = {
  SCY: {
    M: {
      '50FR': cuts({ WZ: '22.09', FW: '21.79', SECT: '21.19', NCSA: '20.89', FUT: '20.69', TYR: '20.49', WJR: '20.19', JNAT: '19.99', NAT: '19.79', D1A: '18.89' }),
      '100FR': cuts({ WZ: '48.29', FW: '47.69', SECT: '46.49', NCSA: '45.99', FUT: '45.49', TYR: '44.99', WJR: '44.39', JNAT: '43.79', NAT: '43.29', D1A: '41.31' }),
      '200FR': cuts({ WZ: '1:45.99', FW: '1:44.79', SECT: '1:41.99', NCSA: '1:40.99', FUT: '1:39.99', TYR: '1:38.49', WJR: '1:37.29', JNAT: '1:35.99', NAT: '1:34.99', D1A: '1:31.51' }),
      '500FR': cuts({ WZ: '4:48.99', FW: '4:45.99', SECT: '4:38.99', NCSA: '4:34.99', FUT: '4:31.99', TYR: '4:28.99', WJR: '4:25.99', JNAT: '4:21.99', NAT: '4:19.99', D1A: '4:11.62' }),
      '100BK': cuts({ WZ: '53.99', FW: '53.29', SECT: '51.99', NCSA: '51.29', FUT: '50.69', TYR: '49.99', WJR: '49.19', JNAT: '48.49', NAT: '47.99', D1A: '44.94' }),
      '200BK': cuts({ WZ: '1:58.99', FW: '1:57.49', SECT: '1:53.99', NCSA: '1:52.49', FUT: '1:50.99', TYR: '1:49.49', WJR: '1:47.99', JNAT: '1:45.99', NAT: '1:44.99', D1A: '1:39.13' }),
      '100BR': cuts({ WZ: '1:00.99', FW: '1:00.29', SECT: '58.79', NCSA: '57.99', FUT: '57.29', TYR: '56.49', WJR: '55.69', JNAT: '54.99', NAT: '54.49', D1A: '51.29' }),
      '200BR': cuts({ WZ: '2:12.99', FW: '2:11.29', SECT: '2:07.99', NCSA: '2:05.99', FUT: '2:04.49', TYR: '2:02.99', WJR: '2:01.29', JNAT: '1:59.49', NAT: '1:58.49', D1A: '1:51.54' }),
      '100FL': cuts({ WZ: '52.99', FW: '52.29', SECT: '50.99', NCSA: '50.29', FUT: '49.69', TYR: '48.99', WJR: '48.29', JNAT: '47.59', NAT: '46.99', D1A: '44.71' }),
      '200FL': cuts({ WZ: '1:58.49', FW: '1:56.99', SECT: '1:53.49', NCSA: '1:51.99', FUT: '1:50.49', TYR: '1:48.99', WJR: '1:47.49', JNAT: '1:45.49', NAT: '1:44.49', D1A: '1:40.20' }),
      '200IM': cuts({ WZ: '2:00.49', FW: '1:58.99', SECT: '1:55.49', NCSA: '1:53.99', FUT: '1:52.49', TYR: '1:50.99', WJR: '1:49.49', JNAT: '1:47.49', NAT: '1:46.49', D1A: '1:41.32' }),
      '400IM': cuts({ WZ: '4:17.99', FW: '4:14.99', SECT: '4:08.99', NCSA: '4:05.99', FUT: '4:02.99', TYR: '3:59.99', WJR: '3:56.99', JNAT: '3:52.99', NAT: '3:50.99', D1A: '3:39.16' }),
    },
    F: {
      '50FR': cuts({ WZ: '24.79', FW: '24.49', SECT: '23.89', NCSA: '23.59', FUT: '23.39', TYR: '23.09', WJR: '22.89', JNAT: '22.59', NAT: '22.39', D1A: '21.66' }),
      '100FR': cuts({ WZ: '53.99', FW: '53.29', SECT: '51.99', NCSA: '51.29', FUT: '50.79', TYR: '50.19', WJR: '49.59', JNAT: '48.99', NAT: '48.49', D1A: '47.18' }),
      '200FR': cuts({ WZ: '1:56.99', FW: '1:55.49', SECT: '1:52.49', NCSA: '1:50.99', FUT: '1:49.99', TYR: '1:48.49', WJR: '1:47.29', JNAT: '1:45.99', NAT: '1:44.99', D1A: '1:42.98' }),
      '500FR': cuts({ WZ: '5:11.99', FW: '5:08.99', SECT: '5:01.99', NCSA: '4:58.99', FUT: '4:55.99', TYR: '4:52.99', WJR: '4:49.99', JNAT: '4:45.99', NAT: '4:43.99', D1A: '4:35.76' }),
      '100BK': cuts({ WZ: '59.29', FW: '58.59', SECT: '57.19', NCSA: '56.49', FUT: '55.89', TYR: '55.19', WJR: '54.49', JNAT: '53.79', NAT: '53.29', D1A: '50.94' }),
      '200BK': cuts({ WZ: '2:08.99', FW: '2:07.49', SECT: '2:03.99', NCSA: '2:02.49', FUT: '2:00.99', TYR: '1:59.49', WJR: '1:57.99', JNAT: '1:55.99', NAT: '1:54.99', D1A: '1:50.50' }),
      '100BR': cuts({ WZ: '1:08.49', FW: '1:07.69', SECT: '1:05.99', NCSA: '1:05.19', FUT: '1:04.49', TYR: '1:03.69', WJR: '1:02.99', JNAT: '1:02.29', NAT: '1:01.79', D1A: '59.23' }),
      '200BR': cuts({ WZ: '2:27.99', FW: '2:26.29', SECT: '2:22.49', NCSA: '2:20.49', FUT: '2:18.99', TYR: '2:16.99', WJR: '2:15.29', JNAT: '2:13.49', NAT: '2:12.49', D1A: '2:07.88' }),
      '100FL': cuts({ WZ: '58.99', FW: '58.29', SECT: '56.89', NCSA: '56.19', FUT: '55.59', TYR: '54.89', WJR: '54.19', JNAT: '53.49', NAT: '52.99', D1A: '51.10' }),
      '200FL': cuts({ WZ: '2:11.49', FW: '2:09.99', SECT: '2:06.49', NCSA: '2:04.99', FUT: '2:03.49', TYR: '2:01.99', WJR: '2:00.49', JNAT: '1:58.49', NAT: '1:57.49', D1A: '1:53.36' }),
      '200IM': cuts({ WZ: '2:12.49', FW: '2:10.99', SECT: '2:07.49', NCSA: '2:05.99', FUT: '2:04.49', TYR: '2:02.99', WJR: '2:01.49', JNAT: '1:59.49', NAT: '1:58.49', D1A: '1:54.71' }),
      '400IM': cuts({ WZ: '4:41.99', FW: '4:38.99', SECT: '4:32.99', NCSA: '4:29.99', FUT: '4:26.99', TYR: '4:23.99', WJR: '4:20.99', JNAT: '4:16.99', NAT: '4:14.99', D1A: '4:03.62' }),
    },
  },
};
