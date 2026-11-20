'use strict';
const { enabled } = require('./analytics-build');

// Compatibility with the retired first-party booking/Ops collection design.
// This flag does not control the consent-required GA4 runtime.
const LEGACY_BOOKING_MEASUREMENT_ENABLED = false;
const FINAL_VERIFIED_SCOPE = 'generated HTML inventory, route eligibility, and page identities';

function measurementReport(env = process.env) {
  return {
    version: 1,
    legacyBookingCollector: {
      enabled: LEGACY_BOOKING_MEASUREMENT_ENABLED,
      compatibilityFlag: 'MFT_BOOKING_CONFIG.measurementEnabled',
      controlsConsentControlledGa4: false
    },
    consentControlledGa4: {
      buildEnabled: enabled(env),
      runtimeConsentRequired: true,
      runtimeEntryPoint: 'MFTSchedulingMeasurement.track',
      inventoryReport: '/reports/analytics-integration.json'
    },
    schedulingMetric: {
      displayName: 'Website scheduling-link click',
      sourceEvent: 'simplepractice_exit',
      countingUnit: 'one eligible native new-client handoff to SimplePractice',
      delivery: 'best effort; native navigation never waits for measurement',
      diagnosticEvents: ['appointment_request_click', 'clinician_schedule_click', 'consultation_click'],
      diagnosticEventsCountTowardMetric: false,
      excludedActions: ['dialog open', 'dialog close or cancel', 'dialog acknowledgment', 'existing-client sign-in'],
      dialogHandoff: 'enabled Continue navigation only',
      establishesAppointment: false
    },
    evidenceScope: 'website build configuration only',
    externalVerification: {
      googleCollectorAcceptance: 'not verified by this report',
      ga4PropertyReceipt: 'not verified by this report',
      googleAdsAttribution: 'not verified by this report',
      confirmedAppointments: 'not measured'
    }
  };
}

module.exports = { LEGACY_BOOKING_MEASUREMENT_ENABLED, FINAL_VERIFIED_SCOPE, measurementReport };
