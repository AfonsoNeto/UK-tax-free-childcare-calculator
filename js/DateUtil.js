import { MONTH_NAMES } from './config.js';

export class DateUtil {
  // The 3-month top-up periods are anchored to the month the childcare
  // account was opened (January by default, which matches calendar
  // quarters). Returns the period containing the given month as a
  // chronological list of {year, month} entries (may wrap a year
  // boundary) plus a display name.
  static getPeriodInfo(year, month, anchorMonth = 1) {
    const offset = (((month - anchorMonth) % 3) + 3) % 3;

    let startYear = year;
    let startMonth = month - offset;
    if (startMonth < 1) {
      startYear -= 1;
      startMonth += 12;
    }

    const months = [];
    for (let i = 0; i < 3; i++) {
      const m = startMonth + i;
      months.push(m <= 12 ? { year: startYear, month: m } : { year: startYear + 1, month: m - 12 });
    }

    return {
      months,
      periodName: `${MONTH_NAMES[months[0].month - 1]} - ${MONTH_NAMES[months[2].month - 1]} ${months[2].year}`
    };
  }

  static getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }
}
