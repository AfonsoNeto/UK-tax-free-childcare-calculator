import { MONTH_NAMES } from './config.js';

export class DateUtil {
  static getQuarterInfo(year, month) {
    const monthIndex = month - 1; // 0-indexed
    const quarter = Math.floor(monthIndex / 3);
    const startMonth = quarter * 3;
    
    return {
      quarter,
      months: [startMonth, startMonth + 1, startMonth + 2],
      periodName: `${MONTH_NAMES[startMonth]} - ${MONTH_NAMES[startMonth + 2]}`
    };
  }

  static getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }
}
