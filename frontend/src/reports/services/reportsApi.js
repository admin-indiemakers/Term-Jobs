import { request } from '../../api/client';

export const reportsApi = {
  /**
   * List historical reports.
   */
  async getReports(params = {}) {
    const query = new URLSearchParams();
    if (params.report_type) query.set('report_type', params.report_type);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.skip) query.set('skip', String(params.skip));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/reports${qs}`, { noCache: true });
  },

  /**
   * Fetch a report for a specific date and type (daily, weekly, monthly).
   */
  async getReportByDate(date, reportType = 'daily') {
    const qs = `?date=${encodeURIComponent(date)}&report_type=${encodeURIComponent(reportType)}`;
    return request(`/api/reports/by-date${qs}`, { noCache: true });
  },

  /**
   * Fetch a single report by its ID.
   */
  async getReportById(reportId) {
    return request(`/api/reports/${reportId}`, { noCache: true });
  },

  /**
   * Save a report as draft or submitted. Duplicate prevention is enforced on the backend.
   */
  async saveReport(payload) {
    return request('/api/reports', {
      method: 'POST',
      body: payload,
    });
  },

  /**
   * Update an existing report with audit tracking.
   */
  async updateReport(reportId, payload) {
    return request(`/api/reports/${reportId}`, {
      method: 'PUT',
      body: payload,
    });
  },

  /**
   * Delete a report.
   */
  async deleteReport(reportId) {
    return request(`/api/reports/${reportId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Retrieve calculated growth analytics, KPIs, funnel, channel metrics, and AI insights.
   */
  async getGrowthAnalytics(period = '30d', startDate = null, endDate = null) {
    const query = new URLSearchParams({ period });
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    return request(`/api/reports/analytics?${query.toString()}`, { noCache: true });
  },

  /**
   * Directly fetch un-manipulated live database figures for a specific date.
   */
  async getDbMetrics(date) {
    return request(`/api/reports/db-metrics?date=${encodeURIComponent(date)}`, { noCache: true });
  },
};
