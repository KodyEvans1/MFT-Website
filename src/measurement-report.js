'use strict';
const { enabled, handoffEnabled, controllerEnabled, googleRequested, googlePolicy,
  GOOGLE_POLICY_FILE, GOOGLE_FLOW_FILE, GOOGLE_RUNTIME_ASSET, GOOGLE_RUNTIME_MODE,
  flowHash, runtimeHash, MEASUREMENT_ID, HANDOFF_ENDPOINT } = require('./analytics-build');

// Compatibility with the retired first-party booking/Ops collection design.
// This flag does not control either current first-party collection or Google.
const LEGACY_BOOKING_MEASUREMENT_ENABLED = false;
const FINAL_VERIFIED_SCOPE = 'generated first-party and Google runtime inventories, explicit route and event policy, page identities, and CSP; not collector receipt';

function measurementReport(env = process.env, policy = googlePolicy()) {
  const google = enabled(env, policy);
  return {
    version: 4,
    legacyBookingCollector: {
      enabled: LEGACY_BOOKING_MEASUREMENT_ENABLED,
      compatibilityFlag: 'MFT_BOOKING_CONFIG.measurementEnabled',
      controlsConsentControlledGa4: false
    },
    firstPartyController: {
      buildEnabled: controllerEnabled(env),
      runtimeEntryPoint: 'MFTSchedulingMeasurement.track',
      browserConsentVersion: 'mft.analytics.consent.v5',
      runtimeConsentRequired: true,
      inventoryReport: '/reports/analytics-integration.json'
    },
    consentControlledGa4: {
      buildEnabled: google,
      requestedByEnvironment: googleRequested(env),
      configuredMeasurementId: MEASUREMENT_ID,
      mode: google ? GOOGLE_RUNTIME_MODE : 'disabled',
      policyFile: GOOGLE_POLICY_FILE,
      policy,
      runtimeConsentRequired: true,
      runtimeEntryPoint: google ? 'MFTGoogleMeasurement.handoff' : null,
      runtimeAsset: google ? '/assets/' + GOOGLE_RUNTIME_ASSET : null,
      candidateRuntime: {asset:'/assets/' + GOOGLE_RUNTIME_ASSET, sha256:runtimeHash(),
        activation:'Requires exact documented review, matching source hashes, network evidence, and the production flag'},
      dataFlow: {file:GOOGLE_FLOW_FILE, sha256:flowHash()},
      advertisingMeasurement: google ? {
        available: true,
        status: 'fresh-choice-required',
        preferenceVersion: 'mft.advertising.consent.v2',
        storedPreference: 'not-pregranted'
      } : {
        available: false,
        status: 'unavailable',
        preferenceVersion: 'mft.advertising.consent.v1',
        storedPreference: 'denied'
      },
      inventoryReport: '/reports/analytics-integration.json'
    },
    consentControlledOps: {
      buildEnabled: handoffEnabled(env),
      endpoint: handoffEnabled(env) ? HANDOFF_ENDPOINT : null,
      event: 'simplepractice_exit',
      consentVersion: 'mft.analytics.consent.v4',
      consentVersionScope: 'existing Ops receiver contract',
      browserConsentVersion: 'mft.analytics.consent.v5',
      runtimeConsentRequired: true,
      actionId: 'one random UUID per handoff; reused for a bounded retry',
      visitorIdentifier: false,
      sourceLifetimeMinutes: 30,
      eventRetentionDays: 30,
      expiredEventDeletion: 'daily cleanup and ingestion cleanup after the 30-day reporting cutoff',
      appointmentMatching: 'unmatched until a supported, demonstrated identifier connection exists'
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
      opsHandoffReceipt: 'not verified by this build report',
      simplePracticeRequestVerification: 'existing protected Ops workflow; not established by website activity',
      internalRequestAttribution: 'requires demonstrated evidence; handoff IDs do not identify a request',
      googleCollectorAcceptance: 'not verified by this report',
      ga4PropertyReceipt: 'not verified by this report',
      googleAdsAttribution: 'not verified by this report',
      confirmedAppointments: 'not measured'
    }
  };
}

module.exports = { LEGACY_BOOKING_MEASUREMENT_ENABLED, FINAL_VERIFIED_SCOPE, measurementReport };
