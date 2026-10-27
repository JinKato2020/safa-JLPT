// 秋の学習後イラスト。昼夜それぞれ5枚を学習回数で順送りする。
import { daylightAt, type Daylight } from './daylight';

export const AFTER_STUDY_BY_DAYLIGHT = {
  day: [
    require('../../assets/afterstudy/autumn_day_01.jpg'),
    require('../../assets/afterstudy/autumn_day_02.jpg'),
    require('../../assets/afterstudy/autumn_day_03.jpg'),
    require('../../assets/afterstudy/autumn_day_04.jpg'),
    require('../../assets/afterstudy/autumn_day_05.jpg'),
  ],
  night: [
    require('../../assets/afterstudy/autumn_night_01.jpg'),
    require('../../assets/afterstudy/autumn_night_02.jpg'),
    require('../../assets/afterstudy/autumn_night_03.jpg'),
    require('../../assets/afterstudy/autumn_night_04.jpg'),
    require('../../assets/afterstudy/autumn_night_05.jpg'),
  ],
};
export const AFTER_STUDY_IMAGES = [...AFTER_STUDY_BY_DAYLIGHT.day, ...AFTER_STUDY_BY_DAYLIGHT.night];

/** 同じ学習の中では同じ絵。開発用の昼夜指定も各タブと共通。 */
export function pickAfterStudyImage(seed: number, now = Date.now(), daylight?: Daylight) {
  const images = AFTER_STUDY_BY_DAYLIGHT[daylight ?? daylightAt(new Date(now))];
  const index = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  return images[index % images.length];
}
